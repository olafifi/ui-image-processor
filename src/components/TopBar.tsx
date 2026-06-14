import { useRef } from 'react';
import { Icon } from './Icon';
import { ThemeSwitcher } from './ThemeSwitcher';
import type { AppMode, WorkspaceMode } from '../types';

interface TopBarProps {
  onImportFiles: (files: Iterable<File>) => void;
  onOpenEdit: () => void;
  onOpenRename: () => void;
  samMode: AppMode;
  workspaceMode: WorkspaceMode;
}

export function TopBar({
  onImportFiles,
  onOpenEdit,
  onOpenRename,
  samMode,
  workspaceMode
}: TopBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const brandIconUrl = `${import.meta.env.BASE_URL}favicon.svg`;

  return (
    <header className="topbar">
      <div className="brand">
        <img alt="" aria-hidden="true" className="brand-icon" src={brandIconUrl} />
        <div className="brand-copy">
          <strong>FIFI 图片处理</strong>
          <span>本地处理 · PNG 工作流</span>
        </div>
      </div>

      <nav className="primary-actions" aria-label="核心功能">
        <button className="action primary import-action" onClick={() => inputRef.current?.click()} type="button">
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
        <div className="workspace-actions" role="group" aria-label="工作区切换">
          <button
            aria-pressed={workspaceMode === 'edit'}
            className={workspaceMode === 'edit' ? 'workspace-action active' : 'workspace-action'}
            onClick={onOpenEdit}
            type="button"
          >
            <Icon name="crop" />
            抠图/裁剪
          </button>
          <button
            aria-pressed={workspaceMode === 'rename'}
            className={workspaceMode === 'rename' ? 'workspace-action active' : 'workspace-action'}
            onClick={onOpenRename}
            type="button"
          >
            <Icon name="rename" />
            批量重命名
          </button>
        </div>
      </nav>

      <div className="topbar-right">
        <ThemeSwitcher />
        <div className="status">
          <span className={samMode === 'full' ? 'dot' : 'dot degraded'} />
          {samMode === 'full' ? '本地模型模式' : '启发式兜底'}
        </div>
      </div>
    </header>
  );
}
