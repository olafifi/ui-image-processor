import type { CropRatio, CropRect } from '../types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropResizeHandle = 'south-east';

const RATIO_VALUE: Record<Exclude<CropRatio, 'free'>, number> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '16:9': 16 / 9,
  '9:16': 9 / 16
};

export function fitCropToRatio(imageWidth: number, imageHeight: number, ratio: CropRatio): CropRect {
  if (ratio === 'free' || imageWidth <= 0 || imageHeight <= 0) {
    return fullCrop(ratio);
  }

  const targetRatio = RATIO_VALUE[ratio];
  const imageRatio = imageWidth / imageHeight;

  if (imageRatio > targetRatio) {
    const width = targetRatio / imageRatio;
    return {
      ratio,
      x: (1 - width) / 2,
      y: 0,
      width,
      height: 1
    };
  }

  const height = imageRatio / targetRatio;
  return {
    ratio,
    x: 0,
    y: (1 - height) / 2,
    width: 1,
    height
  };
}

export function fullCrop(ratio: CropRatio = 'free'): CropRect {
  return {
    ratio,
    x: 0,
    y: 0,
    width: 1,
    height: 1
  };
}

export function getContainedImageRect(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number
): Rect {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height
  };
}

export function getCropFrameRect(crop: CropRect, imageRect: Rect): Rect {
  return {
    x: imageRect.x + crop.x * imageRect.width,
    y: imageRect.y + crop.y * imageRect.height,
    width: crop.width * imageRect.width,
    height: crop.height * imageRect.height
  };
}

export function moveCropByPixels(crop: CropRect, deltaX: number, deltaY: number, imageRect: Rect): CropRect {
  if (imageRect.width <= 0 || imageRect.height <= 0) {
    return crop;
  }

  return normalizeCrop({
    ...crop,
    x: crop.x + deltaX / imageRect.width,
    y: crop.y + deltaY / imageRect.height
  });
}

export function resizeFreeCropByPixels(
  crop: CropRect,
  handle: CropResizeHandle,
  deltaX: number,
  deltaY: number,
  imageRect: Rect
): CropRect {
  if (handle !== 'south-east' || imageRect.width <= 0 || imageRect.height <= 0) {
    return crop;
  }

  return normalizeCrop({
    ...crop,
    ratio: 'free',
    width: crop.width + deltaX / imageRect.width,
    height: crop.height + deltaY / imageRect.height
  });
}

function normalizeCrop(crop: CropRect): CropRect {
  const minSize = 0.05;
  const width = clamp(crop.width, minSize, 1);
  const height = clamp(crop.height, minSize, 1);
  const x = clamp(crop.x, 0, 1 - width);
  const y = clamp(crop.y, 0, 1 - height);

  return {
    ...crop,
    x: roundUnit(x),
    y: roundUnit(y),
    width: roundUnit(width),
    height: roundUnit(height)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundUnit(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
