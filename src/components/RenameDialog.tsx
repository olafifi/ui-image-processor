import { useState } from 'react';
import { buildRenameCsv, parseRenameCsvBuffer, parseRenameXlsx } from '../lib/csvRename';
import type { RenameMapping } from '../types';

interface RenameDialogProps {
  oldFilenames: string[];
  onClose: () => void;
  onApplyMappings: (mappings: RenameMapping[]) => void;
}

export function RenameDialog({ oldFilenames, onClose, onApplyMappings }: RenameDialogProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const [mappedCount, setMappedCount] = useState(0);

  function downloadTemplate() {
    const csv = buildRenameCsv(oldFilenames);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rename-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleRenameFile(file: File) {
    const buffer = await file.arrayBuffer();
    const result = isXlsxFile(file)
      ? await parseRenameXlsx(buffer, oldFilenames)
      : parseRenameCsvBuffer(buffer, oldFilenames);
    setErrors(result.errors);
    setMappedCount(result.mappings.filter((mapping) => mapping.newFilename).length);

    if (result.errors.length === 0) {
      onApplyMappings(result.mappings);
    }
  }

  return (
    <div className="modal-backdrop">
      <section aria-labelledby="rename-dialog-title" className="modal" role="dialog">
        <header className="modal-header">
          <h2 id="rename-dialog-title">批量重命名</h2>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </header>

        <p className="modal-copy">下载 CSV 后在表格里填写新文件名，再上传回这里。</p>

        <div className="dialog-actions">
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
        </div>

        <div className="rename-status">
          <strong>当前图片数</strong>
          <span>{oldFilenames.length}</span>
        </div>
        <div className="rename-status">
          <strong>已映射新名字</strong>
          <span>{mappedCount}</span>
        </div>

        {errors.length > 0 && (
          <ul className="error-list">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function isXlsxFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.xlsx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}
