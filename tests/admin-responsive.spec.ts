import { test, expect } from '@playwright/test';

const MOCK_CONFIG = {
  eventTitle: 'Feuerwehr Leistungsbewerb Test',
  publicUrl: 'https://bewerb.feuerwehr.at',
  rankingPageDurationMs: 8000,
  tvAnnouncement: { headline: 'Test Durchsage', message: 'Wichtige Mitteilung an alle Teilnehmer' },
  tvPresentation: {
    theme: 'broadcast',
    logoOverride: '',
    headerLabel: 'Test Header',
    qrCodeEnabled: true,
    qrCodeAlwaysVisible: false,
    qrCodeIntervalSeconds: 30,
    qrCodeDurationSeconds: 10,
    adminSplashEnabled: false,
  },
  serverInfo: {
    serverIp: '192.168.1.100',
    serverPort: 3000,
    adminUrl: 'http://192.168.1.100:3000/admin',
    availableIps: [{ interfaceName: 'eth0', ip: '192.168.1.100' }],
  },
};

const MOCK_COMPETITION_CLASSES = [
  { id: 'cc-1', name: 'Bronze' },
  { id: 'cc-2', name: 'Silber' },
];

const MOCK_CATEGORY_TYPES = [
  { id: 'cat-1', name: 'Bronze A', competitionClassId: 'cc-1', hasRelayRace: true },
  { id: 'cat-2', name: 'Silber A', competitionClassId: 'cc-2', hasRelayRace: false },
];

const MOCK_BRIGADES = [
  { id: 'b-1', name: 'FF Neustadt' },
  { id: 'b-2', name: 'FF Altdorf' },
];

const MOCK_GROUPS = [
  { id: 'g-1', fireBrigadeId: 'b-1', name: 'Gruppe 1', competitionClass: 'Bronze', competitionClassId: 'cc-1' },
  { id: 'g-2', fireBrigadeId: 'b-2', name: 'Gruppe 2', competitionClass: 'Silber', competitionClassId: 'cc-2' },
];

const MOCK_CATEGORY_ENTRIES = [
  {
    id: 'entry-1',
    groupId: 'g-1',
    categoryTypeId: 'cat-1',
    categoryTypeName: 'Bronze A',
    runStatus: 'OPEN',
    startOrderPosition: 1,
    attackTimeHundredths: null,
    attackTimeErrors: null,
    relayRaceHundredths: null,
    relayRaceErrors: null,
    groupName: 'Gruppe 1',
    competitionClass: 'Bronze',
    fireBrigadeId: 'b-1',
    fireBrigadeName: 'FF Neustadt',
    hasRelayRace: true,
  },
  {
    id: 'entry-2',
    groupId: 'g-2',
    categoryTypeId: 'cat-1',
    categoryTypeName: 'Bronze A',
    runStatus: 'VALID',
    startOrderPosition: 2,
    attackTimeHundredths: 4520,
    attackTimeErrors: 0,
    relayRaceHundredths: 6250,
    relayRaceErrors: 10,
    scoreHundredths: 11770,
    groupName: 'Gruppe 2',
    competitionClass: 'Bronze',
    fireBrigadeId: 'b-2',
    fireBrigadeName: 'FF Altdorf',
    hasRelayRace: true,
  },
];

const MOCK_EVALUATION_TYPES = [
  {
    id: 'eval-1',
    name: 'Gesamtwertung Bronze',
    categoryTypeId1: 'cat-1',
    categoryTypeName1: 'Bronze A',
    hasRelayRace1: true,
    categoryTypeId2: null,
    excludeRelayRace: false,
    isBrigadePairing: false,
    showSingleResults: false,
    public: true,
    publicTv: true,
    displayDurationSeconds: 10,
    order: 1,
  },
];

const MOCK_AUDIT_LOGS = {
  logs: [
    {
      id: 'log-1',
      timestamp: Date.now() - 60000,
      user: 'admin@feuerwehr.at',
      action: 'UPDATE',
      details: JSON.stringify({ previousValue: { status: 'OPEN' }, newValue: { status: 'VALID' } }),
    },
  ],
  total: 1,
  totalPages: 1,
  page: 1,
  limit: 20,
};

