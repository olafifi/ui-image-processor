import type { AppMode } from '../types';

export interface SamCapabilities {
  gpuAvailable: boolean;
  workerAvailable: boolean;
}

export interface SegmentPoint {
  x: number;
  y: number;
  label: 'positive' | 'negative';
}

export interface Segmenter {
  load(): Promise<void>;
  segmentByPoints(image: ImageBitmap, points: SegmentPoint[]): Promise<ImageData>;
}

export function detectBrowserCapabilities(): SamCapabilities {
  return {
    gpuAvailable: Boolean((navigator as Navigator & { gpu?: unknown }).gpu),
    workerAvailable: typeof Worker !== 'undefined'
  };
}

export function detectSamMode(capabilities: SamCapabilities): AppMode {
  return capabilities.workerAvailable ? 'full' : 'degraded';
}

export class UnavailableSegmenter implements Segmenter {
  async load(): Promise<void> {
    throw new Error('当前浏览器不支持本地智能分割，已切换到启发式兜底');
  }

  async segmentByPoints(): Promise<ImageData> {
    throw new Error('当前浏览器不支持本地智能分割，已切换到启发式兜底');
  }
}
