import { test, expect } from '@playwright/test';

test.describe('TV Scoreboard Custom Logo and Offline Branding', () => {
  test('renders default bundled logo and preset logos on /tv at 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // 1. Default logo
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
            adminSplashEnabled: false,
          },
          serverInfo: { serverIp: '127.0.0.1', serverPort: 3000, adminUrl: 'http://127.0.0.1:3000/admin', availableIps: [] },
          categoriesConfig: {},
        }),
      });
    });

    await page.goto('/tv');

    const defaultLogo = page.getByTestId('tv-header-logo');
    await expect(defaultLogo).toBeVisible();
    await expect(defaultLogo).toHaveAttribute('src', '/logo.png');

    // 2. Preset logo: logo_alt_1.png
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
            theme: 'ceremony',
            logoUrl: '/logo-options/logo_alt_1.png',
            headerLabel: 'Landesbewerb Live',
            qrCodeEnabled: true,
            qrCodeAlwaysVisible: false,
            qrCodeIntervalSeconds: 30,
            qrCodeDurationSeconds: 10,
            adminSplashEnabled: false,
          },
          serverInfo: { serverIp: '127.0.0.1', serverPort: 3000, adminUrl: 'http://127.0.0.1:3000/admin', availableIps: [] },
          categoriesConfig: {},
        }),
      });
    });

    await page.reload();

    const alt1Logo = page.getByTestId('tv-header-logo');
    await expect(alt1Logo).toBeVisible();
    await expect(alt1Logo).toHaveAttribute('src', '/logo-options/logo_alt_1.png');
  });

  test('admin dashboard allows selecting presets and updates live preview at 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    let currentLogoOverride = '';

    await page.route('/api/admin/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, username: 'admin', roles: ['admin'] }),
      });
    });

    await page.route('/api/admin/evaluation-types', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('/api/admin/tv-state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'ROTATION', selectedCategoryId: null, updatedAt: Date.now() }),
      });
    });

    await page.route('/api/public/logo', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not Found"}' });
    });

    await page.route('/api/admin/config', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = JSON.parse(route.request().postData() || '{}');
        currentLogoOverride = body.tvPresentation?.logoOverride ?? '';
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
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
            logoOverride: currentLogoOverride,
            headerLabel: 'Feuerwehr Leistungsbewerb',
            qrCodeEnabled: true,
            qrCodeAlwaysVisible: false,
            qrCodeIntervalSeconds: 30,
            qrCodeDurationSeconds: 10,
            adminSplashEnabled: false,
          },
        }),
      });
    });

    await page.goto('/admin');

    // Go to Settings tab
    const settingsTab = page.getByRole('tab', { name: /Einstellungen/i }).first();
    await settingsTab.click();

    // Verify preset radio buttons are visible
    const alt2Radio = page.locator('input[name="tv-logo-preset"][value="alt-2"]');
    await expect(alt2Radio).toBeAttached();

    // Click Alternative 2 card
    const alt2Label = page.locator('label').filter({ hasText: /Alternative 2/i }).first();
    await alt2Label.click();

    // Verify Live Header Preview image updated
    const livePreviewImg = page.getByTestId('admin-settings-logo-preview');
    await expect(livePreviewImg).toBeVisible();
    await expect(livePreviewImg).toHaveAttribute('src', '/logo-options/logo_alt_2.png');

    // Save changes
    const saveButton = page.getByRole('button', { name: /Änderungen speichern/i });
    await saveButton.click();

    expect(currentLogoOverride).toBe('/logo-options/logo_alt_2.png');
  });

  test('admin dashboard handles custom file upload and updates preview at 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    let currentLogoOverride = '';
    const uploadedTimestamp = 1740000000123;
    const uploadedLogoUrl = `/api/public/logo?v=${uploadedTimestamp}`;

    await page.route('/api/admin/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, username: 'admin', roles: ['admin'] }),
      });
    });

    await page.route('/api/admin/evaluation-types', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('/api/admin/tv-state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'ROTATION', selectedCategoryId: null, updatedAt: Date.now() }),
      });
    });

    await page.route('/api/public/logo', async (route) => {
      if (currentLogoOverride.startsWith('/api/public/logo')) {
        await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('fake-image-bytes') });
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not Found"}' });
      }
    });

    await page.route('/api/admin/logo/upload', async (route) => {
      currentLogoOverride = uploadedLogoUrl;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, logoUrl: uploadedLogoUrl }),
      });
    });

    await page.route('/api/admin/config', async (route) => {
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
            logoOverride: currentLogoOverride,
            headerLabel: 'Feuerwehr Leistungsbewerb',
            qrCodeEnabled: true,
            qrCodeAlwaysVisible: false,
            qrCodeIntervalSeconds: 30,
            qrCodeDurationSeconds: 10,
            adminSplashEnabled: false,
          },
        }),
      });
    });

    await page.goto('/admin');

    // Go to Settings tab
    const settingsTab = page.getByRole('tab', { name: /Einstellungen/i }).first();
    await settingsTab.click();

    // Upload file via hidden file input
    const fileInput = page.locator('input[type="file"][aria-label="Eigenes Logo hochladen"]');
    await fileInput.setInputFiles({
      name: 'event-sponsor.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d0000000049454e44ae426082', 'hex'),
    });

    // Check that Live Header Preview has updated to custom logo endpoint
    const livePreviewImg = page.getByTestId('admin-settings-logo-preview');
    await expect(livePreviewImg).toHaveAttribute('src', uploadedLogoUrl);

    // Stored custom logo action box should be visible
    await expect(page.getByText('Gespeichertes eigenes Logo')).toBeVisible();
  });

  test('admin dashboard handles remote URL download and custom logo deletion at 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    let currentLogoOverride = '';
    const fetchedLogoUrl = '/api/public/logo?v=1740000000999';

    await page.route('/api/admin/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, username: 'admin', roles: ['admin'] }),
      });
    });

    await page.route('/api/admin/evaluation-types', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('/api/admin/tv-state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'ROTATION', selectedCategoryId: null, updatedAt: Date.now() }),
      });
    });

    await page.route('/api/public/logo', async (route) => {
      if (currentLogoOverride.startsWith('/api/public/logo')) {
        await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('fake-image-bytes') });
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Not Found"}' });
      }
    });

    await page.route('/api/admin/logo/fetch-url', async (route) => {
      currentLogoOverride = fetchedLogoUrl;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, logoUrl: fetchedLogoUrl }),
      });
    });

    await page.route('/api/admin/logo', async (route) => {
      if (route.request().method() === 'DELETE') {
        currentLogoOverride = '';
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
        return;
      }
      await route.fallback();
    });

    await page.route('/api/admin/config', async (route) => {
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
            logoOverride: currentLogoOverride,
            headerLabel: 'Feuerwehr Leistungsbewerb',
            qrCodeEnabled: true,
            qrCodeAlwaysVisible: false,
            qrCodeIntervalSeconds: 30,
            qrCodeDurationSeconds: 10,
            adminSplashEnabled: false,
          },
        }),
      });
    });

    await page.goto('/admin');

    // Go to Settings tab
    const settingsTab = page.getByRole('tab', { name: /Einstellungen/i }).first();
    await settingsTab.click();

    // Switch to URL-Download subtab ("Von URL abrufen")
    const urlTabBtn = page.getByRole('button', { name: /Von URL abrufen/i });
    await urlTabBtn.click();

    // Enter remote URL
    const urlInput = page.locator('#remoteLogoUrlInput');
    await urlInput.fill('https://assets.feuerwehr.at/partner-logo.png');

    // Click Download button ("Herunterladen & Speichern")
    const fetchBtn = page.getByRole('button', { name: /Herunterladen & Speichern/i });
    await fetchBtn.click();

    // Verify live preview is updated
    const livePreviewImg = page.getByTestId('admin-settings-logo-preview');
    await expect(livePreviewImg).toHaveAttribute('src', fetchedLogoUrl);

    // Delete custom logo ("Eigenes Logo löschen")
    const deleteBtn = page.getByRole('button', { name: /Eigenes Logo löschen/i });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify preview reverts to default logo
    await expect(livePreviewImg).toHaveAttribute('src', '/logo.png');
  });

  test('/tv gracefully falls back to /logo.png on image error in offline conditions at 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Set custom logo in TV state that simulates a 404 or offline failure
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
            logoUrl: '/api/public/logo?v=missing-or-offline',
            headerLabel: 'Feuerwehr Leistungsbewerb',
            qrCodeEnabled: true,
            qrCodeAlwaysVisible: false,
            qrCodeIntervalSeconds: 30,
            qrCodeDurationSeconds: 10,
            adminSplashEnabled: false,
          },
          serverInfo: { serverIp: '127.0.0.1', serverPort: 3000, adminUrl: 'http://127.0.0.1:3000/admin', availableIps: [] },
          categoriesConfig: {},
        }),
      });
    });

    // Simulate network error / 404 for the custom logo
    await page.route('/api/public/logo*', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/tv');

    const tvLogo = page.getByTestId('tv-header-logo');
    await expect(tvLogo).toBeVisible();

    // The onError handler must fallback to /logo.png
    await expect(tvLogo).toHaveAttribute('src', '/logo.png');

    // Ensure layout remains stable
    const header = page.locator('header[aria-label="Identity Rail"]');
    await expect(header).toBeVisible();
    await expect(header.getByRole('heading', { level: 1 })).toHaveText('Feuerwehr Leistungsbewerb 2026');
  });
});
