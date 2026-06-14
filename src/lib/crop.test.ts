import { describe, expect, it } from 'vitest';
import {
  fitCropToRatio,
  getCropPixelSize,
  getContainedImageRect,
  getCropFrameRect,
  moveCropByPixels,
  resizeCropByPixels,
  resizeFreeCropByPixels
} from './crop';

describe('crop helpers', () => {
  it('centers a portrait crop inside a wide image', () => {
    expect(fitCropToRatio(1600, 900, '9:16')).toEqual({
      ratio: '9:16',
      x: 0.341796875,
      y: 0,
      width: 0.31640625,
      height: 1
    });
  });

  it('centers a landscape crop inside a tall image', () => {
    expect(fitCropToRatio(900, 1600, '16:9')).toEqual({
      ratio: '16:9',
      x: 0,
      y: 0.341796875,
      width: 1,
      height: 0.31640625
    });
  });

  it('keeps the full crop for free ratio', () => {
    expect(fitCropToRatio(900, 1600, 'free')).toEqual({
      ratio: 'free',
      x: 0,
      y: 0,
      width: 1,
      height: 1
    });
  });

  it('calculates the real rendered image rect for object-fit contain', () => {
    expect(getContainedImageRect(1000, 500, 500, 1000)).toEqual({
      x: 375,
      y: 0,
      width: 250,
      height: 500
    });
  });

  it('draws ratio crop frames inside the rendered image rect', () => {
    const imageRect = getContainedImageRect(1000, 500, 500, 1000);
    const crop = fitCropToRatio(500, 1000, '1:1');

    expect(getCropFrameRect(crop, imageRect)).toEqual({
      x: 375,
      y: 125,
      width: 250,
      height: 250
    });
  });

  it('moves free crops in normalized image coordinates and clamps to image bounds', () => {
    expect(
      moveCropByPixels(
        { ratio: 'free', x: 0.1, y: 0.1, width: 0.4, height: 0.4 },
        200,
        50,
        { x: 0, y: 0, width: 1000, height: 500 }
      )
    ).toEqual({
      ratio: 'free',
      x: 0.3,
      y: 0.2,
      width: 0.4,
      height: 0.4
    });
  });

  it('resizes free crops from the south east handle and clamps minimum size', () => {
    expect(
      resizeFreeCropByPixels(
        { ratio: 'free', x: 0.1, y: 0.1, width: 0.4, height: 0.4 },
        'south-east',
        100,
        50,
        { x: 0, y: 0, width: 1000, height: 500 }
      )
    ).toEqual({
      ratio: 'free',
      x: 0.1,
      y: 0.1,
      width: 0.5,
      height: 0.5
    });
  });

  it('resizes fixed ratio crops from a corner without changing the ratio mode', () => {
    const resized = resizeCropByPixels(
      { ratio: '16:9', x: 0.1, y: 0.1, width: 0.6, height: 0.6 },
      'south-east',
      160,
      0,
      { x: 0, y: 0, width: 1600, height: 900 }
    );

    expect(resized.ratio).toBe('16:9');
    expect(resized.width).toBe(0.7);
    expect(resized.height).toBeCloseTo(0.7, 6);
  });

  it('resizes fixed ratio crops from the north west corner with the opposite corner anchored', () => {
    expect(
      resizeCropByPixels(
        { ratio: '1:1', x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
        'north-west',
        -100,
        -100,
        { x: 0, y: 0, width: 1000, height: 1000 }
      )
    ).toEqual({
      ratio: '1:1',
      x: 0.15,
      y: 0.15,
      width: 0.6,
      height: 0.6
    });
  });

  it('reports crop dimensions in source image pixels', () => {
    expect(
      getCropPixelSize({ ratio: '4:3', x: 0.125, y: 0, width: 0.75, height: 1 }, 1600, 900)
    ).toEqual({
      width: 1200,
      height: 900
    });
  });
});
