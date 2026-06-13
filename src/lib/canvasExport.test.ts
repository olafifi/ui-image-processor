import { describe, expect, it } from 'vitest';
import { extensionForFormat, normalizeExportSettings } from './canvasExport';
import type { ExportSettings } from '../types';

const baseSettings: ExportSettings = {
  format: 'png',
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
});
