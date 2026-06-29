import { describe, expect, it } from 'vitest';
import { canvasToBlob, extensionForFormat, normalizeExportSettings, resolveExportSize } from './canvasExport';
import type { ExportSettings } from '../types';

const baseSettings: ExportSettings = {
  format: 'png',
  sizeMode: 'custom',
  width: 1024,
  height: 1024,
  backgroundType: 'transparent',
  backgroundColor: '#ffffff',
  cornerRadius: 24,
  compressionMode: 'source-size',
  jpegQuality: 88
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

  it('uses fixed jpeg quality when source-size matching is disabled', async () => {
    const qualities: Array<number | undefined> = [];
    const canvas = makeEncodingCanvas(qualities, (quality) => Math.round((quality ?? 1) * 1000));

    await canvasToBlob(canvas, 'jpeg', { ...baseSettings, backgroundType: 'solid', compressionMode: 'quality', jpegQuality: 76 });

    expect(qualities).toEqual([0.76]);
  });

  it('lowers jpeg quality to stay close to the source-size target', async () => {
    const qualities: Array<number | undefined> = [];
    const canvas = makeEncodingCanvas(qualities, (quality) => Math.round((quality ?? 1) * 1000));

    const blob = await canvasToBlob(canvas, 'jpeg', {
      ...baseSettings,
      backgroundType: 'solid',
      compressionMode: 'source-size',
      jpegQuality: 92
    }, { targetBytes: 500 });

    expect(blob.size).toBeLessThanOrEqual(500);
    expect(Math.max(...qualities.filter((quality): quality is number => quality !== undefined))).toBeLessThan(0.92);
  });
});

function makeEncodingCanvas(
  qualities: Array<number | undefined>,
  sizeForQuality: (quality: number | undefined) => number
): HTMLCanvasElement {
  return {
    toBlob(callback: BlobCallback, type?: string, quality?: number) {
      qualities.push(quality);
      callback(new Blob([new Uint8Array(sizeForQuality(quality))], { type }));
    }
  } as HTMLCanvasElement;
}
