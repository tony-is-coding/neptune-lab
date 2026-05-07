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

    // 应该发起了 GET /agents 请求
    const agentRequests = diag.requests.filter(r => r.includes('/agents') && r.includes('>> GET'));
    expect(agentRequests.length).toBeGreaterThan(0);

    // 页面应显示 Agent 相关内容
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
    // collaborate 可能重定向到 /collaborate/:agentId 或停留在 /collaborate（取决于 API 是否可用）
    await page.waitForURL(/\/collaborate/, { timeout: 10000 });
    expect(page.url()).toContain('/collaborate');

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });

  test('sidebar highlights active page', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Home 应该高亮
    const homeLink = page.locator('[data-testid="nav-home"]');
    await expect(homeLink).toHaveClass(/bg-surface-lowest|shadow-sm/);

    // 切换到 Skills
    await page.click('[data-testid="nav-skills"]');
    await page.waitForURL('**/skills');

    // Skills 应该高亮
    const skillsLink = page.locator('[data-testid="nav-skills"]');
    await expect(skillsLink).toHaveClass(/bg-surface-lowest|shadow-sm/);

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });
});
