import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App layout', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((file: File | Blob) => `blob:${'name' in file ? file.name : 'download'}`),
      revokeObjectURL: vi.fn()
    });
  });

  const immediateCutout = vi.fn(async () => ({
    kind: 'fake-checkerboard' as const,
    message: '已自动抠图',
    processedPreviewUrl: 'data:image/png;base64,processed'
  }));

  it('shows core top actions and keeps zip in export panel', () => {
    render(<App />);

    const workspaceSwitcher = screen.getByRole('group', { name: '工作区切换' });
    expect(screen.getByRole('button', { name: /导入图片/ })).toBeInTheDocument();
    expect(within(workspaceSwitcher).getByRole('button', { name: /抠图\/裁剪/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(within(workspaceSwitcher).getByRole('button', { name: /套用模板/ })).toBeInTheDocument();
    expect(within(workspaceSwitcher).getByRole('button', { name: /批量重命名/ })).toBeInTheDocument();
    expect(screen.getByText('模板与导出')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /下载 ZIP/ })).toBeInTheDocument();
  });

  it('separates repair tools from history controls', () => {
    render(<App />);

    expect(screen.getByText('选择与修补')).toBeInTheDocument();
    expect(screen.getByText('历史')).toBeInTheDocument();
    expect(screen.getByTitle('撤销')).toBeInTheDocument();
    expect(screen.getByTitle('重做')).toBeInTheDocument();
  });

  it('shows all required crop ratios', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: '1:1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4:3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3:4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '16:9' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9:16' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '自由' })).toBeInTheDocument();
  });

  it('adds supported uploaded images to the queue', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(screen.getByLabelText('导入图片文件'), [
      new File(['webp'], 'card.webp', { type: 'image/webp' }),
      new File(['text'], 'note.txt', { type: 'text/plain' })
    ]);

    expect(screen.getByRole('button', { name: 'card.webp' })).toBeInTheDocument();
    expect(screen.queryByText('note.txt')).not.toBeInTheDocument();
  });

  it('opens the rename workspace from the top bar', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /批量重命名/ }));

    expect(screen.getByRole('region', { name: '批量重命名工作区' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载命名 CSV' })).toBeInTheDocument();
    expect(screen.getByLabelText('上传命名 CSV/XLSX')).toBeInTheDocument();
    expect(screen.getAllByText('旧文件名').length).toBeGreaterThan(0);
    expect(screen.getAllByText('新文件名').length).toBeGreaterThan(0);
  });

  it('switches back from rename workspace to the edit workspace without losing the active image', async () => {
    const user = userEvent.setup();
    render(<App autoCutout={immediateCutout} />);

    await user.upload(screen.getByLabelText('导入图片文件'), [
      new File(['image'], 'switch-test.webp', { type: 'image/webp' })
    ]);
    await user.click(screen.getByRole('button', { name: /批量重命名/ }));
    expect(screen.getByRole('region', { name: '批量重命名工作区' })).toBeInTheDocument();

    const workspaceSwitcher = screen.getByRole('group', { name: '工作区切换' });
    await user.click(within(workspaceSwitcher).getByRole('button', { name: /抠图\/裁剪/ }));

    expect(screen.queryByRole('region', { name: '批量重命名工作区' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'switch-test.webp' })).toBeInTheDocument();
    expect(within(workspaceSwitcher).getByRole('button', { name: /批量重命名/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(within(workspaceSwitcher).getByRole('button', { name: /抠图\/裁剪/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('imports xlsx rename mappings from the rename workspace', async () => {
    const user = userEvent.setup();
    render(<App autoCutout={immediateCutout} />);

    await user.upload(screen.getByLabelText('导入图片文件'), [
      new File(['image-a'], 'a.webp', { type: 'image/webp' }),
      new File(['image-b'], 'b.png', { type: 'image/png' })
    ]);
    await user.click(screen.getByRole('button', { name: /批量重命名/ }));

    const workbook = await buildRenameWorkbook([
      ['index', 'old_filename', 'new_filename'],
      ['1', 'a.webp', 'ui_cat_surprised'],
      ['2', 'b.png', 'ui_cat_angry']
    ]);
    await user.upload(
      screen.getByLabelText('上传命名 CSV/XLSX'),
      new File([workbook], 'rename.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
    );

    await waitFor(() => expect(screen.getByDisplayValue('ui_cat_surprised')).toBeInTheDocument());
    expect(screen.getAllByText('ui_cat_angry').length).toBeGreaterThan(0);
  });

  it('opens the template workflow from the top bar', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /套用模板/ }));

    expect(screen.getByRole('dialog', { name: '模板' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存当前设置为模板' })).toBeInTheDocument();
  });

  it('shows degraded mode when webgpu is unavailable', () => {
    render(<App />);

    expect(screen.getByText('降级模式')).toBeInTheDocument();
  });

  it('exports the active image through the current export button', async () => {
    const user = userEvent.setup();
    const exportImage = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
    const downloadBlob = vi.fn();
    const mockSource = { naturalWidth: 800, naturalHeight: 600 } as HTMLImageElement;

    render(
      <App
        autoCutout={immediateCutout}
        downloadBlob={downloadBlob}
        exportImage={exportImage}
        loadImage={() => Promise.resolve(mockSource)}
      />
    );

    await user.upload(screen.getByLabelText('导入图片文件'), [
      new File(['image'], 'card.webp', { type: 'image/webp' })
    ]);
    await user.click(screen.getByRole('button', { name: /导出当前 PNG/ }));

    expect(exportImage).toHaveBeenCalledWith(
      mockSource,
      expect.objectContaining({ ratio: '1:1' }),
      expect.objectContaining({ format: 'png' })
    );
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'card.png');
  });

  it('exports the processed preview when automatic cutout is ready', async () => {
    const user = userEvent.setup();
    const exportImage = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
    const downloadBlob = vi.fn();
    const mockSource = { naturalWidth: 800, naturalHeight: 600 } as HTMLImageElement;
    const loadImage = vi.fn(async () => mockSource);
    const autoCutout = vi.fn(async () => ({
      kind: 'fake-checkerboard' as const,
      message: '已去除伪透明背景',
      processedPreviewUrl: 'data:image/png;base64,processed'
    }));

    render(
      <App
        autoCutout={autoCutout}
        downloadBlob={downloadBlob}
        exportImage={exportImage}
        loadImage={loadImage}
      />
    );

    await user.upload(screen.getByLabelText('导入图片文件'), [
      new File(['image'], 'fake-transparent.png', { type: 'image/png' })
    ]);
    await waitFor(() => expect(autoCutout).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /导出当前 PNG/ }));

    expect(loadImage).toHaveBeenCalledWith('data:image/png;base64,processed');
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'fake-transparent.png');
  });

  it('waits for automatic cutout before exporting an image immediately after import', async () => {
    const user = userEvent.setup();
    const exportImage = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
    const downloadBlob = vi.fn();
    const mockSource = { naturalWidth: 800, naturalHeight: 600 } as HTMLImageElement;
    const loadImage = vi.fn(async () => mockSource);
    let resolveCutout!: (value: {
      kind: 'fake-checkerboard';
      message: string;
      processedPreviewUrl: string;
    }) => void;
    const cutoutPromise = new Promise<{
      kind: 'fake-checkerboard';
      message: string;
      processedPreviewUrl: string;
    }>((resolve) => {
      resolveCutout = resolve;
    });
    const autoCutout = vi.fn(() => cutoutPromise);

    render(
      <App
        autoCutout={autoCutout}
        downloadBlob={downloadBlob}
        exportImage={exportImage}
        loadImage={loadImage}
      />
    );

    await user.upload(screen.getByLabelText('导入图片文件'), [
      new File(['image'], 'quick-export.png', { type: 'image/png' })
    ]);
    await waitFor(() => expect(autoCutout).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /导出当前 PNG/ }));

    expect(loadImage).not.toHaveBeenCalledWith('blob:quick-export.png');

    resolveCutout({
      kind: 'fake-checkerboard',
      message: '已自动抠图',
      processedPreviewUrl: 'data:image/png;base64,processed-quick'
    });

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'quick-export.png'));
    expect(loadImage).toHaveBeenCalledWith('data:image/png;base64,processed-quick');
  });

  it('exports all queued images into a zip', async () => {
    const user = userEvent.setup();
    const exportImage = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
    const createZip = vi.fn(async () => new Blob(['zip'], { type: 'application/zip' }));
    const downloadBlob = vi.fn();
    const mockSource = { naturalWidth: 800, naturalHeight: 600 } as HTMLImageElement;

    render(
      <App
        createZip={createZip}
        downloadBlob={downloadBlob}
        exportImage={exportImage}
        autoCutout={immediateCutout}
        loadImage={() => Promise.resolve(mockSource)}
      />
    );

    await user.upload(screen.getByLabelText('导入图片文件'), [
      new File(['image'], 'card.webp', { type: 'image/webp' }),
      new File(['image'], 'icon.jpg', { type: 'image/jpeg' })
    ]);
    await user.click(screen.getByRole('button', { name: /下载 ZIP/ }));

    expect(exportImage).toHaveBeenCalledTimes(2);
    expect(createZip).toHaveBeenCalledWith(
      [
        expect.objectContaining({ originalName: 'card.webp', targetName: '' }),
        expect.objectContaining({ originalName: 'icon.jpg', targetName: '' })
      ],
      'png'
    );
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'ui-image-processor.zip');
  });
});

async function buildRenameWorkbook(rows: string[][]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const sharedStrings = rows.flat();
  const sharedStringXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map((value) => `<si><t>${escapeXml(value)}</t></si>`).join('')}
</sst>`;
  let sharedStringIndex = 0;
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((_, columnIndex) => {
          const cell = `${columnName(columnIndex)}${rowIndex + 1}`;
          return `<c r="${cell}" t="s"><v>${sharedStringIndex++}</v></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types" />'
  );
  zip.file(
    'xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
  );
  zip.file('xl/sharedStrings.xml', sharedStringXml);
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`
  );

  return zip.generateAsync({ type: 'arraybuffer' });
}

function columnName(index: number): string {
  let name = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - remainder) / 26);
  }
  return name;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
