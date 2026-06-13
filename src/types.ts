export type CropRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | 'free';

export type ExportFormat = 'png' | 'jpeg';

export type BackgroundType = 'transparent' | 'solid';

export type AppMode = 'full' | 'degraded';

export type WorkspaceMode = 'edit' | 'rename';

export type CutoutStatus = 'idle' | 'processing' | 'ready' | 'failed';

export type CutoutKind = 'existing-alpha' | 'fake-checkerboard' | 'light-background' | 'unknown';

export type EditorTool = 'selectAdd' | 'selectSubtract' | 'eraser' | 'restore' | 'crop';

export interface CutoutEditRequest {
  mode: 'erase' | 'restore' | 'point-erase' | 'point-restore';
  x: number;
  y: number;
  radius: number;
  points?: Array<{ x: number; y: number }>;
}

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
  processedPreviewUrl?: string;
  baseCutoutUrl?: string;
  cutoutStatus: CutoutStatus;
  cutoutKind?: CutoutKind;
  cutoutMessage?: string;
  editHistory: string[];
  editHistoryIndex: number;
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
