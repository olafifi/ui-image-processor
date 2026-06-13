import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorCanvas } from './components/EditorCanvas';
import { ExportPanel } from './components/ExportPanel';
import { ImageQueue } from './components/ImageQueue';
import { RenameDialog } from './components/RenameDialog';
import { TemplateDialog } from './components/TemplateDialog';
import { TopBar } from './components/TopBar';
import { createImageQueueItem, filterSupportedImageFiles } from './lib/fileImport';
import { createLocalStorageTemplateStore, type TemplateDraft } from './lib/templateStore';
import type { ImageQueueItem, Template } from './types';

export function App() {
  const [items, setItems] = useState<ImageQueueItem[]>([]);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const objectUrls = useRef<string[]>([]);
  const templateStore = useMemo(() => createLocalStorageTemplateStore(), []);

  const importFiles = useCallback((files: Iterable<File>) => {
    const nextItems = filterSupportedImageFiles(files).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.push(previewUrl);
      return createImageQueueItem(file, previewUrl);
    });

    if (nextItems.length > 0) {
      setItems((current) => [...current, ...nextItems]);
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

  return (
    <div className="app-shell">
      <TopBar
        onImportFiles={importFiles}
        onOpenRename={() => setIsRenameOpen(true)}
        onOpenTemplate={() => setIsTemplateOpen(true)}
      />
      <div className="workspace">
        <ImageQueue items={items} onImportFiles={importFiles} />
        <EditorCanvas onImportFiles={importFiles} />
        <ExportPanel onOpenTemplate={() => setIsTemplateOpen(true)} />
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
          onClose={() => setIsTemplateOpen(false)}
          onSave={saveTemplate}
          templates={templates}
        />
      )}
    </div>
  );
}
