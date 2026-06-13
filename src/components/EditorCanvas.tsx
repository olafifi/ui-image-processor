import type { DragEvent } from 'react';
import { Icon } from './Icon';
import { ToolBar } from './ToolBar';
import type { AppMode, CropRatio, ImageQueueItem } from '../types';

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
  onChangeCropRatio: (ratio: CropRatio) => void;
  onImageLoaded: (id: string, width: number, height: number) => void;
  onImportFiles: (files: Iterable<File>) => void;
  onToggleRounded: () => void;
  onUseTransparentBackground: () => void;
  samMode: AppMode;
}

export function EditorCanvas({
  activeItem,
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

  const exportFormat =
    activeItem?.exportSettings.backgroundType === 'transparent'
      ? 'PNG'
      : activeItem?.exportSettings.format === 'jpeg'
        ? 'JPG'
        : 'PNG';
  const width = activeItem?.exportSettings.width ?? 1024;
  const height = activeItem?.exportSettings.height ?? 1024;
  const crop = activeItem?.crop;

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
            <div className="canvas-preview">
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
                  className="crop-frame"
                  style={{
                    borderRadius: `${Math.min(activeItem.exportSettings.cornerRadius, 48)}px`,
                    height: `${crop.height * 100}%`,
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.width * 100}%`
                  }}
                />
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
