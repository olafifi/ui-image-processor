import { removeBackground as imglyRemoveBackground, type Config, type ImageSource } from '@imgly/background-removal';
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

type BackgroundModelRemover = (source: ImageSource, config?: Config) => Promise<Blob>;

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
const DARK_BACKGROUND_MAX = 50;
const BACKGROUND_TOLERANCE = 28;
const DARK_BACKGROUND_TOLERANCE = 18;
const FOREGROUND_SEED_DISTANCE = 34;
const FOREGROUND_DILATION_RATIO = 0.024;
const MAX_FOREGROUND_DILATION_RADIUS = 32;
const SOLID_FOREGROUND_DILATION_RATIO = 0.01;
const MAX_SOLID_FOREGROUND_DILATION_RADIUS = 10;
const LOCAL_MODEL_CONFIG: Config = {
  device: 'cpu',
  model: 'isnet_quint8',
  output: { format: 'image/png' }
};

export async function autoCutoutItem(item: ImageQueueItem): Promise<AutoCutoutResult> {
  try {
    return await runModelBackgroundRemoval(item.sourceFile);
  } catch {
    return runHeuristicBackgroundRemoval(item);
  }
}

export async function runModelBackgroundRemoval(
  source: ImageSource,
  remover: BackgroundModelRemover = imglyRemoveBackground,
  config: Config = LOCAL_MODEL_CONFIG
): Promise<AutoCutoutResult> {
  const blob = await remover(source, config);
  return {
    kind: 'model-background',
    message: '已使用本地模型自动抠图',
    processedPreviewUrl: await blobToDataUrl(blob)
  };
}

async function runHeuristicBackgroundRemoval(item: ImageQueueItem): Promise<AutoCutoutResult> {
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

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || 'image/png'};base64,${bytesToBase64(bytes)}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function removeBackgroundFromImageData(input: ImageData): BackgroundRemovalResult {
  const output = cloneImageData(input);
  const alphaPixels = countTransparentPixels(output);

  if (alphaPixels > 0) {
    normalizeFullyTransparentPixels(output);
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

  const kind = classifyBackgroundKind(clusters);
  const protectionMask =
    kind === 'fake-checkerboard'
      ? createForegroundProtectionMask(output, clusters)
      : kind === 'solid-background'
        ? createForegroundProtectionMask(output, clusters, {
            maxRadius: MAX_SOLID_FOREGROUND_DILATION_RADIUS,
            minRadius: Math.min(output.width, output.height) >= 24 ? 5 : 1,
            ratio: SOLID_FOREGROUND_DILATION_RATIO
          })
        : undefined;
  const removedPixelCount = floodFillBackground(output, clusters, protectionMask);

  return {
    imageData: output,
    kind: removedPixelCount > 0 ? kind : 'unknown',
    message:
      removedPixelCount > 0
        ? kind === 'fake-checkerboard'
          ? '已去除伪透明棋盘格背景'
          : kind === 'solid-background'
            ? '已去除边缘纯色背景'
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
    if (!isAutomaticBackgroundCandidate(color)) {
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
      makePixelTransparent(data, dataIndex);
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

function createForegroundProtectionMask(
  imageData: ImageData,
  clusters: Color[],
  options: { maxRadius: number; minRadius?: number; ratio: number } = {
    maxRadius: MAX_FOREGROUND_DILATION_RADIUS,
    minRadius: 1,
    ratio: FOREGROUND_DILATION_RATIO
  }
): Uint8Array {
  const { width, height } = imageData;
  const totalPixels = width * height;
  const protectedPixels = new Uint8Array(totalPixels);
  const distances = new Uint8Array(totalPixels);
  const queue = new Uint32Array(totalPixels);
  const radius = Math.max(
    options.minRadius ?? 1,
    Math.min(options.maxRadius, Math.round(Math.min(width, height) * options.ratio))
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
  if (isBackgroundLike(color, clusters)) {
    return false;
  }

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
  return clusters.some((cluster) => {
    if (isDarkNeutral(cluster)) {
      return isDarkNeutral(color) && colorDistance(color, cluster) <= DARK_BACKGROUND_TOLERANCE;
    }

    return isLightNeutral(color) && colorDistance(color, cluster) <= BACKGROUND_TOLERANCE;
  });
}

function isAutomaticBackgroundCandidate(color: Color): boolean {
  return isLightNeutral(color) || isDarkNeutral(color);
}

function isLightNeutral(color: Color): boolean {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return min >= LIGHT_BACKGROUND_MIN && max - min <= 26;
}

function isDarkNeutral(color: Color): boolean {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return max <= DARK_BACKGROUND_MAX && max - min <= 30;
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

  return clusters.every(isLightNeutral) && colorDistance(clusters[0], clusters[1]) >= 8;
}

function classifyBackgroundKind(clusters: ColorCluster[]): CutoutKind {
  if (isCheckerboardLike(clusters)) {
    return 'fake-checkerboard';
  }

  return clusters.some(isDarkNeutral) ? 'solid-background' : 'light-background';
}

function makePixelTransparent(data: Uint8ClampedArray, index: number) {
  data[index] = 255;
  data[index + 1] = 255;
  data[index + 2] = 255;
  data[index + 3] = 0;
}

function normalizeFullyTransparentPixels(imageData: ImageData) {
  const { data } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) {
      makePixelTransparent(data, index);
    }
  }
}
