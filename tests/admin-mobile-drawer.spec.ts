import { test, expect } from '@playwright/test';

test.describe('Admin Mobile Navigation Drawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });

    await page.route('/api/admin/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          username: 'admin',
          roles: ['admin'],
        }),
      });
    });

    await page.route('/api/admin/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          eventTitle: 'Test Event',
          publicUrl: 'https://test.local',
          rankingPageDurationMs: 8000,
          tvAnnouncement: { headline: '', message: '' },
          tvPresentation: {
            theme: 'broadcast',
            logoOverride: '',
            headerLabel: 'Test',
            qrCodeEnabled: false,
          },
        }),
      });
    });

    await page.route('/api/admin/evaluation-types', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('/api/admin/tv-state', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
  });

  test('drawer closes and does not block interaction after selecting a navigation tab', async ({ page }) => {
    await page.goto('/admin');

    const menuBtn = page.locator('#drawer-open');
    await expect(menuBtn).toBeVisible();

    // 1. Open drawer and navigate to Einstellungen (Settings)
    await menuBtn.click();
    const drawer = page.locator('#drawer');
    await expect(drawer).toBeVisible();

    const settingsTab = drawer.getByRole('tab', { name: /einstellungen/i });
    await expect(settingsTab).toBeVisible();
    await settingsTab.click();

    // Verify Settings tab content is clickable
    const qrSubTab = page.getByRole('button', { name: 'QR-Code & URL' });
    await expect(qrSubTab).toBeVisible();
    await qrSubTab.click({ timeout: 3000 });

    // 2. Open drawer again and navigate to another tab (Logs & Status)
    await menuBtn.click();
    await expect(drawer).toBeVisible();

    const logsTab = drawer.getByRole('tab', { name: /logs/i });
    await expect(logsTab).toBeVisible();
    await logsTab.click();

    // Verify page interaction works on new tab
    await menuBtn.click({ timeout: 3000 });
    await expect(drawer).toBeVisible();
  });

  test('drawer closes when clicking the X close button and page remains interactive', async ({ page }) => {
    await page.goto('/admin');

    const menuBtn = page.locator('#drawer-open');
    await expect(menuBtn).toBeVisible();

    // Open drawer
    await menuBtn.click();
    const drawer = page.locator('#drawer');
    await expect(drawer).toBeVisible();

    // Click close button
    const closeBtn = drawer.getByRole('button', { name: /menü schließen/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Drawer should close
    await expect(drawer).not.toBeVisible();

    // Menu button should be immediately clickable again
    await menuBtn.click({ timeout: 3000 });
    await expect(drawer).toBeVisible();
  });

  test('drawer closes when clicking backdrop outside sheet and page remains interactive', async ({ page }) => {
    await page.goto('/admin');

    const menuBtn = page.locator('#drawer-open');
    await expect(menuBtn).toBeVisible();

    // Open drawer
    await menuBtn.click();
    const drawer = page.locator('#drawer');
    await expect(drawer).toBeVisible();

    // Click on backdrop (top-right corner of drawer, which is outside the max-w-xs sheet)
    await drawer.click({ position: { x: 340, y: 300 } });

    // Drawer should close
    await expect(drawer).not.toBeVisible();

    // Menu button should be immediately clickable again
    await menuBtn.click({ timeout: 3000 });
    await expect(drawer).toBeVisible();
  });

  test('drawer closes when pressing Escape key', async ({ page }) => {
    await page.goto('/admin');

    const menuBtn = page.locator('#drawer-open');
    await expect(menuBtn).toBeVisible();

    // Open drawer
    await menuBtn.click();
    const drawer = page.locator('#drawer');
    await expect(drawer).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Drawer should close
    await expect(drawer).not.toBeVisible();

    // Menu button should be immediately clickable again
    await menuBtn.click({ timeout: 3000 });
    await expect(drawer).toBeVisible();
  });
});
