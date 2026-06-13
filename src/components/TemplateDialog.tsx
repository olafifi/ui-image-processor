import type { Template, TemplateDraft } from '../lib/templateStore';

interface TemplateDialogProps {
  templates: Template[];
  onClose: () => void;
  onSave: (template: TemplateDraft) => void;
}

const defaultTemplate: TemplateDraft = {
  name: '透明 UI 参考',
  crop: {
    ratio: '1:1',
    x: 0,
    y: 0,
    width: 1,
    height: 1
  },
  exportSettings: {
    format: 'png',
    width: 1024,
    height: 1024,
    backgroundType: 'transparent',
    backgroundColor: '#ffffff',
    cornerRadius: 24
  },
  namingRule: 'ui_ref_{n}'
};

export function TemplateDialog({ templates, onClose, onSave }: TemplateDialogProps) {
  return (
    <div className="modal-backdrop">
      <section aria-labelledby="template-dialog-title" className="modal" role="dialog">
        <header className="modal-header">
          <h2 id="template-dialog-title">模板</h2>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </header>

        <p className="modal-copy">模板会记住裁剪比例、输出尺寸、圆角、背景、导出格式和命名规则。</p>

        <button onClick={() => onSave(defaultTemplate)} type="button">
          保存当前设置为模板
        </button>

        <div className="template-list">
          {templates.length === 0 ? (
            <p>还没有保存模板。</p>
          ) : (
            templates.map((template) => (
              <button key={template.id} type="button">
                {template.name}
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
