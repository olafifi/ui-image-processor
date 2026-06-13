export type BrushEditMode = 'erase' | 'restore';
export type PointEditMode = 'point-erase' | 'point-restore';

export interface BrushEditInput {
  mode: BrushEditMode;
  original: ImageData;
  processed: ImageData;
  x: number;
  y: number;
  radius: number;
}

export interface PointEditInput {
  mode: PointEditMode;
  original: ImageData;
  processed: ImageData;
  x: number;
  y: number;
  tolerance?: number;
}

export async function applyCutoutEditToImages(
  original: CanvasImageSource,
  processed: CanvasImageSource,
  edit: { mode: BrushEditMode | PointEditMode; x: number; y: number; radius: number; points?: Array<{ x: number; y: number }> }
): Promise<string> {
  const originalData = drawSourceToImageData(original);
  const processedData = drawSourceToImageData(processed, originalData.width, originalData.height);
  const result =
    edit.mode === 'erase' || edit.mode === 'restore'
      ? applyBrushStrokeToImageData({
          mode: edit.mode,
          original: originalData,
          points: edit.points?.length ? edit.points : [{ x: edit.x, y: edit.y }],
          processed: processedData,
          radius: edit.radius,
          x: edit.x,
          y: edit.y
        })
      : applyPointEditToImageData({
          mode: edit.mode,
          original: originalData,
          processed: processedData,
          tolerance: Math.max(18, edit.radius),
          x: edit.x,
          y: edit.y
        });

  return imageDataToPngDataUrl(result);
}

export function applyBrushEditToImageData(input: BrushEditInput): ImageData {
  const points = [{ x: input.x, y: input.y }];
  return applyBrushStrokeToImageData({ ...input, points });
}

export function applyBrushStrokeToImageData(input: BrushEditInput & { points: Array<{ x: number; y: number }> }): ImageData {
  const output = cloneImageData(input.processed);
  for (const point of input.points) {
    applyBrushPoint(output, input.original, input.mode, point.x, point.y, input.radius);
  }

  return output;
}

function applyBrushPoint(
  output: ImageData,
  original: ImageData,
  mode: BrushEditMode,
  xPosition: number,
  yPosition: number,
  brushRadius: number
) {
  const radius = Math.max(1, brushRadius);
  const radiusSquared = radius * radius;
  const minX = Math.max(0, Math.floor(xPosition - radius));
  const maxX = Math.min(output.width - 1, Math.ceil(xPosition + radius));
  const minY = Math.max(0, Math.floor(yPosition - radius));
  const maxY = Math.min(output.height - 1, Math.ceil(yPosition + radius));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - xPosition;
      const dy = y - yPosition;
      if (dx * dx + dy * dy > radiusSquared) {
        continue;
      }

      const index = (y * output.width + x) * 4;
      if (mode === 'erase') {
        output.data[index + 3] = 0;
      } else {
        output.data.set(original.data.slice(index, index + 4), index);
      }
    }
  }
}

export function applyPointEditToImageData(input: PointEditInput): ImageData {
  const source = input.mode === 'point-restore' ? input.original : input.processed;
  const output = cloneImageData(input.processed);
  const { width, height } = output;
  const startX = clamp(Math.round(input.x), 0, width - 1);
  const startY = clamp(Math.round(input.y), 0, height - 1);
  const startIndex = (startY * width + startX) * 4;
  const target = source.data.slice(startIndex, startIndex + 4);
  const tolerance = input.tolerance ?? 28;
  const queue = [startY * width + startX];
  const visited = new Uint8Array(width * height);
  visited[startY * width + startX] = 1;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixelIndex = queue[cursor];
    const dataIndex = pixelIndex * 4;
    if (isCloseToTarget(source.data, dataIndex, target, tolerance)) {
      if (input.mode === 'point-erase') {
        output.data[dataIndex + 3] = 0;
      } else {
        output.data.set(input.original.data.slice(dataIndex, dataIndex + 4), dataIndex);
      }

      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      visit(x - 1, y);
      visit(x + 1, y);
      visit(x, y - 1);
      visit(x, y + 1);
    }
  }

  return output;

  function visit(x: number, y: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) {
      return;
    }

    visited[pixelIndex] = 1;
    const dataIndex = pixelIndex * 4;
    if (isCloseToTarget(source.data, dataIndex, target, tolerance)) {
      queue.push(pixelIndex);
    }
  }
}

function drawSourceToImageData(source: CanvasImageSource, width?: number, height?: number): ImageData {
  const size = getSourceSize(source);
  const canvas = document.createElement('canvas');
  canvas.width = width ?? size.width;
  canvas.height = height ?? size.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('当前浏览器无法创建 Canvas 2D 上下文');
  }

  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function imageDataToPngDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器无法创建 Canvas 2D 上下文');
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function cloneImageData(input: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(input.data), input.width, input.height);
}

function getSourceSize(source: CanvasImageSource): { width: number; height: number } {
  const candidate = source as {
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };
  const width = candidate.naturalWidth ?? candidate.videoWidth ?? candidate.width ?? 0;
  const height = candidate.naturalHeight ?? candidate.videoHeight ?? candidate.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new Error('图片尺寸无效，无法编辑抠图');
  }

  return { width, height };
}

function isCloseToTarget(data: Uint8ClampedArray, index: number, target: Uint8ClampedArray, tolerance: number): boolean {
  const dr = data[index] - target[0];
  const dg = data[index + 1] - target[1];
  const db = data[index + 2] - target[2];
  const da = data[index + 3] - target[3];
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da * 0.25) <= tolerance;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
