import type { CropRatio, CropRect } from '../types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropResizeHandle = 'north-west' | 'north-east' | 'south-west' | 'south-east';

const MIN_CROP_SIZE = 0.05;

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

export function getCropPixelSize(
  crop: CropRect,
  imageWidth: number,
  imageHeight: number
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(crop.width * Math.max(1, imageWidth))),
    height: Math.max(1, Math.round(crop.height * Math.max(1, imageHeight)))
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

export function resizeCropByPixels(
  crop: CropRect,
  handle: CropResizeHandle,
  deltaX: number,
  deltaY: number,
  imageRect: Rect
): CropRect {
  if (imageRect.width <= 0 || imageRect.height <= 0 || crop.width <= 0 || crop.height <= 0) {
    return crop;
  }

  const growsEast = handle.endsWith('east');
  const growsSouth = handle.startsWith('south');
  const widthDelta = (growsEast ? deltaX : -deltaX) / imageRect.width;
  const heightDelta = (growsSouth ? deltaY : -deltaY) / imageRect.height;

  if (crop.ratio === 'free') {
    return placeResizedCrop(crop, handle, crop.width + widthDelta, crop.height + heightDelta);
  }

  const normalizedAspect = crop.width / crop.height;
  const proposedWidth = crop.width + widthDelta;
  const proposedHeight = crop.height + heightDelta;
  const widthChange = Math.abs(widthDelta / crop.width);
  const heightChange = Math.abs(heightDelta / crop.height);
  let nextWidth = widthChange >= heightChange ? proposedWidth : proposedHeight * normalizedAspect;
  let nextHeight = nextWidth / normalizedAspect;

  if (nextHeight < MIN_CROP_SIZE) {
    nextHeight = MIN_CROP_SIZE;
    nextWidth = nextHeight * normalizedAspect;
  }
  if (nextWidth < MIN_CROP_SIZE) {
    nextWidth = MIN_CROP_SIZE;
    nextHeight = nextWidth / normalizedAspect;
  }

  const maxWidth = growsEast ? 1 - crop.x : crop.x + crop.width;
  const maxHeight = growsSouth ? 1 - crop.y : crop.y + crop.height;
  if (nextWidth > maxWidth) {
    nextWidth = maxWidth;
    nextHeight = nextWidth / normalizedAspect;
  }
  if (nextHeight > maxHeight) {
    nextHeight = maxHeight;
    nextWidth = nextHeight * normalizedAspect;
  }

  return placeResizedCrop(crop, handle, nextWidth, nextHeight);
}

export function resizeFreeCropByPixels(
  crop: CropRect,
  handle: CropResizeHandle,
  deltaX: number,
  deltaY: number,
  imageRect: Rect
): CropRect {
  return resizeCropByPixels({ ...crop, ratio: 'free' }, handle, deltaX, deltaY, imageRect);
}

function placeResizedCrop(
  crop: CropRect,
  handle: CropResizeHandle,
  width: number,
  height: number
): CropRect {
  const growsEast = handle.endsWith('east');
  const growsSouth = handle.startsWith('south');

  return normalizeCrop({
    ...crop,
    x: growsEast ? crop.x : crop.x + crop.width - width,
    y: growsSouth ? crop.y : crop.y + crop.height - height,
    width,
    height
  });
}

function normalizeCrop(crop: CropRect): CropRect {
  const width = clamp(crop.width, MIN_CROP_SIZE, 1);
  const height = clamp(crop.height, MIN_CROP_SIZE, 1);
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
