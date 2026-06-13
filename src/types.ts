export type CropRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | 'free';

export type ExportFormat = 'png' | 'jpeg';

export type BackgroundType = 'transparent' | 'solid';

export type AppMode = 'full' | 'degraded';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  ratio: CropRatio;
}

export interface ExportSettings {
  format: ExportFormat;
  width: number;
  height: number;
  backgroundType: BackgroundType;
  backgroundColor: string;
  cornerRadius: number;
}

export interface ImageQueueItem {
  id: string;
  sourceFile: File;
  originalName: string;
  targetName: string;
  mimeType: string;
  previewUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  crop: CropRect;
  exportSettings: ExportSettings;
}

export interface Template {
  id: string;
  name: string;
  crop: CropRect;
  exportSettings: ExportSettings;
  namingRule: string;
  createdAt: string;
  updatedAt: string;
}

export interface RenameMapping {
  oldFilename: string;
  newFilename: string;
  status: 'valid' | 'error';
  message?: string;
}
