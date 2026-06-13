import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App layout', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((file: File | Blob) => `blob:${'name' in file ? file.name : 'download'}`),
      revokeObjectURL: vi.fn()
    });
  });

  it('shows core top actions and keeps zip in export panel', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /导入图片/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /套用模板/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /批量重命名/ })).toBeInTheDocument();
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
    expect(screen.getByLabelText('上传命名 CSV')).toBeInTheDocument();
    expect(screen.getAllByText('旧文件名').length).toBeGreaterThan(0);
    expect(screen.getAllByText('新文件名').length).toBeGreaterThan(0);
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

    render(<App exportImage={exportImage} loadImage={() => Promise.resolve(mockSource)} downloadBlob={downloadBlob} />);

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
