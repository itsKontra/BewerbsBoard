import { test } from '@playwright/test';
import * as path from 'path';

test.describe('Capture application screenshots', () => {
  test('capture all views', async ({ page }) => {
    // 1. Capture Admin Dashboard at 1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    // Ensure active start order or data is loaded
    await page.waitForSelector('text=Erfassung');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join('docs', 'images', 'admin-dashboard.png'),
      fullPage: false,
    });

    // 2. Capture Public Scoreboard at 360x740 (or full page)
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // Let's capture both a viewport one and fullPage
    await page.screenshot({
      path: path.join('docs', 'images', 'public-scoreboard.png'),
      fullPage: true,
    });

    // 3. Capture TV Scoreboard Theme 1 (Broadcast) at 1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/tv?theme=broadcast');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join('docs', 'images', 'tv-scoreboard.png'),
      fullPage: false,
    });

    // 4. Capture TV Scoreboard Theme 2 (Ceremony) at 1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/tv?theme=ceremony');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join('docs', 'images', 'tv-scoreboard-theme-2.png'),
      fullPage: false,
    });

    // 5. Capture TV Scoreboard Theme 3 (Outdoor) at 1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/tv?theme=outdoor');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join('docs', 'images', 'tv-scoreboard-theme-3.png'),
      fullPage: false,
    });

    // 6. Generate bewerbsboard-overview.png from overview HTML template
    await page.setViewportSize({ width: 1920, height: 1080 });
    const overviewPath = path.resolve('scripts', 'generate-overview.html');
    await page.goto(`file:///${overviewPath.replace(/\\/g, '/')}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join('docs', 'images', 'bewerbsboard-overview.png'),
      fullPage: false,
    });
  });
});

