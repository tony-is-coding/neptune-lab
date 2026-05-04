import { test, expect } from '@playwright/test';
import { attachDiagnostics, printReport, DEV_URL, TEST_USER } from './helpers';

test.describe('Login', () => {
  test('登录 → 首页 → API 请求携带 token', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto(`${DEV_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // 等足够时间让登录+跳转+API请求全部完成
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, currentUrl, stored);

    expect(diag.errors.length, `Page errors: ${diag.errors.join('; ')}`).toBe(0);
    expect(currentUrl, 'Should navigate away from /login').not.toContain('/login');
    expect(stored, 'Auth should be persisted').not.toBeNull();

    const parsed = JSON.parse(stored!);
    expect(parsed?.state?.isAuthenticated).toBe(true);
    expect(parsed?.state?.token).toBeTruthy();
  });

  test('登录后刷新页面保持认证状态', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 先登录
    await page.goto(`${DEV_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // 等登录完成
    await page.waitForTimeout(5000);

    // 刷新页面
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, currentUrl, stored);

    expect(currentUrl, 'Should stay on / after refresh').not.toContain('/login');
    expect(JSON.parse(stored!)?.state?.isAuthenticated).toBe(true);
  });

  test('错误密码返回 401 并留在登录页', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto(`${DEV_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, currentUrl, stored);

    expect(currentUrl, 'Should stay on /login').toContain('/login');
    // 验证后端返回了 401
    const has401 = diag.requests.some(r => r.includes('401'));
    expect(has401, 'Should have received 401 from backend').toBeTruthy();
  });
});
