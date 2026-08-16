import { test, expect } from '@playwright/test';

test.describe('TV Admin Access Splash and Admin Dashboard Controls', () => {
  test('renders /tv at 1920x1080 viewport with Admin Access Splash Canvas when adminSplashEnabled', async ({ page }) => {
    // Set required 1920x1080 viewport for /tv
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Mock the tv-state API endpoint to return adminSplashEnabled: true
    await page.route('/api/public/tv-state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'ROTATION',
          selectedCategoryId: null,
          eventTitle: 'Feuerwehr Leistungsbewerb 2026',
          rankingPageDurationMs: 8000,
          tvAnnouncement: { headline: '', message: '' },
          tvPresentation: {
            theme: 'broadcast',
            logoUrl: '/logo.png',
            headerLabel: 'Feuerwehr Leistungsbewerb',
            qrCodeEnabled: true,
            qrCodeAlwaysVisible: false,
            qrCodeIntervalSeconds: 30,
            qrCodeDurationSeconds: 10,
            adminSplashEnabled: true,
          },
          serverInfo: {
            serverIp: '192.168.1.150',
            serverPort: 3080,
            adminUrl: 'http://192.168.1.150:3080/admin',
            availableIps: [
              { interfaceName: 'eth0', ip: '192.168.1.150' },
            ],
          },
          categoriesConfig: {},
        }),
      });
    });

    await page.goto('/tv');

    // Verify TV Admin Splash Canvas elements
    const splashCanvas = page.getByTestId('tv-admin-splash-canvas');
    await expect(splashCanvas).toBeVisible();

    const adminUrlText = page.getByTestId('admin-access-url');
    await expect(adminUrlText).toBeVisible();
    await expect(adminUrlText).toContainText('192.168.1.150:3080/admin');

    const qrCode = page.getByTestId('admin-access-qr');
    await expect(qrCode).toBeVisible();
  });

  test('renders /admin at 1920x1080 with settings and live broadcast notice', async ({ page }) => {
    // Set required 1920x1080 viewport for /admin
    await page.setViewportSize({ width: 1920, height: 1080 });

    let currentAdminSplashEnabled = true;

    // Mock admin APIs
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

    await page.route('/api/admin/evaluation-types', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('/api/admin/tv-state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'ROTATION',
          selectedCategoryId: null,
          updatedAt: Date.now(),
        }),
      });
    });

    await page.route('/api/admin/config', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.tvPresentation?.adminSplashEnabled !== undefined) {
          currentAdminSplashEnabled = body.tvPresentation.adminSplashEnabled;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          eventTitle: 'Feuerwehr Leistungsbewerb 2026',
          publicUrl: 'https://bewerb.feuerwehr.at',
          rankingPageDurationMs: 8000,
          tvAnnouncement: { headline: '', message: '' },
          tvPresentation: {
            theme: 'broadcast',
            logoOverride: '',
            headerLabel: 'Feuerwehr Leistungsbewerb',
            qrCodeEnabled: true,
            qrCodeAlwaysVisible: false,
            qrCodeIntervalSeconds: 30,
            qrCodeDurationSeconds: 10,
            adminSplashEnabled: currentAdminSplashEnabled,
          },
          serverInfo: {
            serverIp: '192.168.1.150',
            serverPort: 3080,
            adminUrl: 'http://192.168.1.150:3080/admin',
            availableIps: [{ interfaceName: 'eth0', ip: '192.168.1.150' }],
          },
        }),
      });
    });

    await page.goto('/admin');

    // Navigate to TV broadcast tab ("TV-Steuerung") via role='tab'
    const tvTab = page.getByRole('tab', { name: /TV-Steuerung/i }).first();
    await tvTab.click();

    // On TV broadcast tab, the splash banner should be visible when splash is active
    const splashBanner = page.getByTestId('admin-splash-active-banner');
    await expect(splashBanner).toBeVisible();

    // Clicking dismiss button should update config
    const dismissBtn = splashBanner.getByRole('button', { name: /TV-Scoreboard freigeben/i });
    await dismissBtn.click();
    await expect(splashBanner).not.toBeVisible();

    // Navigate to Settings tab and verify the toggle in QR-Code & URL subtab
    const settingsTab = page.getByRole('tab', { name: /Einstellungen/i }).first();
    await settingsTab.click();

    const qrSubtabBtn = page.getByRole('button', { name: /QR-Code & URL/i });
    await qrSubtabBtn.click();

    const splashToggle = page.getByLabel(/Admin-Zugang auf TV anzeigen/i);
    await expect(splashToggle).toBeVisible();
    await expect(splashToggle).not.toBeChecked();
  });
});
