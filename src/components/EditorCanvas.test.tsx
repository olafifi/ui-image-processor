import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorCanvas } from './EditorCanvas';
import type { CropRect, ExportSettings, ImageQueueItem } from '../types';

describe('EditorCanvas cutout brush', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn()
    });
  });

  it('commits one brush stroke after drag instead of one edit per pointer move', () => {
    const onCutoutEdit = vi.fn();
    const { container } = render(
      <EditorCanvas
        activeItem={makeItem()}
        activeTool="eraser"
        brushSize={32}
        canRedo={false}
        canUndo={false}
        onChangeBrushSize={vi.fn()}
        onChangeCrop={vi.fn()}
        onChangeCropRatio={vi.fn()}
        onChangeTool={vi.fn()}
        onAutoCutoutAll={vi.fn()}
        onCutoutEdit={onCutoutEdit}
        onImageLoaded={vi.fn()}
        onImportFiles={vi.fn()}
        onRedo={vi.fn()}
        onToggleRounded={vi.fn()}
        onUndo={vi.fn()}
        onUseTransparentBackground={vi.fn()}
        samMode="degraded"
      />
    );
    const layer = container.querySelector<HTMLElement>('.image-fit-layer');
    expect(layer).not.toBeNull();
    layer!.getBoundingClientRect = () =>
      ({
        bottom: 100,
        height: 100,
        left: 0,
        right: 100,
        top: 0,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect;

    fireEvent.pointerDown(layer!, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(layer!, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(layer!, { clientX: 30, clientY: 30, pointerId: 1 });

    expect(onCutoutEdit).not.toHaveBeenCalled();

    fireEvent.pointerUp(layer!, { clientX: 30, clientY: 30, pointerId: 1 });

    expect(onCutoutEdit).toHaveBeenCalledTimes(1);
    expect(onCutoutEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'erase',
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
          { x: 30, y: 30 }
        ],
        radius: 32
      })
    );
  });

  it('allows fixed ratio crop frames to be resized from a corner', () => {
    const onChangeCrop = vi.fn();
    const { container } = render(
      <EditorCanvas
        activeItem={makeItem({
          naturalWidth: 1600,
          naturalHeight: 900,
          crop: { ratio: '16:9', x: 0.1, y: 0.1, width: 0.6, height: 0.6 }
        })}
        activeTool="crop"
        brushSize={32}
        canRedo={false}
        canUndo={false}
        onChangeBrushSize={vi.fn()}
        onChangeCrop={onChangeCrop}
        onChangeCropRatio={vi.fn()}
        onChangeTool={vi.fn()}
        onAutoCutoutAll={vi.fn()}
        onCutoutEdit={vi.fn()}
        onImageLoaded={vi.fn()}
        onImportFiles={vi.fn()}
        onRedo={vi.fn()}
        onToggleRounded={vi.fn()}
        onUndo={vi.fn()}
        onUseTransparentBackground={vi.fn()}
        samMode="degraded"
      />
    );
    const layer = container.querySelector<HTMLElement>('.image-fit-layer');
    expect(layer).not.toBeNull();
    layer!.getBoundingClientRect = () =>
      ({
        bottom: 900,
        height: 900,
        left: 0,
        right: 1600,
        top: 0,
        width: 1600,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect;

    const handle = screen.getByLabelText('调整裁剪框右下角');
    fireEvent.pointerDown(handle, { clientX: 1120, clientY: 630, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 1280, clientY: 630, pointerId: 1 });

    expect(onChangeCrop).toHaveBeenCalledWith(
      expect.objectContaining({
        ratio: '16:9',
        width: 0.7,
        height: expect.closeTo(0.7, 5)
      })
    );
  });

  it('shows live crop dimensions next to the export dimensions', () => {
    render(
      <EditorCanvas
        activeItem={makeItem({
          naturalWidth: 1600,
          naturalHeight: 900,
          crop: { ratio: '4:3', x: 0.125, y: 0, width: 0.75, height: 1 },
          exportSettings: { sizeMode: 'crop', width: 0, height: 0 }
        })}
        activeTool="crop"
        brushSize={32}
        canRedo={false}
        canUndo={false}
        onChangeBrushSize={vi.fn()}
        onChangeCrop={vi.fn()}
        onChangeCropRatio={vi.fn()}
        onChangeTool={vi.fn()}
        onAutoCutoutAll={vi.fn()}
        onCutoutEdit={vi.fn()}
        onImageLoaded={vi.fn()}
        onImportFiles={vi.fn()}
        onRedo={vi.fn()}
        onToggleRounded={vi.fn()}
        onUndo={vi.fn()}
        onUseTransparentBackground={vi.fn()}
        samMode="degraded"
      />
    );

    expect(screen.getByText(/裁剪：1200 x 900/)).toBeInTheDocument();
    expect(screen.getByText(/导出：PNG · 1200 x 900/)).toBeInTheDocument();
  });
});

type ImageQueueItemOverrides = Partial<Omit<ImageQueueItem, 'crop' | 'exportSettings'>> & {
  crop?: Partial<CropRect>;
  exportSettings?: Partial<ExportSettings>;
};

function makeItem(overrides: ImageQueueItemOverrides = {}): ImageQueueItem {
  return {
    id: 'image-1',
    sourceFile: new File(['image'], 'cat.png', { type: 'image/png' }),
    originalName: 'cat.png',
    targetName: '',
    mimeType: 'image/png',
    previewUrl: 'blob:cat.png',
    processedPreviewUrl: 'data:image/png;base64,processed',
    baseCutoutUrl: 'data:image/png;base64,processed',
    cutoutStatus: 'ready',
    cutoutKind: 'fake-checkerboard',
    cutoutMessage: '已自动抠图',
    editHistory: ['blob:cat.png', 'data:image/png;base64,processed'],
    editHistoryIndex: 1,
    naturalWidth: 100,
    naturalHeight: 100,
    ...overrides,
    crop: {
      ratio: '1:1',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      ...overrides.crop
    },
    exportSettings: {
      format: 'png',
      sizeMode: 'custom',
      width: 100,
      height: 100,
      backgroundType: 'transparent',
      backgroundColor: '#ffffff',
      cornerRadius: 0,
      compressionMode: 'source-size',
      jpegQuality: 88,
      ...overrides.exportSettings
    }
  };
}
