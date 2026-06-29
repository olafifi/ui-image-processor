import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorCanvas } from './components/EditorCanvas';
import { ExportPanel } from './components/ExportPanel';
import { ImageQueue } from './components/ImageQueue';
import { RenameWorkspace } from './components/RenameWorkspace';
import { TemplateDialog } from './components/TemplateDialog';
import { TopBar } from './components/TopBar';
import { autoCutoutItem, type AutoCutoutResult } from './lib/backgroundRemoval';
import { exportCanvasImage, normalizeExportSettings, resolveExportSize } from './lib/canvasExport';
import { applyCutoutEditToImages } from './lib/cutoutEdit';
import { fitCropToRatio, fullCrop } from './lib/crop';
import { downloadBlob as browserDownloadBlob } from './lib/download';
import { createImageQueueItem, filterSupportedImageFiles } from './lib/fileImport';
import { loadImageSource } from './lib/imageLoader';
import { detectBrowserCapabilities, detectSamMode } from './lib/samAdapter';
import { createLocalStorageTemplateStore, type TemplateDraft } from './lib/templateStore';
import { createExportZip, resolveExportFilename, type ZipFileSource } from './lib/zipExport';
import type {
  AppMode,
  CropRatio,
  CropRect,
  CutoutEditRequest,
  EditorTool,
  ExportSettings,
  ImageQueueItem,
  RenameMapping,
  Template,
  WorkspaceMode
} from './types';

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'png',
  sizeMode: 'crop',
  width: 0,
  height: 0,
  backgroundType: 'transparent',
  backgroundColor: '#ffffff',
  cornerRadius: 0,
  compressionMode: 'source-size',
  jpegQuality: 88
};

type AutoCutoutRunner = (item: ImageQueueItem) => Promise<AutoCutoutResult>;

interface AppProps {
  autoCutout?: AutoCutoutRunner;
  createZip?: typeof createExportZip;
  downloadBlob?: (blob: Blob, filename: string) => void;
  exportImage?: typeof exportCanvasImage;
  loadImage?: (url: string) => Promise<HTMLImageElement>;
}

