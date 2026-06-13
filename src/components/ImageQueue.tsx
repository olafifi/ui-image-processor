import type { DragEvent } from 'react';
import type { ImageQueueItem } from '../types';

interface ImageQueueProps {
  activeId?: string;
  items: ImageQueueItem[];
  onSelectItem: (id: string) => void;
  onImportFiles: (files: Iterable<File>) => void;
}

export function ImageQueue({ activeId, items, onImportFiles, onSelectItem }: ImageQueueProps) {
  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    onImportFiles(event.dataTransfer.files);
  }

  return (
    <aside
      className="rail"
      aria-label="图片队列"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="side-title">
        <span>队列</span>
        <span>{items.length}</span>
      </div>

      {items.map((item) => (
        <button
          className={item.id === activeId ? 'thumb active' : 'thumb'}
          key={item.id}
          onClick={() => onSelectItem(item.id)}
          type="button"
        >
          {item.originalName}
        </button>
      ))}

      <div className="spacer" />
      <div className="drop-hint">拖入多张图片</div>
    </aside>
  );
}
