import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorCanvas } from './EditorCanvas';
import type { ImageQueueItem } from '../types';

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
});

function makeItem(): ImageQueueItem {
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
    crop: {
      ratio: '1:1',
      x: 0,
      y: 0,
      width: 1,
      height: 1
    },
    exportSettings: {
      format: 'png',
      width: 100,
      height: 100,
      backgroundType: 'transparent',
      backgroundColor: '#ffffff',
      cornerRadius: 0
    }
  };
}
