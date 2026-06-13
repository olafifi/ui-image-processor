import { describe, expect, it } from 'vitest';
import { removeBackgroundFromImageData } from './backgroundRemoval';

function makeImageData(width: number, height: number, pixel: [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data.set(pixel, index * 4);
  }
  return new ImageData(data, width, height);
}

function setPixel(imageData: ImageData, x: number, y: number, pixel: [number, number, number, number]) {
  imageData.data.set(pixel, (y * imageData.width + x) * 4);
}

function alphaAt(imageData: ImageData, x: number, y: number) {
  return imageData.data[(y * imageData.width + x) * 4 + 3];
}

describe('background removal', () => {
  it('keeps real alpha instead of replacing it', () => {
    const imageData = makeImageData(3, 3, [255, 255, 255, 255]);
    setPixel(imageData, 0, 0, [255, 255, 255, 0]);

    const result = removeBackgroundFromImageData(imageData);

    expect(result.kind).toBe('existing-alpha');
    expect(alphaAt(result.imageData, 0, 0)).toBe(0);
    expect(alphaAt(result.imageData, 1, 1)).toBe(255);
  });

  it('turns a painted checkerboard background transparent', () => {
    const imageData = makeImageData(6, 6, [255, 255, 255, 255]);
    for (let y = 0; y < imageData.height; y += 1) {
      for (let x = 0; x < imageData.width; x += 1) {
        setPixel(imageData, x, y, (x + y) % 2 === 0 ? [245, 245, 245, 255] : [255, 255, 255, 255]);
      }
    }
    setPixel(imageData, 2, 2, [230, 80, 40, 255]);
    setPixel(imageData, 3, 2, [230, 80, 40, 255]);
    setPixel(imageData, 2, 3, [230, 80, 40, 255]);
    setPixel(imageData, 3, 3, [230, 80, 40, 255]);

    const result = removeBackgroundFromImageData(imageData);

    expect(result.kind).toBe('fake-checkerboard');
    expect(alphaAt(result.imageData, 0, 0)).toBe(0);
    expect(alphaAt(result.imageData, 5, 5)).toBe(0);
    expect(alphaAt(result.imageData, 2, 2)).toBe(255);
  });

  it('does not delete an isolated white foreground region enclosed by an outline', () => {
    const imageData = makeImageData(7, 7, [252, 252, 252, 255]);
    for (let y = 0; y < imageData.height; y += 1) {
      for (let x = 0; x < imageData.width; x += 1) {
        setPixel(imageData, x, y, (x + y) % 2 === 0 ? [244, 244, 244, 255] : [252, 252, 252, 255]);
      }
    }
    for (let i = 2; i <= 4; i += 1) {
      setPixel(imageData, i, 2, [20, 20, 20, 255]);
      setPixel(imageData, i, 4, [20, 20, 20, 255]);
      setPixel(imageData, 2, i, [20, 20, 20, 255]);
      setPixel(imageData, 4, i, [20, 20, 20, 255]);
    }
    setPixel(imageData, 3, 3, [255, 255, 255, 255]);

    const result = removeBackgroundFromImageData(imageData);

    expect(alphaAt(result.imageData, 0, 0)).toBe(0);
    expect(alphaAt(result.imageData, 3, 3)).toBe(255);
  });
});
