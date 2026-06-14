import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { Icon } from './Icon';
import { ToolBar } from './ToolBar';
import {
  getCropPixelSize,
  getContainedImageRect,
  moveCropByPixels,
  resizeCropByPixels,
  type CropResizeHandle,
  type Rect
} from '../lib/crop';
import { resolveExportSize } from '../lib/canvasExport';
import type { AppMode, CropRatio, CropRect, CutoutEditRequest, EditorTool, ImageQueueItem } from '../types';

const cropRatios: Array<{ label: string; value: CropRatio }> = [
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '自由', value: 'free' }
];

const cropHandles: Array<{ className: string; handle: CropResizeHandle; label: string }> = [
  { className: 'crop-handle-nw', handle: 'north-west', label: '调整裁剪框左上角' },
  { className: 'crop-handle-ne', handle: 'north-east', label: '调整裁剪框右上角' },
  { className: 'crop-handle-sw', handle: 'south-west', label: '调整裁剪框左下角' },
  { className: 'crop-handle-se', handle: 'south-east', label: '调整裁剪框右下角' }
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
  onAutoCutoutAll: () => void;
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
  onAutoCutoutAll,
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
  const strokePointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const interactionRef = useRef<null | {
    crop: CropRect;
    handle?: CropResizeHandle;
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
  const crop = activeItem?.crop;
  const sourceSize = activeItem
    ? {
        width: activeItem.naturalWidth || 1,
        height: activeItem.naturalHeight || 1
      }
    : { width: 1, height: 1 };
  const cropSize = crop
    ? getCropPixelSize(crop, sourceSize.width, sourceSize.height)
    : {
        width: 0,
        height: 0
      };
  const outputSize =
    activeItem && crop
      ? resolveExportSize(sourceSize, crop, activeItem.exportSettings)
      : {
          width: 0,
          height: 0
        };
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
  const canEditCrop = activeTool === 'crop' && Boolean(crop);
  const canEditCutout = Boolean(activeItem && activeTool !== 'crop');
  const previewCornerRadius =
    activeItem && crop
      ? getPreviewCornerRadius(activeItem.exportSettings.cornerRadius, crop, imageRect, outputSize)
      : 0;

  function beginCropMove(event: PointerEvent<HTMLDivElement>) {
    if (!crop || !canEditCrop) {
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

  function beginCropResize(event: PointerEvent<HTMLButtonElement>, handle: CropResizeHandle) {
    if (!crop || !canEditCrop) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      crop,
      handle,
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
    const interactionRect = getInteractionImageRect(event.currentTarget, imageRect);
    const nextCrop =
      interaction.type === 'move'
        ? moveCropByPixels(interaction.crop, deltaX, deltaY, interactionRect)
        : resizeCropByPixels(
            interaction.crop,
            interaction.handle ?? 'south-east',
            deltaX,
            deltaY,
            interactionRect
          );

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
      strokePointsRef.current = [];
      addStrokePoint(event);
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
    addStrokePoint(event);
  }

  function cancelImageEdit() {
    editDragRef.current = false;
    strokePointsRef.current = [];
  }

  function finishImageEdit(event: PointerEvent<HTMLDivElement>) {
    if (!editDragRef.current || (activeTool !== 'eraser' && activeTool !== 'restore')) {
      cancelImageEdit();
      return;
    }

    event.preventDefault();
    editDragRef.current = false;
    const points = strokePointsRef.current;
    strokePointsRef.current = [];

    if (points.length === 0) {
      return;
    }

    onCutoutEdit({
      mode: activeTool === 'eraser' ? 'erase' : 'restore',
      points,
      radius: brushSize,
      x: points[0].x,
      y: points[0].y
    });
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

  function addStrokePoint(event: PointerEvent<HTMLDivElement>) {
    const point = getImagePoint(event, activeItem);
    if (!point) {
      return;
    }

    const points = strokePointsRef.current;
    const lastPoint = points.at(-1);
    if (lastPoint && Math.hypot(lastPoint.x - point.x, lastPoint.y - point.y) < 1) {
      return;
    }

    points.push(point);
  }

  return (
    <main className="center">
      <ToolBar
        activeTool={activeTool}
        brushSize={brushSize}
        canEdit={Boolean(activeItem)}
        canRedo={canRedo}
        canUndo={canUndo}
        onAutoCutoutAll={onAutoCutoutAll}
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
                onPointerCancel={cancelImageEdit}
                onPointerDown={beginImageEdit}
                onPointerMove={moveImageEdit}
                onPointerUp={finishImageEdit}
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
                    className={canEditCrop ? 'crop-frame crop-frame-editable' : 'crop-frame'}
                    onPointerCancel={endCropInteraction}
                    onPointerDown={beginCropMove}
                    onPointerMove={updateCropFromPointer}
                    onPointerUp={endCropInteraction}
                    style={{
                      borderRadius: `${previewCornerRadius}px`,
                      height: `${crop.height * 100}%`,
                      left: `${crop.x * 100}%`,
                      top: `${crop.y * 100}%`,
                      width: `${crop.width * 100}%`
                    }}
                  >
                    {canEditCrop &&
                      cropHandles.map((handle) => (
                        <button
                          aria-label={handle.label}
                          className={`crop-handle ${handle.className}`}
                          key={handle.handle}
                          onPointerCancel={endCropInteraction}
                          onPointerDown={(event) => beginCropResize(event, handle.handle)}
                          onPointerMove={updateCropFromPointer}
                          onPointerUp={endCropInteraction}
                          type="button"
                        />
                      ))}
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
          裁剪：{cropSize.width} x {cropSize.height} · 导出：{exportFormat} · {outputSize.width} x {outputSize.height}
        </span>
      </div>
    </main>
  );
}

function getInteractionImageRect(target: HTMLElement, fallback: Rect): Rect {
  const layer = target.closest('.image-fit-layer');
  if (layer instanceof HTMLElement) {
    const rect = layer.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        x: 0,
        y: 0,
        width: rect.width,
        height: rect.height
      };
    }
  }

  return fallback;
}

function getPreviewCornerRadius(
  cornerRadius: number,
  crop: CropRect,
  imageRect: Rect,
  outputSize: { width: number; height: number }
): number {
  if (cornerRadius <= 0 || outputSize.width <= 0 || outputSize.height <= 0) {
    return 0;
  }

  const frameWidth = crop.width * imageRect.width;
  const frameHeight = crop.height * imageRect.height;
  if (frameWidth <= 0 || frameHeight <= 0) {
    return 0;
  }

  const scale = Math.min(frameWidth / outputSize.width, frameHeight / outputSize.height);
  return Math.round(Math.min(cornerRadius * scale, frameWidth / 2, frameHeight / 2));
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
