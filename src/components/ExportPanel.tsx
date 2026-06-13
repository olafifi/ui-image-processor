import { Icon } from './Icon';

interface ExportPanelProps {
  onOpenTemplate: () => void;
}

export function ExportPanel({ onOpenTemplate }: ExportPanelProps) {
  return (
    <aside className="panel">
      <div className="side-title">
        <span>模板与导出</span>
        <button className="ghost-button" type="button">
          收起
        </button>
      </div>

      <div className="field">
        <strong>当前模板</strong>
        透明 UI 参考
      </div>
      <div className="field">
        <strong>输出尺寸</strong>
        1024 x 1024
      </div>
      <div className="field">
        <strong>背景</strong>
        透明 / 纯色
      </div>
      <div className="field">
        <strong>命名规则</strong>
        ui_ref_{'{n}'}
      </div>

      <div className="spacer" />
      <div className="export-group">
        <button onClick={onOpenTemplate} type="button">
          <Icon name="save" />
          保存模板
        </button>
        <button className="export-primary" type="button">
          <Icon name="download" />
          导出当前 PNG
        </button>
        <button type="button">
          <Icon name="zip" />
          下载 ZIP
        </button>
      </div>
    </aside>
  );
}
