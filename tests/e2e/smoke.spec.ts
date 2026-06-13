import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';

test('loads the image processor workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: '导入图片', exact: true })).toBeVisible();
  await expect(page.getByText('选择与修补')).toBeVisible();
  await expect(page.getByRole('button', { name: /下载 ZIP/ })).toBeVisible();
});

test('fits a high resolution image inside the preview bounds', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('导入图片文件').setInputFiles({
    name: 'large-reference.png',
    mimeType: 'image/png',
    buffer: createSolidPng(2400, 3600)
  });

  const image = page.getByRole('img', { name: 'large-reference.png' });
  await expect(image).toBeVisible();
  await expect.poll(async () => image.evaluate((node) => (node as HTMLImageElement).naturalHeight)).toBe(3600);

  const bounds = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>('.canvas-preview img');
    const preview = document.querySelector<HTMLElement>('.canvas-preview');
    if (!img || !preview) {
      return null;
    }

    const imageRect = img.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    return {
      imageHeight: imageRect.height,
      imageWidth: imageRect.width,
      previewHeight: previewRect.height,
      previewWidth: previewRect.width
    };
  });

  expect(bounds).not.toBeNull();
  expect(bounds!.imageHeight).toBeLessThanOrEqual(bounds!.previewHeight + 1);
  expect(bounds!.imageWidth).toBeLessThanOrEqual(bounds!.previewWidth + 1);
});

test('free crop mode can be resized directly on the canvas', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('导入图片文件').setInputFiles({
    name: 'free-crop.png',
    mimeType: 'image/png',
    buffer: createSolidPng(900, 1600)
  });
  await page.getByRole('img', { name: 'free-crop.png' }).waitFor();
  await page.getByRole('button', { name: '自由' }).click();

  const frame = page.locator('.crop-frame');
  const handle = page.getByLabel('调整裁剪框右下角');
  await expect(handle).toBeVisible();

  const before = await frame.boundingBox();
  expect(before).not.toBeNull();

  await handle.dragTo(page.locator('.canvas-preview'), {
    targetPosition: {
      x: Math.round(before!.x - (await page.locator('.canvas-preview').boundingBox())!.x + before!.width - 80),
      y: Math.round(before!.y - (await page.locator('.canvas-preview').boundingBox())!.y + before!.height - 120)
    }
  });

  const after = await frame.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBeLessThan(before!.width - 20);
  expect(after!.height).toBeLessThan(before!.height - 20);
});

function createSolidPng(width: number, height: number): Buffer {
  const bytesPerPixel = 3;
  const stride = 1 + width * bytesPerPixel;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    raw.fill(255, rowStart + 1, rowStart + stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createPngChunk('IHDR', header),
    createPngChunk('IDAT', deflateSync(raw)),
    createPngChunk('IEND', Buffer.alloc(0))
  ]);
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
