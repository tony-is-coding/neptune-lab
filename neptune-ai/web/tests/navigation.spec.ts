import { test, expect } from '@playwright/test';
import { attachDiagnostics, printReport, loginViaApi } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('home page loads agent list from API', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 页面应显示侧边栏
    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });

  test('sidebar navigation switches pages', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 点击 Skills 导航
    await page.click('[data-testid="nav-skills"]');
    await page.waitForURL('**/skills');
    expect(page.url()).toContain('/skills');

    // 点击 Home 导航
    await page.click('[data-testid="nav-home"]');
    await page.waitForURL('**/');
    expect(page.url()).toMatch(/localhost:\d+\/$/);

    // 点击 Collaborate 导航
    await page.click('[data-testid="nav-collaborate"]');
    // collaborate 可能重定向到 /collaborate/:agentId 或停留在 /collaborate
    await page.waitForURL(/\/collaborate/, { timeout: 10000 });
    expect(page.url()).toContain('/collaborate');

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });

  test('sidebar highlights active page with dot indicator', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Home 应该有 active dot indicator（一个小圆点）
    const homeLink = page.locator('[data-testid="nav-home"]');
    // 检查 active dot（绝对定位的 span 元素）
    const homeDot = homeLink.locator('span.absolute');
    await expect(homeDot).toBeVisible();

    // 切换到 Skills
    await page.click('[data-testid="nav-skills"]');
    await page.waitForURL('**/skills');

    // Skills 应该有 active dot
    const skillsLink = page.locator('[data-testid="nav-skills"]');
    const skillsDot = skillsLink.locator('span.absolute');
    await expect(skillsDot).toBeVisible();

    // Home 不再有 active dot
    const homeDotAfter = homeLink.locator('span.absolute');
    await expect(homeDotAfter).not.toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });
});
