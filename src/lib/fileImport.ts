const SUPPORTED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

export function isSupportedImageFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return file.type.startsWith('image/') && SUPPORTED_EXTENSIONS.has(extension);
}

export function makeQueueItemName(file: File): string {
  return file.name;
}
