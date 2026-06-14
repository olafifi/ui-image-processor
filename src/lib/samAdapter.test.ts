import { describe, expect, it } from 'vitest';
import { detectSamMode } from './samAdapter';

describe('sam adapter', () => {
  it('returns full mode without webgpu when workers are available', () => {
    expect(detectSamMode({ gpuAvailable: false, workerAvailable: true })).toBe('full');
  });

  it('returns full mode when webgpu and worker are available', () => {
    expect(detectSamMode({ gpuAvailable: true, workerAvailable: true })).toBe('full');
  });

  it('returns degraded mode when workers are missing', () => {
    expect(detectSamMode({ gpuAvailable: true, workerAvailable: false })).toBe('degraded');
  });
});
