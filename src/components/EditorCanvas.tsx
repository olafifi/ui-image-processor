import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { Icon } from './Icon';
import { ToolBar } from './ToolBar';
import {
  getContainedImageRect,
  moveCropByPixels,
  resizeFreeCropByPixels,
  type Rect
} from '../lib/crop';
import type { AppMode, CropRatio, CropRect, CutoutEditRequest, EditorTool, ImageQueueItem } from '../types';

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
  activeTool: EditorTool;
  brushSize: number;
  canRedo: boolean;
  canUndo: boolean;
  onChangeBrushSize: (size: number) => void;
  onChangeCrop: (crop: CropRect) => void;
  onChangeCropRatio: (ratio: CropRatio) => void;
  onChangeTool: (tool: EditorTool) => void;
  onCutoutEdit: (edit: CutoutEditRequest) => void;
  onImageLoaded: (id: string, width: number, height: number) => void;
  onImportFiles: (files: Iterable<File>) => void;
  onRedo: () => void;
  onToggleRounded: () => void;
  onUndo: () => void;
  onUseTransparentBackground: () => void;
  samMode: AppMode;
}

export function EditorCanvas({
  activeItem,
  activeTool,
  brushSize,
  canRedo,
  canUndo,
  onChangeBrushSize,
  onChangeCrop,
  onChangeCropRatio,
  onChangeTool,
  onCutoutEdit,
  onImageLoaded,
  onImportFiles,
  onRedo,
  onToggleRounded,
  onUndo,
  onUseTransparentBackground,
  samMode
}: EditorCanvasProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const editDragRef = useRef(false);
  const interactionRef = useRef<null | {
    crop: CropRect;
    startX: number;
    startY: number;
    type: 'move' | 'resize';
  }>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    onImportFiles(event.dataTransfer.files);
  }

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

  const displayUrl = activeItem?.processedPreviewUrl ?? activeItem?.previewUrl;
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
  const canEditFreeCrop = activeTool === 'crop' && crop?.ratio === 'free';
  const canEditCutout = Boolean(activeItem && activeTool !== 'crop');

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

  function beginImageEdit(event: PointerEvent<HTMLDivElement>) {
    if (!canEditCutout) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    if (activeTool === 'eraser' || activeTool === 'restore') {
      editDragRef.current = true;
      commitPointerEdit(event);
      return;
    }

    if (activeTool === 'selectAdd' || activeTool === 'selectSubtract') {
      commitPointerEdit(event);
    }
  }

  function moveImageEdit(event: PointerEvent<HTMLDivElement>) {
    if (!editDragRef.current || (activeTool !== 'eraser' && activeTool !== 'restore')) {
      return;
    }

    event.preventDefault();
    commitPointerEdit(event);
  }

  function endImageEdit() {
    editDragRef.current = false;
  }

  function commitPointerEdit(event: PointerEvent<HTMLDivElement>) {
    const point = getImagePoint(event, activeItem);
    if (!point) {
      return;
    }

    const modeByTool: Record<Exclude<EditorTool, 'crop'>, CutoutEditRequest['mode']> = {
      eraser: 'erase',
      restore: 'restore',
      selectAdd: 'point-restore',
      selectSubtract: 'point-erase'
    };

    onCutoutEdit({
      mode: modeByTool[activeTool as Exclude<EditorTool, 'crop'>],
      radius: brushSize,
      x: point.x,
      y: point.y
    });
  }

  return (
    <main className="center">
      <ToolBar
        activeTool={activeTool}
        brushSize={brushSize}
        canEdit={Boolean(activeItem)}
        canRedo={canRedo}
        canUndo={canUndo}
        onChangeBrushSize={onChangeBrushSize}
        onChangeTool={onChangeTool}
        onRedo={onRedo}
        onUndo={onUndo}
        samMode={samMode}
      />

      <section
        className="stage"
        aria-label="图片编辑画布"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="drop-overlay">可直接拖入单张或多张图片</div>
        <div className={activeItem ? 'canvas has-image' : 'canvas'}>
          {activeItem && displayUrl ? (
            <div className="canvas-preview" ref={previewRef}>
              <div
                className={canEditCutout ? 'image-fit-layer cutout-interactive' : 'image-fit-layer'}
                onPointerCancel={endImageEdit}
                onPointerDown={beginImageEdit}
                onPointerMove={moveImageEdit}
                onPointerUp={endImageEdit}
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
                  src={displayUrl}
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
              {activeItem.cutoutStatus !== 'idle' && (
                <div className={`cutout-status cutout-status-${activeItem.cutoutStatus}`}>
                  {activeItem.cutoutStatus === 'processing' ? '正在自动抠图...' : activeItem.cutoutMessage}
                </div>
              )}
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

function getImagePoint(event: PointerEvent<HTMLDivElement>, activeItem?: ImageQueueItem) {
  if (!activeItem) {
    return undefined;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }

  const xRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const yRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  const width = activeItem.naturalWidth || 1;
  const height = activeItem.naturalHeight || 1;
  return {
    x: xRatio * width,
    y: yRatio * height
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
