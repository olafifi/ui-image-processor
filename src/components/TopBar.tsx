import { Icon } from './Icon';

export function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">
        <strong>UI 图片处理器</strong>
        <span>本地处理 · PNG 工作流</span>
      </div>

      <nav className="primary-actions" aria-label="核心功能">
        <button className="action primary" type="button">
          <Icon name="upload" />
          导入图片
        </button>
        <button className="action" type="button">
          <Icon name="template" />
          套用模板
        </button>
        <button className="action" type="button">
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
