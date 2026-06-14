import type { CropRect, ExportFormat, ExportSettings } from '../types';

export function normalizeExportSettings(settings: ExportSettings): ExportSettings {
  const normalized = {
    ...settings,
    sizeMode: settings.sizeMode ?? 'crop'
  };

  if (normalized.backgroundType === 'transparent' && normalized.format === 'jpeg') {
    return { ...normalized, format: 'png' };
  }

  return normalized;
}

export function extensionForFormat(format: ExportFormat): string {
  return format === 'jpeg' ? 'jpg' : 'png';
}

export function mimeForFormat(format: ExportFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : 'image/png';
}

export async function exportCanvasImage(
  source: CanvasImageSource,
  crop: CropRect,
  settings: ExportSettings
): Promise<Blob> {
  const normalized = normalizeExportSettings(settings);
  const sourceSize = getCanvasSourceSize(source);
  const outputSize = resolveExportSize(sourceSize, crop, normalized);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize.width;
  canvas.height = outputSize.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器无法创建 Canvas 2D 上下文');
  }

  if (normalized.backgroundType === 'solid') {
    context.fillStyle = normalized.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const sx = crop.x * sourceSize.width;
  const sy = crop.y * sourceSize.height;
  const sw = crop.width * sourceSize.width;
  const sh = crop.height * sourceSize.height;

  context.save();
  applyRoundedClip(context, canvas.width, canvas.height, normalized.cornerRadius);
  context.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  context.restore();

  return canvasToBlob(canvas, normalized.format);
}

export function resolveExportSize(
  sourceSize: { width: number; height: number },
  crop: CropRect,
  settings: ExportSettings
): { width: number; height: number } {
  const normalized = normalizeExportSettings(settings);
  if (normalized.sizeMode === 'custom') {
    return {
      width: Math.max(1, Math.round(normalized.width)),
      height: Math.max(1, Math.round(normalized.height))
    };
  }

  return {
    width: Math.max(1, Math.round(crop.width * sourceSize.width)),
    height: Math.max(1, Math.round(crop.height * sourceSize.height))
  };
}

function getCanvasSourceSize(source: CanvasImageSource): { width: number; height: number } {
  const candidate = source as {
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };

  const width = candidate.naturalWidth ?? candidate.videoWidth ?? candidate.width ?? 0;
  const height = candidate.naturalHeight ?? candidate.videoHeight ?? candidate.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new Error('图片尺寸无效，无法导出');
  }

  return { width, height };
}

function applyRoundedClip(context: CanvasRenderingContext2D, width: number, height: number, radius: number) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (safeRadius === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(safeRadius, 0);
  context.lineTo(width - safeRadius, 0);
  context.quadraticCurveTo(width, 0, width, safeRadius);
  context.lineTo(width, height - safeRadius);
  context.quadraticCurveTo(width, height, width - safeRadius, height);
  context.lineTo(safeRadius, height);
  context.quadraticCurveTo(0, height, 0, height - safeRadius);
  context.lineTo(0, safeRadius);
  context.quadraticCurveTo(0, 0, safeRadius, 0);
  context.closePath();
  context.clip();
}

function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('图片导出失败'));
          return;
        }

        resolve(blob);
      },
      mimeForFormat(format),
      format === 'jpeg' ? 0.92 : undefined
    );
  });
}
