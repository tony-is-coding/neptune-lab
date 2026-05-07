/**
 * 冒烟测试 — 验证基础渲染和连通性
 */
import { test, expect } from '@playwright/test';
import { DEV_URL, API_URL, attachDiagnostics, assertNoErrors } from './helpers';

test.describe('冒烟测试', () => {
  test('登录页正常渲染', async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto(DEV_URL);

    // 未认证应重定向到登录页
    await expect(page).toHaveURL(/\/login/);

    // 登录页关键元素可见
    await expect(page.locator('input[type="email"], input[placeholder*="邮箱"], input[placeholder*="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();

    assertNoErrors(diag);
  });

  test('后端 API 健康检查', async ({ request }) => {
    const response = await request.get(`${API_URL.replace('/api/v1', '')}/health`);
    expect(response.ok()).toBeTruthy();
  });

  test('页面无 JS 错误', async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto(DEV_URL);
    await page.waitForLoadState('networkidle');

    assertNoErrors(diag, ['ResizeObserver']); // ResizeObserver 是已知无害错误
  });
});
