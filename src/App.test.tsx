import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App layout', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
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
});
