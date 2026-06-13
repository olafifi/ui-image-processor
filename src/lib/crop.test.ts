import { describe, expect, it } from 'vitest';
import { fitCropToRatio } from './crop';

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
});
