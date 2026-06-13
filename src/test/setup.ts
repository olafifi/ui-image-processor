import '@testing-library/jest-dom/vitest';

class TestImageData {
  readonly colorSpace: PredefinedColorSpace = 'srgb';
  readonly data: Uint8ClampedArray;
  readonly height: number;
  readonly width: number;

  constructor(data: Uint8ClampedArray, width: number, height?: number) {
    this.data = data;
    this.width = width;
    this.height = height ?? data.length / 4 / width;
  }
}

if (typeof ImageData === 'undefined') {
  Object.defineProperty(globalThis, 'ImageData', {
    configurable: true,
    value: TestImageData as unknown as typeof ImageData,
    writable: true
  });
}
