/**
 * 认证流程测试 — 登录、注册、token 持久化、401 恢复
 */
import { test, expect } from '@playwright/test';
import { DEV_URL, API_URL, loginViaApi, attachDiagnostics, assertNoErrors } from './helpers';

test.describe('认证流程', () => {
  test('管理员登录成功', async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto(`${DEV_URL}/login`);

    // 填写凭证
    await page.locator('input[type="email"], input[placeholder*="邮箱"], input[placeholder*="email"]').first().fill('admin@neptune.ai');
    await page.locator('input[type="password"]').first().fill('admin');

    // 点击登录
    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("登录")').first().click();

    // 应跳转离开登录页
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // localStorage 应有 token
    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.token).toBeTruthy();
    expect(parsed.state.isAuthenticated).toBe(true);

    assertNoErrors(diag);
  });

  test('错误凭证登录失败', async ({ page }) => {
    await page.goto(`${DEV_URL}/login`);

    await page.locator('input[type="email"], input[placeholder*="邮箱"], input[placeholder*="email"]').first().fill('wrong@test.com');
    await page.locator('input[type="password"]').first().fill('wrongpassword');
    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("登录")').first().click();

    // 应仍停留在登录页
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/login/);
  });

  test('API 登录并设置 token', async ({ page }) => {
    const { token } = await loginViaApi(page);

    // 验证 token 已设置
    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    const parsed = JSON.parse(stored!);
    expect(parsed.state.token).toBe(token);
  });

  test('401 恢复 — 无效 token 自动清除', async ({ page }) => {
    // 设置无效 token
    await page.goto(DEV_URL);
    await page.evaluate(() => {
      localStorage.setItem('neptune-auth', JSON.stringify({
        state: {
          token: 'invalid-token-12345',
          user: { id: '1', name: 'Test', email: 'test@test.com', role: 'user', tenantId: '1' },
          isAuthenticated: true,
        },
        version: 0,
      }));
    });

    // 访问需要认证的页面
    await page.goto(`${DEV_URL}/agents`);

    // 应被重定向到登录页（token 无效触发 401）
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // token 应被清除
    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.state?.isAuthenticated).toBeFalsy();
    }
  });
});
