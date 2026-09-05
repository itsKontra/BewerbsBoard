import { test, expect } from '@playwright/test';

test.describe('TV Viewport Scaling', () => {
  test('scales pixel-perfectly at native 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/tv');

    const frame = page.getByTestId('tv-shared-frame');
    await expect(frame).toBeVisible();

    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(1920, 0);
    expect(box!.height).toBeCloseTo(1080, 0);
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
  });

  test('scales down to fit 720p (1280x720)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/tv');

    const frame = page.getByTestId('tv-shared-frame');
    await expect(frame).toBeVisible();

    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(1280, 0);
    expect(box!.height).toBeCloseTo(720, 0);
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
  });

  test('scales up to fit 4K UHD (3840x2160)', async ({ page }) => {
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto('/tv');

    const frame = page.getByTestId('tv-shared-frame');
    await expect(frame).toBeVisible();

    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(3840, 0);
    expect(box!.height).toBeCloseTo(2160, 0);
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
  });

  test('letterboxes vertically on 16:10 display (1920x1200)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.goto('/tv');

    const frame = page.getByTestId('tv-shared-frame');
    await expect(frame).toBeVisible();

    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(1920, 0);
    expect(box!.height).toBeCloseTo(1080, 0);
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo((1200 - 1080) / 2, 0);
  });

  test('dynamically updates scale when window is resized', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/tv');

    const frame = page.getByTestId('tv-shared-frame');
    await expect(frame).toBeVisible();

    let box = await frame.boundingBox();
    expect(box!.width).toBeCloseTo(1920, 0);

    // Resize viewport to 1280x720
    await page.setViewportSize({ width: 1280, height: 720 });
    // Wait for resize handler to update
    await expect(async () => {
      box = await frame.boundingBox();
      expect(box!.width).toBeCloseTo(1280, 0);
      expect(box!.height).toBeCloseTo(720, 0);
    }).toPass();
  });
});
