import { describe, expect, it } from 'vitest';
import { applyBrushEditToImageData } from './cutoutEdit';

function makeImageData(width: number, height: number, pixel: [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data.set(pixel, index * 4);
  }
  return new ImageData(data, width, height);
}

function pixelAt(imageData: ImageData, x: number, y: number) {
  const index = (y * imageData.width + x) * 4;
  return Array.from(imageData.data.slice(index, index + 4));
}

describe('cutout edit', () => {
  it('erases pixels under the brush radius', () => {
    const original = makeImageData(5, 5, [200, 40, 40, 255]);
    const processed = makeImageData(5, 5, [200, 40, 40, 255]);

    const result = applyBrushEditToImageData({
      mode: 'erase',
      original,
      processed,
      radius: 1,
      x: 2,
      y: 2
    });

    expect(pixelAt(result, 2, 2)).toEqual([200, 40, 40, 0]);
    expect(pixelAt(result, 0, 0)).toEqual([200, 40, 40, 255]);
  });

  it('restores original pixels under the brush radius', () => {
    const original = makeImageData(5, 5, [20, 120, 240, 255]);
    const processed = makeImageData(5, 5, [20, 120, 240, 0]);

    const result = applyBrushEditToImageData({
      mode: 'restore',
      original,
      processed,
      radius: 1,
      x: 2,
      y: 2
    });

    expect(pixelAt(result, 2, 2)).toEqual([20, 120, 240, 255]);
    expect(pixelAt(result, 0, 0)).toEqual([20, 120, 240, 0]);
  });
});
