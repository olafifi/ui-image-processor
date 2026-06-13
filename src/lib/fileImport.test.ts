import { describe, expect, it } from 'vitest';
import { isSupportedImageFile, makeQueueItemName } from './fileImport';

describe('file import helpers', () => {
  it('accepts png jpg jpeg and webp files', () => {
    expect(isSupportedImageFile(new File([], 'a.png', { type: 'image/png' }))).toBe(true);
    expect(isSupportedImageFile(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(isSupportedImageFile(new File([], 'a.jpeg', { type: 'image/jpeg' }))).toBe(true);
    expect(isSupportedImageFile(new File([], 'a.webp', { type: 'image/webp' }))).toBe(true);
  });

  it('rejects non image files', () => {
    expect(isSupportedImageFile(new File([], 'a.txt', { type: 'text/plain' }))).toBe(false);
  });

  it('preserves original filename for queue display', () => {
    expect(makeQueueItemName(new File([], 'hero_ref_01.webp'))).toBe('hero_ref_01.webp');
  });
});