export function App({
  autoCutout = autoCutoutItem,
  createZip = createExportZip,
  downloadBlob = browserDownloadBlob,
  exportImage = exportCanvasImage,
  loadImage = loadImageSource
}: AppProps = {}) {
  const [items, setItems] = useState<ImageQueueItem[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('edit');
  const [activeTool, setActiveTool] = useState<EditorTool>('crop');
  const [brushSize, setBrushSize] = useState(36);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [exportStatus, setExportStatus] = useState<string>();
  const [templates, setTemplates] = useState<Template[]>([]);
  const objectUrls = useRef<string[]>([]);
  const latestItems = useRef<ImageQueueItem[]>([]);
  const editQueue = useRef(Promise.resolve());
  const cutoutJobs = useRef(new Map<string, Promise<AutoCutoutResult>>());
  const templateStore = useMemo(() => createLocalStorageTemplateStore(), []);
  const samMode = useMemo<AppMode>(() => detectSamMode(detectBrowserCapabilities()), []);
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0],
    [activeId, items]
  );
  const canUndo = Boolean(activeItem && activeItem.editHistoryIndex > 0);
  const canRedo = Boolean(activeItem && activeItem.editHistoryIndex < activeItem.editHistory.length - 1);

  useEffect(() => {
    latestItems.current = items;
  }, [items]);

  const importFiles = useCallback((files: Iterable<File>) => {
    const nextItems = filterSupportedImageFiles(files).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.push(previewUrl);
      return createImageQueueItem(file, previewUrl);
    });

    if (nextItems.length > 0) {
      setItems((current) => [...current, ...nextItems]);
      setActiveId((current) => current ?? nextItems[0].id);
    }
  }, []);

  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    void templateStore.list().then(setTemplates);
  }, [templateStore]);

  const startCutout = useCallback(
    (item: ImageQueueItem, force = false) => {
      if (!force && item.processedPreviewUrl) {
        return Promise.resolve({
          kind: item.cutoutKind ?? 'unknown',
          message: item.cutoutMessage ?? '已自动抠图',
          processedPreviewUrl: item.processedPreviewUrl
        } satisfies AutoCutoutResult);
      }

      const existingJob = cutoutJobs.current.get(item.id);
      if (!force && existingJob) {
        return existingJob;
      }

      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                ...(force
                  ? {
                      baseCutoutUrl: undefined,
                      cutoutKind: undefined,
                      editHistory: [candidate.previewUrl],
                      editHistoryIndex: 0,
                      processedPreviewUrl: undefined
                    }
                  : {}),
                cutoutMessage: '正在自动抠图...',
                cutoutStatus: 'processing'
              }
            : candidate
        )
      );

      const job = autoCutout(item)
        .then((result) => {
          setItems((current) =>
            current.map((candidate) => {
              if (candidate.id !== item.id) {
                return candidate;
              }

              const history = force
                ? createProcessedHistory(candidate, result.processedPreviewUrl)
                : pushHistory(candidate, result.processedPreviewUrl);
              return {
                ...candidate,
                ...history,
                baseCutoutUrl: result.processedPreviewUrl,
                cutoutKind: result.kind,
                cutoutMessage: result.message,
                cutoutStatus: 'ready',
                processedPreviewUrl: result.processedPreviewUrl
              };
            })
          );
          return result;
        })
        .catch((error) => {
          setItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? {
                    ...candidate,
                    cutoutMessage: getErrorMessage(error),
                    cutoutStatus: 'failed'
                  }
                : candidate
            )
          );
          throw error;
        })
        .finally(() => {
          cutoutJobs.current.delete(item.id);
        });

      cutoutJobs.current.set(item.id, job);
      return job;
    },
    [autoCutout]
  );

  const saveTemplate = useCallback(
    (template: TemplateDraft) => {
      void templateStore.save(template).then(async () => {
        setTemplates(await templateStore.list());
      });
    },
    [templateStore]
  );

  const currentTemplate = useMemo<TemplateDraft>(
    () => ({
      name: '透明 UI 参考',
      crop: activeItem?.crop ?? fullCrop('1:1'),
      exportSettings: activeItem?.exportSettings ?? DEFAULT_EXPORT_SETTINGS,
      namingRule: 'ui_ref_{n}'
    }),
    [activeItem]
  );

  const updateActiveItem = useCallback(
    (updater: (item: ImageQueueItem) => ImageQueueItem) => {
      if (!activeItem) {
        return;
      }
      setItems((current) => current.map((item) => (item.id === activeItem.id ? updater(item) : item)));
    },
    [activeItem]
  );

  const updateActiveSettings = useCallback(
    (settings: Partial<ExportSettings>) => {
      updateActiveItem((item) => ({
        ...item,
        exportSettings: syncExportSettingsToCrop(
          normalizeExportSettings({
            ...item.exportSettings,
            ...settings,
            ...(settings.width !== undefined || settings.height !== undefined ? { sizeMode: 'custom' as const } : {})
          }),
          item.crop,
          item.naturalWidth,
          item.naturalHeight,
          settings.width !== undefined ? 'width' : settings.height !== undefined ? 'height' : undefined
        )
      }));
    },
    [updateActiveItem]
  );

  const updateImageDimensions = useCallback((id: string, width: number, height: number) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id || (item.naturalWidth === width && item.naturalHeight === height)) {
          return item;
        }

        const crop = fitCropToRatio(width, height, item.crop.ratio);
        return {
          ...item,
          naturalWidth: width,
          naturalHeight: height,
          crop,
          exportSettings: syncExportSettingsToCrop(item.exportSettings, crop, width, height)
        };
      })
    );
  }, []);

  const changeCropRatio = useCallback(
    (ratio: CropRatio) => {
      updateActiveItem((item) => ({
        ...item,
        crop: fitCropToRatio(item.naturalWidth, item.naturalHeight, ratio),
        exportSettings: syncExportSettingsToCrop(
          item.exportSettings,
          fitCropToRatio(item.naturalWidth, item.naturalHeight, ratio),
          item.naturalWidth,
          item.naturalHeight
        )
      }));
    },
    [updateActiveItem]
  );

  const changeCrop = useCallback(
    (crop: CropRect) => {
      updateActiveItem((item) => ({
        ...item,
        crop,
        exportSettings: syncExportSettingsToCrop(item.exportSettings, crop, item.naturalWidth, item.naturalHeight)
      }));
    },
    [updateActiveItem]
  );

  const toggleRounded = useCallback(() => {
    updateActiveItem((item) => ({
      ...item,
      exportSettings: {
        ...item.exportSettings,
        cornerRadius: item.exportSettings.cornerRadius > 0 ? 0 : 24
      }
    }));
  }, [updateActiveItem]);

  const useTransparentBackground = useCallback(() => {
    updateActiveSettings({ backgroundType: 'transparent', format: 'png' });
  }, [updateActiveSettings]);

  const applyActiveSettingsToAll = useCallback(() => {
    if (!activeItem) {
      return;
    }

    setItems((current) =>
      current.map((item) => ({
        ...item,
        crop: activeItem.crop,
        exportSettings: { ...activeItem.exportSettings }
      }))
    );
    setExportStatus('已将当前设置应用到全部图片');
  }, [activeItem]);

  const applyTemplate = useCallback(
    (template: Template) => {
      updateActiveItem((item) => ({
        ...item,
        crop: template.crop,
        exportSettings: template.exportSettings
      }));
      setIsTemplateOpen(false);
      setExportStatus(`已套用裁剪模板：${template.name}`);
    },
    [updateActiveItem]
  );

  const applyRenameMappings = useCallback((mappings: RenameMapping[]) => {
    setItems((current) =>
      current.map((item) => {
        const mapping = mappings.find((candidate) => candidate.oldFilename === item.originalName);
        return mapping ? { ...item, targetName: mapping.newFilename } : item;
      })
    );
  }, []);

  const updateTargetName = useCallback((id: string, targetName: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, targetName } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    const currentItems = latestItems.current;
    const removedIndex = currentItems.findIndex((item) => item.id === id);
    const removedItem = currentItems[removedIndex];
    if (!removedItem) {
      return;
    }

    URL.revokeObjectURL(removedItem.previewUrl);
    objectUrls.current = objectUrls.current.filter((url) => url !== removedItem.previewUrl);
    cutoutJobs.current.delete(id);

    const remainingItems = currentItems.filter((item) => item.id !== id);
    setItems((current) => current.filter((item) => item.id !== id));
    setActiveId((currentActiveId) => {
      if (currentActiveId && currentActiveId !== id) {
        return currentActiveId;
      }

      return remainingItems[Math.min(removedIndex, remainingItems.length - 1)]?.id;
    });
  }, []);

  const rerunAutoCutoutAll = useCallback(() => {
    const queuedItems = latestItems.current;
    if (queuedItems.length === 0) {
      return;
    }

    setActiveTool('selectAdd');
    for (const item of queuedItems) {
      void startCutout(item, true);
    }
  }, [startCutout]);

  const applyCutoutEdit = useCallback(
    (edit: CutoutEditRequest) => {
      const itemId = activeItem?.id;
      if (!itemId) {
        return;
      }

      editQueue.current = editQueue.current
        .then(async () => {
          const item = latestItems.current.find((candidate) => candidate.id === itemId);
          if (!item) {
            return;
          }

          const restoreSourceUrl =
            edit.mode === 'restore' || edit.mode === 'point-restore'
              ? item.baseCutoutUrl ?? item.processedPreviewUrl ?? item.previewUrl
              : item.previewUrl;
          const originalImage = await loadImage(restoreSourceUrl);
          const processedImage = await loadImage(item.processedPreviewUrl ?? item.previewUrl);
          const processedPreviewUrl = await applyCutoutEditToImages(originalImage, processedImage, edit);

          setItems((current) =>
            current.map((candidate) => {
              if (candidate.id !== itemId) {
                return candidate;
              }

              return {
                ...candidate,
                ...pushHistory(candidate, processedPreviewUrl),
                cutoutMessage: '已手动修补抠图',
                cutoutStatus: 'ready',
                processedPreviewUrl
              };
            })
          );
        })
        .catch((error) => {
          setExportError(getErrorMessage(error));
        });
    },
    [activeItem?.id, loadImage]
  );

  const undoEdit = useCallback(() => {
    updateActiveItem((item) => moveHistory(item, -1));
  }, [updateActiveItem]);

  const redoEdit = useCallback(() => {
    updateActiveItem((item) => moveHistory(item, 1));
  }, [updateActiveItem]);

  const exportSingleItem = useCallback(
    async (item: ImageQueueItem) => {
      const settings = normalizeExportSettings(item.exportSettings);
      const reusableSource = getReusableSourceFile(item, settings);
      if (reusableSource) {
        return { blob: reusableSource, settings };
      }

      const image = await loadImage(item.processedPreviewUrl ?? item.previewUrl);
      const blob = await exportImage(image, item.crop, settings, {
        sourceFileSize: item.sourceFile.size,
        sourcePixelCount: item.naturalWidth * item.naturalHeight
      });
      return { blob, settings };
    },
    [exportImage, loadImage]
  );

  const exportCurrent = useCallback(async () => {
    if (!activeItem) {
      return;
    }

    setIsExporting(true);
    setExportError(undefined);
    setExportStatus('正在导出当前图片...');

    try {
      const { blob, settings } = await exportSingleItem(activeItem);
      downloadBlob(blob, resolveExportFilename(activeItem.originalName, activeItem.targetName, settings.format));
      setExportStatus('当前图片已导出');
    } catch (error) {
      setExportError(getErrorMessage(error));
      setExportStatus(undefined);
    } finally {
      setIsExporting(false);
    }
  }, [activeItem, downloadBlob, exportSingleItem]);

  const exportZip = useCallback(async () => {
    if (items.length === 0) {
      return;
    }

    const templateItem = activeItem ?? items[0];
    const settings = normalizeExportSettings(templateItem.exportSettings);
    setIsExporting(true);
    setExportError(undefined);
    setExportStatus('正在生成 ZIP...');

    try {
      const files: ZipFileSource[] = [];
      for (const item of items) {
        const reusableSource = getReusableSourceFile(item, settings);
        if (reusableSource) {
          files.push({
            blob: reusableSource,
            originalName: item.originalName,
            targetName: item.targetName
          });
          continue;
        }

        const image = await loadImage(item.processedPreviewUrl ?? item.previewUrl);
        files.push({
          blob: await exportImage(image, item.crop, settings, {
            sourceFileSize: item.sourceFile.size,
            sourcePixelCount: item.naturalWidth * item.naturalHeight
          }),
          originalName: item.originalName,
          targetName: item.targetName
        });
      }

      downloadBlob(await createZip(files, settings.format), 'ui-image-processor.zip');
      setExportStatus(`ZIP 已生成：${items.length} 张图片`);
    } catch (error) {
      setExportError(getErrorMessage(error));
      setExportStatus(undefined);
    } finally {
      setIsExporting(false);
    }
  }, [activeItem, createZip, downloadBlob, exportImage, items, loadImage]);

  return (
    <div className="app-shell">
      <TopBar
        onImportFiles={importFiles}
        onOpenEdit={() => setWorkspaceMode('edit')}
        onOpenRename={() => setWorkspaceMode('rename')}
        samMode={samMode}
        workspaceMode={workspaceMode}
      />
      {workspaceMode === 'rename' ? (
        <RenameWorkspace
          activeId={activeItem?.id}
          error={exportError}
          isBusy={isExporting}
          items={items}
          onApplyMappings={applyRenameMappings}
          onBack={() => setWorkspaceMode('edit')}
          onExportCurrent={exportCurrent}
          onExportZip={exportZip}
          onSelectItem={setActiveId}
          onUpdateTargetName={updateTargetName}
          status={exportStatus}
        />
      ) : (
        <div className="workspace">
          <ImageQueue
            activeId={activeItem?.id}
            items={items}
            onImportFiles={importFiles}
            onRemoveItem={removeItem}
            onSelectItem={setActiveId}
          />
          <EditorCanvas
            activeItem={activeItem}
            activeTool={activeTool}
            brushSize={brushSize}
            canRedo={canRedo}
            canUndo={canUndo}
            onAutoCutoutAll={rerunAutoCutoutAll}
            onChangeBrushSize={setBrushSize}
            onChangeCrop={changeCrop}
            onChangeCropRatio={changeCropRatio}
            onChangeTool={setActiveTool}
            onCutoutEdit={applyCutoutEdit}
            onImageLoaded={updateImageDimensions}
            onImportFiles={importFiles}
            onRedo={redoEdit}
            onToggleRounded={toggleRounded}
            onUndo={undoEdit}
            onUseTransparentBackground={useTransparentBackground}
            samMode={samMode}
          />
          <ExportPanel
            activeItem={activeItem}
            error={exportError}
            isBusy={isExporting}
            itemCount={items.length}
            onApplyToAll={applyActiveSettingsToAll}
            onExportCurrent={exportCurrent}
            onExportZip={exportZip}
            onOpenTemplate={() => setIsTemplateOpen(true)}
            onResetSize={() => updateActiveSettings({ sizeMode: 'crop', width: 0, height: 0 })}
            onUpdateSettings={updateActiveSettings}
            status={exportStatus}
          />
        </div>
      )}
      {isTemplateOpen && (
        <TemplateDialog
          currentTemplate={currentTemplate}
          onApply={applyTemplate}
          onClose={() => setIsTemplateOpen(false)}
          onSave={saveTemplate}
          templates={templates}
        />
      )}
    </div>
  );
}

