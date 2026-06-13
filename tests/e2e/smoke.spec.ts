import { expect, test } from '@playwright/test';

test('loads the image processor workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: '导入图片', exact: true })).toBeVisible();
  await expect(page.getByText('选择与修补')).toBeVisible();
  await expect(page.getByRole('button', { name: /下载 ZIP/ })).toBeVisible();
});
