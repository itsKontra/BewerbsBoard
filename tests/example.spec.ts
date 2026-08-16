import { test, expect } from '@playwright/test';

test('renders the public demo scoreboard at the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/?demo=true');

  await expect(page.getByText('Wertungsliste', { exact: true })).toBeVisible();
  await expect(page.getByText('Allerheiligen-Lebing 1', { exact: true }).first()).toBeVisible();
});
