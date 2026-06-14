import { describe, expect, it } from 'vitest';
import { extensionForFormat, normalizeExportSettings, resolveExportSize } from './canvasExport';
import type { ExportSettings } from '../types';

const baseSettings: ExportSettings = {
  format: 'png',
  sizeMode: 'custom',
  width: 1024,
  height: 1024,
  backgroundType: 'transparent',
  backgroundColor: '#ffffff',
  cornerRadius: 24
};

describe('canvas export helpers', () => {
  it('locks transparent exports to png', () => {
    expect(normalizeExportSettings({ ...baseSettings, format: 'jpeg' }).format).toBe('png');
  });

  it('keeps jpeg when background is solid', () => {
    expect(
      normalizeExportSettings({
        ...baseSettings,
        format: 'jpeg',
        backgroundType: 'solid'
      }).format
    ).toBe('jpeg');
  });

  it('maps jpeg format to jpg extension', () => {
    expect(extensionForFormat('jpeg')).toBe('jpg');
    expect(extensionForFormat('png')).toBe('png');
  });

  it('uses the crop pixel dimensions when export size follows the crop', () => {
    expect(
      resolveExportSize(
        { width: 1600, height: 900 },
        { ratio: '4:3', x: 0.125, y: 0, width: 0.75, height: 1 },
        { ...baseSettings, sizeMode: 'crop', width: 0, height: 0 }
      )
    ).toEqual({
      width: 1200,
      height: 900
    });
  });

  it('keeps custom export dimensions when the user overrides size', () => {
    expect(
      resolveExportSize(
        { width: 1600, height: 900 },
        { ratio: '16:9', x: 0, y: 0, width: 1, height: 1 },
        { ...baseSettings, sizeMode: 'custom', width: 512, height: 288 }
      )
    ).toEqual({
      width: 512,
      height: 288
    });
  });
});
