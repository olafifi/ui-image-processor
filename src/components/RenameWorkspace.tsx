import { useMemo, useState } from 'react';
import { buildRenameCsv, parseRenameCsvBuffer, parseRenameXlsx } from '../lib/csvRename';
import type { ImageQueueItem, RenameMapping } from '../types';

interface RenameWorkspaceProps {
  activeId?: string;
  items: ImageQueueItem[];
  onApplyMappings: (mappings: RenameMapping[]) => void;
  onBack: () => void;
  onSelectItem: (id: string) => void;
  onUpdateTargetName: (id: string, targetName: string) => void;
}

export function RenameWorkspace({
  activeId,
  items,
  onApplyMappings,
  onBack,
  onSelectItem,
  onUpdateTargetName
}: RenameWorkspaceProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string>();
  const [showTable, setShowTable] = useState(true);
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0],
    [activeId, items]
  );
  const mappedCount = items.filter((item) => item.targetName.trim()).length;

  function downloadTemplate() {
    const csv = buildRenameCsv(items.map((item) => item.originalName));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rename-template.csv';
    link.click();
    URL.revokeObjectURL(url);
    setStatus('已下载命名 CSV');
  }

  async function handleRenameFile(file: File) {
    const expectedFilenames = items.map((item) => item.originalName);
    const buffer = await file.arrayBuffer();
    const result = isXlsxFile(file)
      ? await parseRenameXlsx(buffer, expectedFilenames)
      : parseRenameCsvBuffer(buffer, expectedFilenames);
    setErrors(result.errors);

    if (result.errors.length === 0) {
      onApplyMappings(result.mappings);
      setStatus(`已导入 ${result.mappings.filter((mapping) => mapping.newFilename).length} 个新名字`);
    } else {
      setStatus(undefined);
    }
  }

  return (
    <section aria-label="批量重命名工作区" className="rename-workspace">
      <header className="rename-header">
        <div>
          <strong>批量重命名</strong>
          <span>
            {items.length} 张图片 · {mappedCount} 个新名字
          </span>
        </div>
        <div className="rename-actions">
          <button onClick={downloadTemplate} type="button">
            下载命名 CSV
          </button>
          <label className="csv-upload">
            上传命名 CSV/XLSX
            <input
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="上传命名 CSV/XLSX"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  void handleRenameFile(file);
                  event.currentTarget.value = '';
                }
              }}
              type="file"
            />
          </label>
          <button onClick={() => setShowTable((current) => !current)} type="button">
            {showTable ? '隐藏当前表' : '查看当前表'}
          </button>
          <button className="ghost-button rename-back" onClick={onBack} type="button">
            返回抠图/裁剪
          </button>
        </div>
      </header>

      <div className="rename-body">
        <aside className="rename-list" aria-label="重命名图片列表">
          {items.length === 0 ? (
            <div className="rename-empty">先导入图片，再批量命名</div>
          ) : (
            items.map((item, index) => (
              <button
                className={item.id === activeItem?.id ? 'rename-list-item active' : 'rename-list-item'}
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                type="button"
              >
                <span>{index + 1}</span>
                <img alt="" src={item.processedPreviewUrl ?? item.previewUrl} />
                <strong>{item.originalName}</strong>
                <small>{item.targetName || '未填写新名字'}</small>
              </button>
            ))
          )}
        </aside>

        <main className="rename-preview">
          {activeItem ? (
            <>
              <img alt={activeItem.originalName} src={activeItem.processedPreviewUrl ?? activeItem.previewUrl} />
              <span>{activeItem.originalName}</span>
            </>
          ) : (
            <div className="rename-empty">没有可预览的图片</div>
          )}
        </main>

        <aside className="rename-detail">
          <div className="field">
            <strong>旧文件名</strong>
            <span>{activeItem?.originalName ?? '未选择图片'}</span>
          </div>
          <label className="field rename-name-field">
            <strong>新文件名</strong>
            <input
              disabled={!activeItem}
              onChange={(event) => {
                if (activeItem) {
                  onUpdateTargetName(activeItem.id, event.currentTarget.value);
                }
              }}
              placeholder="可不写扩展名"
              value={activeItem?.targetName ?? ''}
            />
          </label>
          <div className="field">
            <strong>导出规则</strong>
            <span>留空时沿用旧文件名；导出 PNG/JPG 时自动补扩展名。</span>
          </div>
          {status && <div className="panel-status">{status}</div>}
          {errors.length > 0 && (
            <ul className="error-list">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {showTable && (
        <div className="rename-table-wrap">
          <table className="rename-table">
            <thead>
              <tr>
                <th>#</th>
                <th>旧文件名</th>
                <th>新文件名</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.originalName}</td>
                  <td>{item.targetName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function isXlsxFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.xlsx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}
