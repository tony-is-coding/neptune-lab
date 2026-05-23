import { test, expect } from '@playwright/test';
import { attachDiagnostics, printReport } from './helpers';

test.describe('Smoke Tests', () => {
  test('login page renders correctly', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // 标题和品牌
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('text=Neptune-AI')).toBeVisible();

    // 表单元素
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // 切换到注册模式
    await page.click('text=Sign up');
    await expect(page.locator('h1', { hasText: 'Create account' })).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });

  test('unauthenticated user is redirected to login on protected route', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.pathname === '/login', { waitUntil: 'domcontentloaded' });

    expect(page.url()).toContain('/login');
    await expect(page.locator('text=Welcome back')).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    expect(stored).toBeNull();
    printReport(diag, page.url(), stored);
  });

  test('no JavaScript errors on login page', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // 页面不应有 JS 错误（console.warn 是允许的）
    const jsErrors = diag.errors.filter(e =>
      !e.includes('mock data') && !e.includes('backend')
    );
    expect(jsErrors).toEqual([]);

    printReport(diag, page.url(), null);
  });
});
