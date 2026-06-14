import type { DragEvent } from 'react';
import type { ImageQueueItem } from '../types';
import { Icon } from './Icon';

interface ImageQueueProps {
  activeId?: string;
  items: ImageQueueItem[];
  onImportFiles: (files: Iterable<File>) => void;
  onRemoveItem: (id: string) => void;
  onSelectItem: (id: string) => void;
}

export function ImageQueue({ activeId, items, onImportFiles, onRemoveItem, onSelectItem }: ImageQueueProps) {
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
        <div
          className={item.id === activeId ? 'thumb active' : 'thumb'}
          key={item.id}
        >
          <button className="thumb-main" onClick={() => onSelectItem(item.id)} type="button">
            {item.originalName}
          </button>
          <button
            aria-label={`移除 ${item.originalName}`}
            className="thumb-remove"
            onClick={() => onRemoveItem(item.id)}
            title="移除图片"
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
      ))}

      <div className="spacer" />
      <div className="drop-hint">拖入多张图片</div>
    </aside>
  );
}
