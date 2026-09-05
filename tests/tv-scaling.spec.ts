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

  test('scales down to fit 720p 16:9 (1280x720)', async ({ page }) => {
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

  test('scales up to fit 4K UHD 16:9 (3840x2160)', async ({ page }) => {
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

  test('fills taller 16:10 display (1920x1200) without black stripes', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.goto('/tv');

    const frame = page.getByTestId('tv-shared-frame');
    await expect(frame).toBeVisible();

    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(1920, 0);
    expect(box!.height).toBeCloseTo(1200, 0);
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
  });

  test('fills old 4:3 TV (1024x768) keeping 1920 virtual width without black stripes', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/tv');

    const frame = page.getByTestId('tv-shared-frame');
    await expect(frame).toBeVisible();

    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(1024, 0);
    expect(box!.height).toBeCloseTo(768, 0);
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
  });

  test('fills wider 21:9 ultrawide (2560x1080) keeping 1080 virtual height without black stripes', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1080 });
    await page.goto('/tv');

    const frame = page.getByTestId('tv-shared-frame');
    await expect(frame).toBeVisible();

    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(2560, 0);
    expect(box!.height).toBeCloseTo(1080, 0);
    expect(box!.x).toBeCloseTo(0, 0);
    expect(box!.y).toBeCloseTo(0, 0);
  });

  test('dynamically updates scale and dimensions when window is resized', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/tv');

    const frame = page.getByTestId('tv-shared-frame');
    await expect(frame).toBeVisible();

    let box = await frame.boundingBox();
    expect(box!.width).toBeCloseTo(1920, 0);
    expect(box!.height).toBeCloseTo(1080, 0);

    // Resize viewport to 4:3 (1024x768)
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(async () => {
      box = await frame.boundingBox();
      expect(box!.width).toBeCloseTo(1024, 0);
      expect(box!.height).toBeCloseTo(768, 0);
    }).toPass();

    // Resize viewport to 21:9 ultrawide (2560x1080)
    await page.setViewportSize({ width: 2560, height: 1080 });
    await expect(async () => {
      box = await frame.boundingBox();
      expect(box!.width).toBeCloseTo(2560, 0);
      expect(box!.height).toBeCloseTo(1080, 0);
    }).toPass();
  });
});
