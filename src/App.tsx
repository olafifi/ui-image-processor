import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorCanvas } from './components/EditorCanvas';
import { ExportPanel } from './components/ExportPanel';
import { ImageQueue } from './components/ImageQueue';
import { RenameDialog } from './components/RenameDialog';
import { TemplateDialog } from './components/TemplateDialog';
import { TopBar } from './components/TopBar';
import { exportCanvasImage, normalizeExportSettings } from './lib/canvasExport';
import { fitCropToRatio, fullCrop } from './lib/crop';
import { downloadBlob as browserDownloadBlob } from './lib/download';
import { createImageQueueItem, filterSupportedImageFiles } from './lib/fileImport';
import { loadImageSource } from './lib/imageLoader';
import { detectBrowserCapabilities, detectSamMode } from './lib/samAdapter';
import { createLocalStorageTemplateStore, type TemplateDraft } from './lib/templateStore';
import { createExportZip, resolveExportFilename, type ZipFileSource } from './lib/zipExport';
import type { AppMode, CropRatio, CropRect, ExportSettings, ImageQueueItem, Template } from './types';

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'png',
  width: 1024,
  height: 1024,
  backgroundType: 'transparent',
  backgroundColor: '#ffffff',
  cornerRadius: 0
};

interface AppProps {
  createZip?: typeof createExportZip;
  downloadBlob?: (blob: Blob, filename: string) => void;
  exportImage?: typeof exportCanvasImage;
  loadImage?: (url: string) => Promise<HTMLImageElement>;
}

export function App({
  createZip = createExportZip,
  downloadBlob = browserDownloadBlob,
  exportImage = exportCanvasImage,
  loadImage = loadImageSource
}: AppProps = {}) {
  const [items, setItems] = useState<ImageQueueItem[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();
  const [exportStatus, setExportStatus] = useState<string>();
  const [templates, setTemplates] = useState<Template[]>([]);
  const objectUrls = useRef<string[]>([]);
  const templateStore = useMemo(() => createLocalStorageTemplateStore(), []);
  const samMode = useMemo<AppMode>(() => detectSamMode(detectBrowserCapabilities()), []);
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0],
    [activeId, items]
  );

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

  const exportSingleItem = useCallback(
    async (item: ImageQueueItem) => {
      const image = await loadImage(item.previewUrl);
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
        const image = await loadImage(item.previewUrl);
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
        onOpenRename={() => setIsRenameOpen(true)}
        onOpenTemplate={() => setIsTemplateOpen(true)}
        samMode={samMode}
      />
      <div className="workspace">
        <ImageQueue
          activeId={activeItem?.id}
          items={items}
          onImportFiles={importFiles}
          onSelectItem={setActiveId}
        />
        <EditorCanvas
          activeItem={activeItem}
          onChangeCrop={changeCrop}
          onChangeCropRatio={changeCropRatio}
          onImageLoaded={updateImageDimensions}
          onImportFiles={importFiles}
          onToggleRounded={toggleRounded}
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
      {isRenameOpen && (
        <RenameDialog
          oldFilenames={items.map((item) => item.originalName)}
          onApplyMappings={(mappings) => {
            setItems((current) =>
              current.map((item) => {
                const mapping = mappings.find((candidate) => candidate.oldFilename === item.originalName);
                return mapping ? { ...item, targetName: mapping.newFilename } : item;
              })
            );
          }}
          onClose={() => setIsRenameOpen(false)}
        />
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '导出失败，请重试';
}
