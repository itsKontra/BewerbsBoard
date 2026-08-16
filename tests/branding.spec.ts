import { expect, test } from '@playwright/test';

test.describe('BewerbsBoard branding', () => {
  test('uses the public title and custom icon', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');

    await expect(page).toHaveTitle('BewerbsBoard – Live Results');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/bewerbsboard-icon.png');

    const iconResponse = await page.request.get('/bewerbsboard-icon.png');
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
  });

  test('uses a title specific to the TV display', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/tv');

    await expect(page).toHaveTitle('BewerbsBoard – TV Display');
  });

  test('uses a title specific to administration', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/admin');

    await expect(page).toHaveTitle('BewerbsBoard – Administration');
  });
});
