import { test, expect } from '@playwright/test';

test('renders the public demo scoreboard at the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/?demo=true');

  await expect(page.getByRole('table', { name: 'Bronze Aktiv Wertungsliste' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Allerheiligen-Lebing Gruppe 1', exact: true })).toBeVisible();
});
