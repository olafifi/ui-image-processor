import JSZip from 'jszip';
import { extensionForFormat } from './canvasExport';
import type { ExportFormat } from '../types';

interface ZipFileSource {
  originalName: string;
  targetName: string;
  blob: Blob;
}

export function resolveExportFilename(originalName: string, targetName: string, format: ExportFormat): string {
  const extension = extensionForFormat(format);
  const rawName = targetName.trim() || originalName;
  const basename = stripExtension(stripPath(rawName)).trim() || stripExtension(stripPath(originalName));
  return `${sanitizeFilename(basename)}.${extension}`;
}

export async function createExportZip(files: ZipFileSource[], format: ExportFormat): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(resolveExportFilename(file.originalName, file.targetName, format), file.blob);
  }

  return zip.generateAsync({ type: 'blob' });
}

function stripPath(filename: string): string {
  return filename.split(/[\\/]/).at(-1) ?? filename;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]*$/, '');
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, '_');
}