function pushHistory(item: ImageQueueItem, processedPreviewUrl: string) {
  const baseHistory = item.editHistory.length > 0 ? item.editHistory : [item.previewUrl];
  const nextHistory = [...baseHistory.slice(0, item.editHistoryIndex + 1), processedPreviewUrl];
  const trimmedHistory = nextHistory.slice(-20);
  return {
    editHistory: trimmedHistory,
    editHistoryIndex: trimmedHistory.length - 1
  };
}

function createProcessedHistory(item: ImageQueueItem, processedPreviewUrl: string) {
  return {
    editHistory: [item.previewUrl, processedPreviewUrl],
    editHistoryIndex: 1
  };
}

function moveHistory(item: ImageQueueItem, delta: -1 | 1): ImageQueueItem {
  const nextIndex = clamp(item.editHistoryIndex + delta, 0, item.editHistory.length - 1);
  const nextPreviewUrl = item.editHistory[nextIndex];
  return {
    ...item,
    cutoutMessage: delta < 0 ? '已撤销上一步' : '已重做上一步',
    editHistoryIndex: nextIndex,
    processedPreviewUrl: nextPreviewUrl === item.previewUrl ? undefined : nextPreviewUrl
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function syncExportSettingsToCrop(
  settings: ExportSettings,
  crop: CropRect,
  imageWidth: number,
  imageHeight: number,
  changedDimension: 'width' | 'height' = 'width'
): ExportSettings {
  const normalized = normalizeExportSettings(settings);
  if (normalized.sizeMode !== 'custom') {
    return normalized;
  }

  const cropWidth = crop.width * imageWidth;
  const cropHeight = crop.height * imageHeight;
  if (cropWidth <= 0 || cropHeight <= 0) {
    return normalized;
  }

  const aspect = cropWidth / cropHeight;
  if (changedDimension === 'height') {
    const height = Math.max(1, Math.round(normalized.height));
    return {
      ...normalized,
      height,
      width: Math.max(1, Math.round(height * aspect))
    };
  }

  const width = Math.max(1, Math.round(normalized.width));
  return {
    ...normalized,
    width,
    height: Math.max(1, Math.round(width / aspect))
  };
}

function getReusableSourceFile(item: ImageQueueItem, settings: ExportSettings): File | undefined {
  if (item.processedPreviewUrl || settings.cornerRadius > 0 || !isFullCrop(item.crop)) {
    return undefined;
  }

  const sourceFormat = getSourceExportFormat(item);
  if (!sourceFormat || sourceFormat !== settings.format) {
    return undefined;
  }

  if (settings.format === 'png' && settings.backgroundType !== 'transparent') {
    return undefined;
  }

  const outputSize = resolveExportSize(
    { width: item.naturalWidth, height: item.naturalHeight },
    item.crop,
    settings
  );

  if (outputSize.width !== item.naturalWidth || outputSize.height !== item.naturalHeight) {
    return undefined;
  }

  return item.sourceFile;
}

function getSourceExportFormat(item: ImageQueueItem) {
  const extension = item.originalName.split('.').pop()?.toLowerCase();
  if (item.mimeType === 'image/png' || extension === 'png') {
    return 'png';
  }
  if (item.mimeType === 'image/jpeg' || extension === 'jpg' || extension === 'jpeg') {
    return 'jpeg';
  }
  return undefined;
}

function isFullCrop(crop: CropRect): boolean {
  const epsilon = 0.0001;
  return (
    Math.abs(crop.x) < epsilon &&
    Math.abs(crop.y) < epsilon &&
    Math.abs(crop.width - 1) < epsilon &&
    Math.abs(crop.height - 1) < epsilon
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '处理失败，请重试';
}
