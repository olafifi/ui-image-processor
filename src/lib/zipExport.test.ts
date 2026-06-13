import { describe, expect, it } from 'vitest';
import { resolveExportFilename } from './zipExport';

describe('zip export helpers', () => {
  it('uses csv rename and appends png extension', () => {
    expect(resolveExportFilename('hero_ref_01.webp', 'ui_button_start', 'png')).toBe('ui_button_start.png');
  });

  it('keeps old basename when csv name is empty', () => {
    expect(resolveExportFilename('hero_ref_01.webp', '', 'jpeg')).toBe('hero_ref_01.jpg');
  });

  it('replaces a mismatched provided extension', () => {
    expect(resolveExportFilename('hero_ref_01.webp', 'ui_button_start.jpg', 'png')).toBe('ui_button_start.png');
  });
});