async function setupMockRoutes(page: any) {
  await page.route('/api/admin/me', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, user: 'admin@feuerwehr.at', roles: ['admin'] }),
    });
  });

  await page.route('/api/admin/config', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CONFIG),
    });
  });

  await page.route('/api/admin/competition-classes', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_COMPETITION_CLASSES),
    });
  });

  await page.route('/api/admin/category-types', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CATEGORY_TYPES),
    });
  });

  await page.route('/api/admin/category-entries', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CATEGORY_ENTRIES),
    });
  });

  await page.route('/api/admin/brigades', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BRIGADES),
    });
  });

  await page.route('/api/admin/groups', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GROUPS),
    });
  });

  await page.route('/api/admin/evaluation-types', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_EVALUATION_TYPES),
    });
  });

  await page.route('/api/admin/tv-state', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mode: 'ROTATION', selectedCategoryId: null }),
    });
  });

  await page.route('/api/admin/audit-logs*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_AUDIT_LOGS),
    });
  });

  await page.route('/api/public/logo', async (route: any) => {
    await route.fulfill({ status: 404 });
  });
}

test.describe('Admin Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRoutes(page);
  });

  test('mobile viewport (360x740): no horizontal overflow and all tabs accessible via drawer', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Mobile header is visible, desktop sidebar is hidden
    await expect(page.locator('#drawer-open')).toBeVisible();
    await expect(page.locator('aside')).toBeHidden();

    // Verify no document-level horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Check Results tab elements
    await expect(page.locator('[data-testid="results-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="open-entry-row-entry-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="valid-entry-row-entry-2"]')).toBeVisible();

    // Verify navigation across all tabs on mobile via drawer
    const tabsToTest = [
      { name: /teilnehmer/i, expectedContent: /startreihenfolge|stammdaten/i },
      { name: /tv-steuerung/i, expectedContent: /leitstand|rotation/i },
      { name: /bewerbs-setup/i, expectedContent: /klassen|wertungen/i },
      { name: /einstellungen/i, expectedContent: /allgemein|qr-code/i },
      { name: /logs/i, expectedContent: /system & wartung|wartung/i },
    ];

    for (const tab of tabsToTest) {
      // Open drawer
      await page.locator('#drawer-open').click();
      const drawer = page.locator('#drawer');
      await expect(drawer).toBeVisible();

      // Click tab
      const tabButton = drawer.getByRole('tab', { name: tab.name });
      await expect(tabButton).toBeVisible();
      await tabButton.click();

      // Drawer closes
      await expect(drawer).not.toBeVisible();

      // Tab content is visible
      await expect(page.getByText(tab.expectedContent).first()).toBeVisible();

      // Check no horizontal scrollbar on document
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(overflow).toBe(false);
    }
  });

  test('tablet viewport (768x1024): sidebar is visible, top bar fits without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Desktop sidebar is visible, mobile header is hidden
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('#drawer-open')).toBeHidden();

    // Verify no document-level horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Verify top bar items fit without overflow
    const topBar = page.locator('header.hidden.md\\:flex');
    await expect(topBar).toBeVisible();

    // Test tab navigation on tablet
    const participantsTab = page.locator('aside').getByRole('tab', { name: /teilnehmer/i });
    await participantsTab.click();
    await expect(page.getByText(/stammdaten/i).first()).toBeVisible();

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(overflow).toBe(false);
  });

  test('desktop viewport (1920x1080): full layout is spacious and functional', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('[data-testid="results-tab"]')).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('login page is responsive at 360x740 without horizontal overflow', async ({ page }) => {
    await page.route('/api/admin/me', async (route) => {
      await route.fulfill({
        status: 401,
        headers: { 'X-Auth-Mode': 'local' },
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false }),
      });
    });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#local-auth-submit')).toBeVisible();
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('modals (diff inspector and database reset) fit mobile viewport (360x740) without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Navigate to Logs tab via drawer
    await page.locator('#drawer-open').click();
    await page.locator('#drawer').getByRole('tab', { name: /logs/i }).click();
    await expect(page.getByText(/system & wartung/i)).toBeVisible();

    // 1. Test Diff Inspector Modal
    await page.getByRole('button', { name: /details/i }).first().click();
    await expect(page.getByText(/audit-details inspektor/i)).toBeVisible();

    let overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(overflow).toBe(false);

    // Close diff modal
    await page.getByRole('button', { name: /schließen/i }).click();
    await expect(page.getByText(/audit-details inspektor/i)).toBeHidden();

    // 2. Test Database Reset Modal
    await page.getByRole('button', { name: /datenbank leeren/i }).click();
    await expect(page.getByText(/datenbank zurücksetzen/i)).toBeVisible();

    overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(overflow).toBe(false);

    // Close reset modal via Cancel button
    await page.getByRole('button', { name: /abbrechen/i }).click();
    await expect(page.getByText(/datenbank zurücksetzen/i)).toBeHidden();
  });
});

