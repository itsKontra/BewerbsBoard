import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 360, height: 740 } });

test('finds a brigade without renumbering and remembers it across visits', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('table').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: test.info().outputPath('mobile-scoreboard.png'), animations: 'disabled' });
  await page.getByRole('searchbox').fill('obernstrass');
  const row = page.getByRole('row').filter({ hasText: 'Obernstraß' });
  await expect(row).toHaveAttribute('data-rank', '3');
  await expect(row.getByText('96,60 s', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Obernstraß merken' }).click();
  await page.getByRole('button', { name: 'Meine Feuerwehr' }).click();
  await expect(page.getByRole('heading', { name: 'Meine Feuerwehr' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Obernstraß' })).toHaveAttribute('data-rank', '3');
  await page.screenshot({ path: test.info().outputPath('saved-brigade.png'), animations: 'disabled' });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Obernstraß nicht mehr merken' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Meine Feuerwehr' }).click();
  await page.getByRole('button', { name: 'Obernstraß nicht mehr merken' }).click();
  await expect(page.getByRole('button', { name: 'Feuerwehr finden' })).toBeVisible();
  await page.getByRole('button', { name: 'Feuerwehr finden' }).click();
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('switches between upcoming starts and every ranking without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Startliste', exact: true }).click();
  await expect(page.getByText('Reitberg', { exact: true })).toBeVisible();
  await expect(page.getByText('#1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ergebnisse', exact: true }).click();
  const tabs = page.getByRole('navigation', { name: 'Wertungen', exact: true }).getByRole('button');
  for (const tab of await tabs.all()) {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
    for (const row of await page.getByRole('row').all()) {
      const bounds = await row.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
    }
  }
});

test('shows the last results when polling fails and recovers automatically', async ({ page }) => {
  let failed = false;
  await page.route('/api/public/results', async (route) => {
    if (failed) await route.fulfill({ status: 503, body: '{}' });
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('table')).toBeVisible();
  failed = true;
  await expect(page.getByRole('alert')).toContainText('Du siehst den letzten Stand', { timeout: 8000 });
  await expect(page.getByRole('cell', { name: 'Allerheiligen-Lebing Gruppe 1' })).toBeVisible();
  failed = false;
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 8000 });
});

test('fits long event and brigade names with large combined scores', async ({ page }) => {
  const response = await page.request.get('/api/public/results');
  const data = await response.json();
  data.eventTitle = '72. Landesfeuerwehrleistungsbewerb und Landesfeuerwehrjugendleistungsbewerb';
  const category = data.categories['gesamt-feuerwehr'];
  category.rankedResults[0].fireBrigadeName = 'Freiwillige Feuerwehr Sankt Georgen an der Gusen';
  category.rankedResults[0].scoreHundredths = 399996;
  data.categories = { 'gesamt-feuerwehr': category };
  await page.route('/api/public/results', route => route.fulfill({ json: data }));
  await page.goto('/');
  await expect(page.getByText('3999,96 s', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  const name = await page.locator('.public-brigade-name').first().boundingBox();
  const score = await page.locator('.public-result-score').first().boundingBox();
  expect(name!.x + name!.width).toBeLessThanOrEqual(score!.x);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.public-event').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
});
