import { test, expect } from '@playwright/test';
import { attachDiagnostics, printReport, API_URL, TEST_USER } from './helpers';

test.describe('Auth Flow', () => {
  test('login with valid credentials', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // 填写登录表单
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeVisible({ timeout: 10000 });
    expect(page.url()).not.toContain('/login');

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.isAuthenticated).toBe(true);
    expect(parsed.state.token).toBeTruthy();
    expect(parsed.state.user).toBeTruthy();

    printReport(diag, page.url(), stored);
  });

  test('auth state persists after page refresh', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 先登录
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeVisible({ timeout: 10000 });

    await page.reload({ waitUntil: 'domcontentloaded' });

    expect(page.url()).not.toContain('/login');
    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });

  test('login with wrong credentials shows error', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await page.fill('#email', 'wrong@test.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // 应该显示错误提示
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });

    // 应该仍然在登录页
    expect(page.url()).toContain('/login');

    // localStorage 不应有 auth 状态
    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.state.isAuthenticated).toBeFalsy();
    }

    printReport(diag, page.url(), stored);
  });

  test('register mode works', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // 切换到注册模式
    await page.click('text=Sign up');
    await expect(page.locator('h1', { hasText: 'Create account' })).toBeVisible();

    // 验证有 name 字段
    await expect(page.locator('#name')).toBeVisible();

    // 填写注册表单
    const testEmail = `test_${Date.now()}@test.com`;
    await page.fill('#name', 'Test User');
    await page.fill('#email', testEmail);
    await page.fill('#password', 'TestPassword123!');

    // 切换回登录模式
    await page.click('text=Sign in');
    await expect(page.locator('h1', { hasText: 'Welcome back' })).toBeVisible();

    // name 字段应该消失了
    await expect(page.locator('#name')).not.toBeVisible();

    printReport(diag, page.url(), null);
  });
});
