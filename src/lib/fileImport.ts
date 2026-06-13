import type { ImageQueueItem } from '../types';

const SUPPORTED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

export function isSupportedImageFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return file.type.startsWith('image/') && SUPPORTED_EXTENSIONS.has(extension);
}

export function makeQueueItemName(file: File): string {
  return file.name;
}

export function filterSupportedImageFiles(files: Iterable<File>): File[] {
  return Array.from(files).filter(isSupportedImageFile);
}

export function createImageQueueItem(file: File, previewUrl: string, id = crypto.randomUUID()): ImageQueueItem {
  return {
    id,
    sourceFile: file,
    originalName: file.name,
    targetName: '',
    mimeType: file.type,
    previewUrl,
    cutoutStatus: 'idle',
    editHistory: [previewUrl],
    editHistoryIndex: 0,
    naturalWidth: 0,
    naturalHeight: 0,
    crop: {
      ratio: '1:1',
      x: 0,
      y: 0,
      width: 1,
      height: 1
    },
    exportSettings: {
      format: 'png',
      width: 1024,
      height: 1024,
      backgroundType: 'transparent',
      backgroundColor: '#ffffff',
      cornerRadius: 0
    }
  };
}
