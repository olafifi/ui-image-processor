import type { CutoutKind, ImageQueueItem } from '../types';

export interface BackgroundRemovalResult {
  imageData: ImageData;
  kind: CutoutKind;
  message: string;
  removedPixelCount: number;
}

export interface AutoCutoutResult {
  kind: CutoutKind;
  message: string;
  processedPreviewUrl: string;
}

interface Color {
  r: number;
  g: number;
  b: number;
}

interface ColorCluster extends Color {
  count: number;
}

const TRANSPARENT_ALPHA_THRESHOLD = 250;
const LIGHT_BACKGROUND_MIN = 218;
const BACKGROUND_TOLERANCE = 28;
const FOREGROUND_SEED_DISTANCE = 34;
const FOREGROUND_DILATION_RATIO = 0.024;
const MAX_FOREGROUND_DILATION_RADIUS = 32;

export async function autoCutoutItem(item: ImageQueueItem): Promise<AutoCutoutResult> {
  const image = await loadHtmlImage(item.previewUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('当前浏览器无法创建 Canvas 2D 上下文');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const result = removeBackgroundFromImageData(context.getImageData(0, 0, canvas.width, canvas.height));
  context.putImageData(result.imageData, 0, 0);

  return {
    kind: result.kind,
    message: result.message,
    processedPreviewUrl: canvas.toDataURL('image/png')
  };
}

export function removeBackgroundFromImageData(input: ImageData): BackgroundRemovalResult {
  const output = cloneImageData(input);
  const alphaPixels = countTransparentPixels(output);

  if (alphaPixels > 0) {
    return {
      imageData: output,
      kind: 'existing-alpha',
      message: '图片已有真实透明通道',
      removedPixelCount: 0
    };
  }

  const clusters = getBorderBackgroundClusters(output);
  if (clusters.length === 0) {
    return {
      imageData: output,
      kind: 'unknown',
      message: '未识别到可安全自动移除的背景',
      removedPixelCount: 0
    };
  }

  const kind = isCheckerboardLike(clusters) ? 'fake-checkerboard' : 'light-background';
  const protectionMask = kind === 'fake-checkerboard' ? createForegroundProtectionMask(output, clusters) : undefined;
  const removedPixelCount = floodFillBackground(output, clusters, protectionMask);

  return {
    imageData: output,
    kind: removedPixelCount > 0 ? kind : 'unknown',
    message:
      removedPixelCount > 0
        ? kind === 'fake-checkerboard'
          ? '已去除伪透明棋盘格背景'
          : '已去除边缘浅色背景'
        : '未识别到可安全自动移除的背景',
    removedPixelCount
  };
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片解码失败，无法自动抠图'));
    image.src = url;
  });
}

function cloneImageData(input: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(input.data), input.width, input.height);
}

function countTransparentPixels(imageData: ImageData): number {
  let count = 0;
  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] < TRANSPARENT_ALPHA_THRESHOLD) {
      count += 1;
    }
  }
  return count;
}

