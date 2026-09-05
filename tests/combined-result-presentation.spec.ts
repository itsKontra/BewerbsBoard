import { expect, test, type Page } from '@playwright/test';
import type { PublicResultsApiResponse } from '../src/features/public/types';
import type { TvMode, TvStateApiResponse } from '../src/features/tv/hooks/useTvDataFeed';

const categoryId = 'combined-fire-attack';

const resultsData = {
  eventTitle: 'Combined Results Cup',
  publicUrl: 'http://localhost:5173',
  timestamp: 1_775_702_400_000,
  categories: {
    [categoryId]: {
      id: categoryId,
      displayName: 'Combined Fire Attack',
      publicEnabled: true,
      tvEnabled: true,
      order: 1,
      type: 'combined',
      showSingleResults: true,
      categoryTypeName1: 'Bronze',
      categoryTypeName2: 'Silver',
      rankedResults: [
        {
          rank: 1,
          groupId: 'complete-group',
          groupName: 'Complete 1',
          fireBrigadeId: 'complete-brigade',
          fireBrigadeName: 'Complete Brigade',
          scoreHundredths: 8200,
          primaryRun: {
            entryId: 'complete-bronze',
            attackTimeHundredths: 3950,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 4000,
          },
          secondaryRun: {
            entryId: 'complete-silver',
            attackTimeHundredths: 4100,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 4200,
          },
        },
        {
          rank: 2,
          groupId: 'single-group',
          groupName: 'Single 2',
          fireBrigadeId: 'single-brigade',
          fireBrigadeName: 'Single Brigade',
          scoreHundredths: null,
          primaryRun: {
            entryId: 'single-bronze',
            attackTimeHundredths: 4500,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 4500,
          },
          secondaryRun: null,
        },
        {
          rank: null,
          groupId: 'dnf-group',
          groupName: 'DNF 3',
          fireBrigadeId: 'dnf-brigade',
          fireBrigadeName: 'DNF Brigade',
          scoreHundredths: null,
          primaryRun: {
            entryId: 'dnf-bronze',
            runStatus: 'DNF',
            attackTimeHundredths: 4700,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: null,
          },
          secondaryRun: {
            entryId: 'dnf-silver',
            attackTimeHundredths: 4800,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 4800,
          },
        },
      ],
      openEntries: [],
      dnfEntries: [],
    },
  },
} satisfies PublicResultsApiResponse;

function tvState(mode: TvMode): TvStateApiResponse {
  return {
    mode,
    selectedCategoryId: categoryId,
    updatedAt: resultsData.timestamp,
    eventTitle: resultsData.eventTitle,
    rankingPageDurationMs: 60_000,
    tvAnnouncement: { headline: '', message: '' },
    tvPresentation: {
      theme: 'broadcast',
      logoUrl: '/logo.png',
      headerLabel: 'Combined Results',
      qrCodeEnabled: false,
      qrCodeAlwaysVisible: false,
      qrCodeIntervalSeconds: 30,
      qrCodeDurationSeconds: 10,
      adminSplashEnabled: false,
    },
    categoriesConfig: {
      [categoryId]: { tvEnabled: true, order: 1, displayDuration: 60 },
    },
  };
}

async function mockResults(page: Page) {
  await page.route('/api/public/results', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(resultsData),
  }));
}

test('presents complete, single-result, and DNF competitors on TV and keeps DNF off the podium', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockResults(page);

  let mode: TvMode = 'FIXED';
  await page.route('/api/public/tv-state', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(tvState(mode)),
  }));

  await page.goto('/tv');

  const ranking = page.getByRole('table', { name: 'Combined Fire Attack Wertung' });
  const completeRow = ranking.getByRole('row').filter({ hasText: 'Complete Brigade Complete 1' });
  const singleRow = ranking.getByRole('row').filter({ hasText: 'Single Brigade Single 2' });
  const dnfRow = ranking.getByRole('row').filter({ hasText: 'DNF Brigade DNF 3' });

  await expect(completeRow).toHaveAttribute('data-rank', '1');
  await expect(completeRow.locator('td').last()).toHaveText('82,00 s');
  await expect(singleRow).toHaveAttribute('data-rank', '2');
  await expect(singleRow.locator('td').last()).toHaveText('—');
  await expect(dnfRow).not.toHaveAttribute('data-rank', /.+/);
  await expect(dnfRow.locator('td').first()).toHaveText('—');
  await expect(dnfRow.locator('td').last()).toHaveText('—');
  await expect(dnfRow.getByText('DNF', { exact: true })).toBeVisible();
  await expect(dnfRow.getByText('47,00 s', { exact: true })).toHaveCount(0);

  mode = 'WINNERS';
  await page.reload();

  const podium = page.getByTestId('tv-mode-canvas');
  await expect(podium.getByRole('heading', { name: 'Complete Brigade' })).toBeVisible();
  await expect(podium.getByRole('heading', { name: 'Single Brigade' })).toBeVisible();
  await expect(podium.getByText('DNF Brigade', { exact: true })).toHaveCount(0);
});

test('presents complete, single-result, and DNF competitors on the public mobile scoreboard', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await mockResults(page);

  await page.goto('/');

  const completeRow = page.getByRole('row').filter({ hasText: 'Complete Brigade Complete 1' });
  const singleRow = page.getByRole('row').filter({ hasText: 'Single Brigade Single 2' });
  const dnfRow = page.getByRole('row').filter({ hasText: 'DNF Brigade DNF 3' });

  await expect(completeRow.locator(':scope > div').first()).toHaveText('1');
  await expect(completeRow.getByText('82,00 s', { exact: true })).toBeVisible();
  await expect(singleRow.locator(':scope > div').first()).toHaveText('2');
  await expect(singleRow.getByText('—', { exact: true })).toHaveCount(2);
  await expect(dnfRow.locator(':scope > div').first()).toHaveText('—');
  await expect(dnfRow.getByText('DNF', { exact: true })).toBeVisible();
  await expect(dnfRow.getByText('47,00 s', { exact: true })).toHaveCount(0);
});
