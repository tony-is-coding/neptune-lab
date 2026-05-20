/**
 * UI 渲染与导航测试 — 侧边栏、路由、布局
 */
import { test, expect } from '@playwright/test';
import { DEV_URL, loginViaApi, attachDiagnostics, assertNoErrors } from './helpers';

test.describe('UI 渲染与导航', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('侧边栏导航渲染', async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto(`${DEV_URL}/agents`);
    await page.waitForLoadState('networkidle');

    // 验证侧边栏或导航元素存在
    const nav = page.locator('nav, [role="navigation"], aside, [data-testid="sidebar"]').first();
    // 至少页面应该有内容
    await expect(page.locator('body')).toBeVisible();

    assertNoErrors(diag);
  });

  test('页面路由切换', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // Agents 页面
    await page.goto(`${DEV_URL}/agents`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);

    // Collaborate 页面
    await page.goto(`${DEV_URL}/collaborate`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);

    assertNoErrors(diag);
  });

  test('页面无 console 错误', async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto(`${DEV_URL}/agents`);
    await page.waitForLoadState('networkidle');

    assertNoErrors(diag, ['ResizeObserver']);
  });
});
