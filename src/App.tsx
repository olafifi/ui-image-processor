import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorCanvas } from './components/EditorCanvas';
import { ExportPanel } from './components/ExportPanel';
import { ImageQueue } from './components/ImageQueue';
import { TopBar } from './components/TopBar';
import { createImageQueueItem, filterSupportedImageFiles } from './lib/fileImport';
import type { ImageQueueItem } from './types';

export function App() {
  const [items, setItems] = useState<ImageQueueItem[]>([]);
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
      <TopBar onImportFiles={importFiles} />
      <div className="workspace">
        <ImageQueue items={items} onImportFiles={importFiles} />
        <EditorCanvas onImportFiles={importFiles} />
        <ExportPanel />
      </div>
    </div>
  );
}
