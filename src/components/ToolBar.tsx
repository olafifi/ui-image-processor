import { Icon } from './Icon';
import type { AppMode, EditorTool } from '../types';

interface ToolBarProps {
  activeTool: EditorTool;
  brushSize: number;
  canEdit: boolean;
  canRedo: boolean;
  canUndo: boolean;
  onChangeBrushSize: (size: number) => void;
  onChangeTool: (tool: EditorTool) => void;
  onRedo: () => void;
  onUndo: () => void;
  samMode: AppMode;
}

export function ToolBar({
  activeTool,
  brushSize,
  canEdit,
  canRedo,
  canUndo,
  onChangeBrushSize,
  onChangeTool,
  onRedo,
  onUndo,
  samMode
}: ToolBarProps) {
  const pointTitle = samMode === 'full' ? 'SAM 点选' : '智能点选';

  return (
    <div className="toolbar">
      <div className="tool-group">
        <span className="group-label">选择与修补</span>
        <ToolButton
          active={activeTool === 'selectAdd'}
          disabled={!canEdit}
          icon="selectAdd"
          label={pointTitle}
          onClick={() => onChangeTool('selectAdd')}
          title={pointTitle}
        />
        <ToolButton
          active={activeTool === 'selectSubtract'}
          disabled={!canEdit}
          icon="selectSubtract"
          label="反点选"
          onClick={() => onChangeTool('selectSubtract')}
          title="反点选"
        />
        <ToolButton
          active={activeTool === 'eraser'}
          disabled={!canEdit}
          icon="eraser"
          label="橡皮擦"
          onClick={() => onChangeTool('eraser')}
          title="橡皮擦"
        />
        <ToolButton
          active={activeTool === 'restore'}
          disabled={!canEdit}
          icon="brush"
          label="恢复"
          onClick={() => onChangeTool('restore')}
          title="恢复画笔"
        />
        <ToolButton
          active={activeTool === 'crop'}
          disabled={!canEdit}
          icon="crop"
          label="裁剪"
          onClick={() => onChangeTool('crop')}
          title="裁剪"
        />

        {(activeTool === 'eraser' || activeTool === 'restore') && (
          <label className="brush-size">
            <span>笔刷</span>
            <input
              aria-label="笔刷大小"
              max={160}
              min={4}
              onChange={(event) => onChangeBrushSize(Number(event.currentTarget.value))}
              type="range"
              value={brushSize}
            />
            <strong>{brushSize}px</strong>
          </label>
        )}
      </div>

      <div className="tool-group history">
        <span className="group-label">历史</span>
        <button
          aria-label="撤销"
          className="history-btn"
          disabled={!canUndo}
          onClick={onUndo}
          title="撤销"
          type="button"
        >
          <Icon name="undo" />
        </button>
        <button
          aria-label="重做"
          className="history-btn"
          disabled={!canRedo}
          onClick={onRedo}
          title="重做"
          type="button"
        >
          <Icon name="redo" />
        </button>
      </div>
    </div>
  );
}

interface ToolButtonProps {
  active: boolean;
  disabled: boolean;
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onClick: () => void;
  title: string;
}

function ToolButton({ active, disabled, icon, label, onClick, title }: ToolButtonProps) {
  return (
    <button
      className={active ? 'tool-btn tool-active' : 'tool-btn'}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      <Icon name={icon} />
      {label}
    </button>
  );
}
