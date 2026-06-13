import { Icon } from './Icon';
import type { AppMode } from '../types';

interface ToolBarProps {
  samMode: AppMode;
}

export function ToolBar({ samMode }: ToolBarProps) {
  const samDisabled = samMode === 'degraded';

  return (
    <div className="toolbar">
      <div className="tool-group">
        <span className="group-label">选择与修补</span>
        <button className="tool-btn tool-active" disabled={samDisabled} title="SAM 点选" type="button">
          <Icon name="selectAdd" />
          SAM 点选
        </button>
        <button className="tool-btn" disabled={samDisabled} title="反点选" type="button">
          <Icon name="selectSubtract" />
          反点选
        </button>
        <button className="tool-btn" title="橡皮擦" type="button">
          <Icon name="eraser" />
          橡皮擦
        </button>
        <button className="tool-btn" title="恢复画笔" type="button">
          <Icon name="brush" />
          恢复
        </button>
        <button className="tool-btn" title="裁剪" type="button">
          <Icon name="crop" />
          裁剪
        </button>
      </div>

      <div className="tool-group history">
        <span className="group-label">历史</span>
        <button aria-label="撤销" className="history-btn" title="撤销" type="button">
          <Icon name="undo" />
        </button>
        <button aria-label="重做" className="history-btn" title="重做" type="button">
          <Icon name="redo" />
        </button>
      </div>
    </div>
  );
}
