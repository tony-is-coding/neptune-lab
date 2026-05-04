import { test, expect } from '@playwright/test';
import { attachDiagnostics, printReport, DEV_URL } from './helpers';

test.describe('Smoke — 基础页面加载', () => {
  test('登录页正确渲染', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto(`${DEV_URL}/login`);
    await page.waitForLoadState('networkidle');

    // 检查关键元素
    await expect(page.getByText('Neptune-AI', { exact: true })).toBeVisible();
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    printReport(diag, page.url(), null);
    expect(diag.errors.length).toBe(0);
  });

  test('未认证自动跳转登录页', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto(`${DEV_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    expect(page.url(), 'Should redirect to /login').toContain('/login');
    printReport(diag, page.url(), null);
  });
});
