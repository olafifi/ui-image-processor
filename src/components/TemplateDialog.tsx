import type { Template, TemplateDraft } from '../lib/templateStore';

interface TemplateDialogProps {
  currentTemplate: TemplateDraft;
  onApply: (template: Template) => void;
  templates: Template[];
  onClose: () => void;
  onSave: (template: TemplateDraft) => void;
}

export function TemplateDialog({ currentTemplate, onApply, templates, onClose, onSave }: TemplateDialogProps) {
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

        <button onClick={() => onSave(currentTemplate)} type="button">
          保存当前设置为模板
        </button>

        <div className="template-list">
          {templates.length === 0 ? (
            <p>还没有保存模板。</p>
          ) : (
            templates.map((template) => (
              <button key={template.id} onClick={() => onApply(template)} type="button">
                {template.name}
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
