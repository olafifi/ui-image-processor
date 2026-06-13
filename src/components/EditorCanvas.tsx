import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { Icon } from './Icon';
import { ToolBar } from './ToolBar';
import {
  getContainedImageRect,
  moveCropByPixels,
  resizeFreeCropByPixels,
  type Rect
} from '../lib/crop';
import type { AppMode, CropRatio, CropRect, ImageQueueItem } from '../types';

const cropRatios: Array<{ label: string; value: CropRatio }> = [
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '自由', value: 'free' }
];

interface EditorCanvasProps {
  activeItem?: ImageQueueItem;
  onChangeCrop: (crop: CropRect) => void;
  onChangeCropRatio: (ratio: CropRatio) => void;
  onImageLoaded: (id: string, width: number, height: number) => void;
  onImportFiles: (files: Iterable<File>) => void;
  onToggleRounded: () => void;
  onUseTransparentBackground: () => void;
  samMode: AppMode;
}

export function EditorCanvas({
  activeItem,
  onChangeCrop,
  onChangeCropRatio,
  onImageLoaded,
  onImportFiles,
  onToggleRounded,
  onUseTransparentBackground,
  samMode
}: EditorCanvasProps) {
  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    onImportFiles(event.dataTransfer.files);
  }

  const previewRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<null | {
    crop: CropRect;
    startX: number;
    startY: number;
    type: 'move' | 'resize';
  }>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) {
      return;
    }

    const updateSize = () => {
      const rect = preview.getBoundingClientRect();
      setPreviewSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(preview);
    return () => observer.disconnect();
  }, [activeItem?.id]);

  const exportFormat =
    activeItem?.exportSettings.backgroundType === 'transparent'
      ? 'PNG'
      : activeItem?.exportSettings.format === 'jpeg'
        ? 'JPG'
        : 'PNG';
  const width = activeItem?.exportSettings.width ?? 1024;
  const height = activeItem?.exportSettings.height ?? 1024;
  const crop = activeItem?.crop;
  const imageRect = useMemo<Rect>(() => {
    if (!activeItem || activeItem.naturalWidth <= 0 || activeItem.naturalHeight <= 0) {
      return { x: 0, y: 0, width: previewSize.width, height: previewSize.height };
    }

    return getContainedImageRect(
      previewSize.width,
      previewSize.height,
      activeItem.naturalWidth,
      activeItem.naturalHeight
    );
  }, [activeItem, previewSize.height, previewSize.width]);
  const canEditFreeCrop = crop?.ratio === 'free';

  function beginCropMove(event: PointerEvent<HTMLDivElement>) {
    if (!crop || !canEditFreeCrop) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      crop,
      startX: event.clientX,
      startY: event.clientY,
      type: 'move'
    };
  }

  function beginCropResize(event: PointerEvent<HTMLButtonElement>) {
    if (!crop || !canEditFreeCrop) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      crop,
      startX: event.clientX,
      startY: event.clientY,
      type: 'resize'
    };
  }

  function updateCropFromPointer(event: PointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    if (!interaction) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;
    const nextCrop =
      interaction.type === 'move'
        ? moveCropByPixels(interaction.crop, deltaX, deltaY, imageRect)
        : resizeFreeCropByPixels(interaction.crop, 'south-east', deltaX, deltaY, imageRect);

    onChangeCrop(nextCrop);
  }

  function endCropInteraction() {
    interactionRef.current = null;
  }

  return (
    <main className="center">
      <ToolBar samMode={samMode} />

      <section
        className="stage"
        aria-label="图片编辑画布"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="drop-overlay">可直接拖入单张或多张图片</div>
        <div className={activeItem ? 'canvas has-image' : 'canvas'}>
          {activeItem ? (
            <div className="canvas-preview" ref={previewRef}>
              <div
                className="image-fit-layer"
                style={{
                  height: `${imageRect.height}px`,
                  left: `${imageRect.x}px`,
                  top: `${imageRect.y}px`,
                  width: `${imageRect.width}px`
                }}
              >
                <img
                  alt={activeItem.originalName}
                  draggable={false}
                  onLoad={(event) =>
                    onImageLoaded(
                      activeItem.id,
                      event.currentTarget.naturalWidth,
                      event.currentTarget.naturalHeight
                    )
                  }
                  src={activeItem.previewUrl}
                />
                {crop && (
                  <div
                    className={canEditFreeCrop ? 'crop-frame crop-frame-editable' : 'crop-frame'}
                    onPointerCancel={endCropInteraction}
                    onPointerDown={beginCropMove}
                    onPointerMove={updateCropFromPointer}
                    onPointerUp={endCropInteraction}
                    style={{
                      borderRadius: `${Math.min(activeItem.exportSettings.cornerRadius, 48)}px`,
                      height: `${crop.height * 100}%`,
                      left: `${crop.x * 100}%`,
                      top: `${crop.y * 100}%`,
                      width: `${crop.width * 100}%`
                    }}
                  >
                    {canEditFreeCrop && (
                      <button
                        aria-label="调整裁剪框右下角"
                        className="crop-handle crop-handle-se"
                        onPointerCancel={endCropInteraction}
                        onPointerDown={beginCropResize}
                        onPointerMove={updateCropFromPointer}
                        onPointerUp={endCropInteraction}
                        type="button"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <span>拖入或导入图片后开始处理</span>
          )}
        </div>
      </section>

      <div className="cropbar">
        {cropRatios.map((ratio) => (
          <button
            className={crop?.ratio === ratio.value ? 'crop-active' : ''}
            disabled={!activeItem}
            key={ratio.value}
            onClick={() => onChangeCropRatio(ratio.value)}
            type="button"
          >
            {ratio.label}
          </button>
        ))}
        <button disabled={!activeItem} onClick={onToggleRounded} type="button">
          <Icon name="corner" />
          圆角
        </button>
        <button disabled={!activeItem} onClick={onUseTransparentBackground} type="button">
          <Icon name="transparent" />
          透明背景
        </button>
        <span className="summary">
          导出：{exportFormat} · {width} x {height}
        </span>
      </div>
    </main>
  );
}
