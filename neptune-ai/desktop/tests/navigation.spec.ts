import { test, expect } from '@playwright/test';
import { attachDiagnostics, printReport, DEV_URL, TEST_USER } from './helpers';

test.describe('Navigation', () => {
  // 每个 test 前先登录
  test.beforeEach(async ({ page }) => {
    await page.goto(`${DEV_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/', { timeout: 10000 });
  });

  test('首页加载 Agent 列表', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, currentUrl, stored);

    expect(currentUrl).toContain('localhost:1420/');
    // 验证有 "ACTIVE AGENTS" 标题
    const heading = page.getByText('ACTIVE AGENTS');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('侧边栏导航切换页面', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 点击 Skills 导航 — 使用 data-testid 精确定位
    const skillsNav = page.getByTestId('nav-skills');
    await skillsNav.click();
    await page.waitForTimeout(2000);

    let currentUrl = page.url();
    expect(currentUrl, 'Should navigate to /skills').toContain('/skills');

    // 点击 Agents 导航回到首页
    const agentsNav = page.getByTestId('nav-agents');
    await agentsNav.click();
    await page.waitForTimeout(2000);

    currentUrl = page.url();
    expect(currentUrl, 'Should navigate back to /').toContain('localhost:1420/');

    printReport(diag, currentUrl, null);
  });
});
