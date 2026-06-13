import { useRef } from 'react';
import { Icon } from './Icon';

interface TopBarProps {
  onImportFiles: (files: Iterable<File>) => void;
  onOpenRename: () => void;
  onOpenTemplate: () => void;
}

export function TopBar({ onImportFiles, onOpenRename, onOpenTemplate }: TopBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="topbar">
      <div className="brand">
        <strong>UI 图片处理器</strong>
        <span>本地处理 · PNG 工作流</span>
      </div>

      <nav className="primary-actions" aria-label="核心功能">
        <button className="action primary" onClick={() => inputRef.current?.click()} type="button">
          <Icon name="upload" />
          导入图片
        </button>
        <input
          accept="image/png,image/jpeg,image/webp"
          aria-label="导入图片文件"
          className="file-input"
          multiple
          onChange={(event) => {
            if (event.currentTarget.files) {
              onImportFiles(event.currentTarget.files);
              event.currentTarget.value = '';
            }
          }}
          ref={inputRef}
          type="file"
        />
        <button className="action" onClick={onOpenTemplate} type="button">
          <Icon name="template" />
          套用模板
        </button>
        <button className="action" onClick={onOpenRename} type="button">
          <Icon name="rename" />
          批量重命名
        </button>
      </nav>

      <div className="status">
        <span className="dot" />
        WebGPU 完整模式
      </div>
    </header>
  );
}
