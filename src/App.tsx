import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorCanvas } from './components/EditorCanvas';
import { ExportPanel } from './components/ExportPanel';
import { ImageQueue } from './components/ImageQueue';
import { RenameWorkspace } from './components/RenameWorkspace';
import { TemplateDialog } from './components/TemplateDialog';
import { TopBar } from './components/TopBar';
import { autoCutoutItem, type AutoCutoutResult } from './lib/backgroundRemoval';
import { exportCanvasImage, normalizeExportSettings } from './lib/canvasExport';
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
  width: 1024,
  height: 1024,
  backgroundType: 'transparent',
  backgroundColor: '#ffffff',
  cornerRadius: 0
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

  useEffect(() => {
    const idleItems = items.filter((item) => item.cutoutStatus === 'idle');
    for (const item of idleItems) {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, cutoutMessage: '正在自动抠图...', cutoutStatus: 'processing' }
            : candidate
        )
      );

      void autoCutout(item)
        .then((result) => {
          setItems((current) =>
            current.map((candidate) => {
              if (candidate.id !== item.id) {
                return candidate;
              }

              const history = pushHistory(candidate, result.processedPreviewUrl);
              return {
                ...candidate,
                ...history,
                cutoutKind: result.kind,
                cutoutMessage: result.message,
                cutoutStatus: 'ready',
                processedPreviewUrl: result.processedPreviewUrl
              };
            })
          );
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
        });
    }
  }, [autoCutout, items]);

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
        exportSettings: normalizeExportSettings({
          ...item.exportSettings,
          ...settings
        })
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

        return {
          ...item,
          naturalWidth: width,
          naturalHeight: height,
          crop: fitCropToRatio(width, height, item.crop.ratio)
        };
      })
    );
  }, []);

  const changeCropRatio = useCallback(
    (ratio: CropRatio) => {
      updateActiveItem((item) => ({
        ...item,
        crop: fitCropToRatio(item.naturalWidth, item.naturalHeight, ratio)
      }));
    },
    [updateActiveItem]
  );

  const changeCrop = useCallback(
    (crop: CropRect) => {
      updateActiveItem((item) => ({
        ...item,
        crop
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
        crop:
          activeItem.crop.ratio === 'free'
            ? activeItem.crop
            : fitCropToRatio(item.naturalWidth, item.naturalHeight, activeItem.crop.ratio),
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
      setExportStatus(`已套用模板：${template.name}`);
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

          const originalImage = await loadImage(item.previewUrl);
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
      const image = await loadImage(item.processedPreviewUrl ?? item.previewUrl);
      const settings = normalizeExportSettings(item.exportSettings);
      const crop = resolveCropForImage(item, image, item.crop.ratio);
      const blob = await exportImage(image, crop, settings);
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
    const ratio = templateItem.crop.ratio;
    setIsExporting(true);
    setExportError(undefined);
    setExportStatus('正在生成 ZIP...');

    try {
      const files: ZipFileSource[] = [];
      for (const item of items) {
        const image = await loadImage(item.processedPreviewUrl ?? item.previewUrl);
        files.push({
          blob: await exportImage(image, resolveCropForImage(item, image, ratio), settings),
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
        onOpenRename={() => setWorkspaceMode('rename')}
        onOpenTemplate={() => setIsTemplateOpen(true)}
        samMode={samMode}
      />
      {workspaceMode === 'rename' ? (
        <RenameWorkspace
          activeId={activeItem?.id}
          items={items}
          onApplyMappings={applyRenameMappings}
          onBack={() => setWorkspaceMode('edit')}
          onSelectItem={setActiveId}
          onUpdateTargetName={updateTargetName}
        />
      ) : (
        <div className="workspace">
          <ImageQueue
            activeId={activeItem?.id}
            items={items}
            onImportFiles={importFiles}
            onSelectItem={setActiveId}
          />
          <EditorCanvas
            activeItem={activeItem}
            activeTool={activeTool}
            brushSize={brushSize}
            canRedo={canRedo}
            canUndo={canUndo}
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

function resolveCropForImage(item: ImageQueueItem, image: HTMLImageElement, ratio: CropRatio) {
  const width = image.naturalWidth || item.naturalWidth;
  const height = image.naturalHeight || item.naturalHeight;
  return ratio === 'free' ? item.crop : fitCropToRatio(width, height, ratio);
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '处理失败，请重试';
}
