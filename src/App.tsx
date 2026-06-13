import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorCanvas } from './components/EditorCanvas';
import { ExportPanel } from './components/ExportPanel';
import { ImageQueue } from './components/ImageQueue';
import { RenameDialog } from './components/RenameDialog';
import { TopBar } from './components/TopBar';
import { createImageQueueItem, filterSupportedImageFiles } from './lib/fileImport';
import type { ImageQueueItem } from './types';

export function App() {
  const [items, setItems] = useState<ImageQueueItem[]>([]);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const objectUrls = useRef<string[]>([]);

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

  return (
    <div className="app-shell">
      <TopBar onImportFiles={importFiles} onOpenRename={() => setIsRenameOpen(true)} />
      <div className="workspace">
        <ImageQueue items={items} onImportFiles={importFiles} />
        <EditorCanvas onImportFiles={importFiles} />
        <ExportPanel />
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
    </div>
  );
}
