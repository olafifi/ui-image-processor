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

function rgbAt(imageData: ImageData, x: number, y: number) {
  const index = (y * imageData.width + x) * 4;
  return [imageData.data[index], imageData.data[index + 1], imageData.data[index + 2]];
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

  it('normalizes hidden rgb on fully transparent pixels', () => {
    const imageData = makeImageData(3, 3, [40, 40, 40, 255]);
    setPixel(imageData, 0, 0, [0, 0, 0, 0]);

    const result = removeBackgroundFromImageData(imageData);

    expect(result.kind).toBe('existing-alpha');
    expect(alphaAt(result.imageData, 0, 0)).toBe(0);
    expect(rgbAt(result.imageData, 0, 0)).toEqual([255, 255, 255]);
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

  it('keeps textured light foreground that touches a fake checkerboard background', () => {
    const imageData = makeImageData(16, 16, [252, 252, 252, 255]);
    for (let y = 0; y < imageData.height; y += 1) {
      for (let x = 0; x < imageData.width; x += 1) {
        const checker = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0;
        setPixel(imageData, x, y, checker ? [242, 242, 242, 255] : [254, 254, 254, 255]);
      }
    }

    for (let y = 5; y <= 11; y += 1) {
      for (let x = 4; x <= 11; x += 1) {
        setPixel(imageData, x, y, [248, 246, 238, 255]);
      }
    }
    for (let x = 4; x <= 11; x += 2) {
      setPixel(imageData, x, 7, [210, 190, 160, 255]);
      setPixel(imageData, x, 10, [205, 186, 154, 255]);
    }

    const result = removeBackgroundFromImageData(imageData);

    expect(result.kind).toBe('fake-checkerboard');
    expect(alphaAt(result.imageData, 0, 0)).toBe(0);
    expect(alphaAt(result.imageData, 15, 15)).toBe(0);
    expect(alphaAt(result.imageData, 8, 8)).toBe(255);
  });

  it('removes a dark border background without deleting nearby black line art', () => {
    const imageData = makeImageData(11, 11, [0, 0, 0, 255]);

    for (let y = 3; y <= 7; y += 1) {
      for (let x = 3; x <= 7; x += 1) {
        setPixel(imageData, x, y, [238, 226, 205, 255]);
      }
    }

    for (let i = 2; i <= 8; i += 1) {
      setPixel(imageData, i, 2, [2, 2, 2, 255]);
      setPixel(imageData, i, 8, [2, 2, 2, 255]);
      setPixel(imageData, 2, i, [2, 2, 2, 255]);
      setPixel(imageData, 8, i, [2, 2, 2, 255]);
    }
    setPixel(imageData, 5, 5, [1, 1, 1, 255]);

    const result = removeBackgroundFromImageData(imageData);

    expect(result.kind).toBe('solid-background');
    expect(alphaAt(result.imageData, 0, 0)).toBe(0);
    expect(alphaAt(result.imageData, 10, 10)).toBe(0);
    expect(alphaAt(result.imageData, 2, 5)).toBe(255);
    expect(alphaAt(result.imageData, 5, 5)).toBe(255);
  });

  it('preserves thick dark outlines around light foreground on dark backgrounds', () => {
    const imageData = makeImageData(32, 32, [0, 0, 0, 255]);

    for (let y = 12; y <= 20; y += 1) {
      for (let x = 12; x <= 20; x += 1) {
        setPixel(imageData, x, y, [238, 226, 205, 255]);
      }
    }

    for (let offset = 0; offset < 4; offset += 1) {
      for (let i = 8 + offset; i <= 24 - offset; i += 1) {
        setPixel(imageData, i, 8 + offset, [2, 2, 2, 255]);
        setPixel(imageData, i, 24 - offset, [2, 2, 2, 255]);
        setPixel(imageData, 8 + offset, i, [2, 2, 2, 255]);
        setPixel(imageData, 24 - offset, i, [2, 2, 2, 255]);
      }
    }

    const result = removeBackgroundFromImageData(imageData);

    expect(alphaAt(result.imageData, 0, 0)).toBe(0);
    expect(alphaAt(result.imageData, 8, 16)).toBe(255);
    expect(alphaAt(result.imageData, 16, 16)).toBe(255);
  });
});
