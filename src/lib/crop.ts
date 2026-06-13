import type { CropRatio, CropRect } from '../types';

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