function getBorderBackgroundClusters(imageData: ImageData): ColorCluster[] {
  const clusters = new Map<string, ColorCluster>();
  const { width, height } = imageData;

  forEachBorderPixel(width, height, (x, y) => {
    const color = getPixelColor(imageData, x, y);
    if (!isLightNeutral(color)) {
      return;
    }

    const key = `${Math.round(color.r / 8)},${Math.round(color.g / 8)},${Math.round(color.b / 8)}`;
    const cluster = clusters.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    cluster.r += color.r;
    cluster.g += color.g;
    cluster.b += color.b;
    cluster.count += 1;
    clusters.set(key, cluster);
  });

  const minimumCount = Math.max(2, Math.floor((width * 2 + height * 2) * 0.012));
  return Array.from(clusters.values())
    .filter((cluster) => cluster.count >= minimumCount)
    .map((cluster) => ({
      r: cluster.r / cluster.count,
      g: cluster.g / cluster.count,
      b: cluster.b / cluster.count,
      count: cluster.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

function floodFillBackground(imageData: ImageData, clusters: Color[], protectionMask?: Uint8Array): number {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  let removed = 0;

  forEachBorderPixel(width, height, (x, y) => {
    const pixelIndex = y * width + x;
    if (
      visited[pixelIndex] ||
      protectionMask?.[pixelIndex] ||
      !isBackgroundLike(getPixelColor(imageData, x, y), clusters)
    ) {
      return;
    }
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  });

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixelIndex = queue[cursor];
    const dataIndex = pixelIndex * 4;
    if (data[dataIndex + 3] !== 0) {
      data[dataIndex + 3] = 0;
      removed += 1;
    }

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    visitNeighbor(x - 1, y);
    visitNeighbor(x + 1, y);
    visitNeighbor(x, y - 1);
    visitNeighbor(x, y + 1);
  }

  return removed;

  function visitNeighbor(x: number, y: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const pixelIndex = y * width + x;
    if (
      visited[pixelIndex] ||
      protectionMask?.[pixelIndex] ||
      !isBackgroundLike(getPixelColor(imageData, x, y), clusters)
    ) {
      return;
    }

    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  }
}

function createForegroundProtectionMask(imageData: ImageData, clusters: Color[]): Uint8Array {
  const { width, height } = imageData;
  const totalPixels = width * height;
  const protectedPixels = new Uint8Array(totalPixels);
  const distances = new Uint8Array(totalPixels);
  const queue = new Uint32Array(totalPixels);
  const radius = Math.max(
    1,
    Math.min(MAX_FOREGROUND_DILATION_RADIUS, Math.round(Math.min(width, height) * FOREGROUND_DILATION_RATIO))
  );
  let cursor = 0;
  let queueLength = 0;

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    const color = {
      r: imageData.data[dataIndex],
      g: imageData.data[dataIndex + 1],
      b: imageData.data[dataIndex + 2]
    };
    if (!isForegroundSeed(color, clusters)) {
      continue;
    }

    protectedPixels[pixelIndex] = 1;
    queue[queueLength] = pixelIndex;
    queueLength += 1;
  }

  while (cursor < queueLength) {
    const pixelIndex = queue[cursor];
    cursor += 1;

    const distance = distances[pixelIndex];
    if (distance >= radius) {
      continue;
    }

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    visit(x - 1, y, distance + 1);
    visit(x + 1, y, distance + 1);
    visit(x, y - 1, distance + 1);
    visit(x, y + 1, distance + 1);
    visit(x - 1, y - 1, distance + 1);
    visit(x + 1, y - 1, distance + 1);
    visit(x - 1, y + 1, distance + 1);
    visit(x + 1, y + 1, distance + 1);
  }

  return protectedPixels;

  function visit(x: number, y: number, distance: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const nextPixelIndex = y * width + x;
    if (protectedPixels[nextPixelIndex]) {
      return;
    }

    protectedPixels[nextPixelIndex] = 1;
    distances[nextPixelIndex] = distance;
    queue[queueLength] = nextPixelIndex;
    queueLength += 1;
  }
}

function isForegroundSeed(color: Color, clusters: Color[]): boolean {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  const nearestBackgroundDistance = Math.min(...clusters.map((cluster) => colorDistance(color, cluster)));
  return min < 210 || max - min > 30 || nearestBackgroundDistance > FOREGROUND_SEED_DISTANCE;
}

function forEachBorderPixel(width: number, height: number, visitor: (x: number, y: number) => void) {
  for (let x = 0; x < width; x += 1) {
    visitor(x, 0);
    if (height > 1) {
      visitor(x, height - 1);
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    visitor(0, y);
    if (width > 1) {
      visitor(width - 1, y);
    }
  }
}

function getPixelColor(imageData: ImageData, x: number, y: number): Color {
  const index = (y * imageData.width + x) * 4;
  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2]
  };
}

function isBackgroundLike(color: Color, clusters: Color[]): boolean {
  return isLightNeutral(color) && clusters.some((cluster) => colorDistance(color, cluster) <= BACKGROUND_TOLERANCE);
}

function isLightNeutral(color: Color): boolean {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return min >= LIGHT_BACKGROUND_MIN && max - min <= 26;
}

function colorDistance(a: Color, b: Color): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isCheckerboardLike(clusters: ColorCluster[]): boolean {
  if (clusters.length < 2) {
    return false;
  }

  return colorDistance(clusters[0], clusters[1]) >= 8;
}
