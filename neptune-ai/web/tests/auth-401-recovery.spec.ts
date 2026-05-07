import { test, expect } from '@playwright/test';
import { attachDiagnostics, printReport } from './helpers';

test.describe('401 自动恢复', () => {
  test('无效 token 时，401 自动清除并跳转登录页', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 注入无效 token（模拟旧 bug 遗留）
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('neptune-auth', JSON.stringify({
        state: {
          user: { id: '1', name: 'Fake', email: 'fake@test.com', role: 'admin', tenantId: 't1' },
          token: 'invalid-token-123',
          isAuthenticated: true,
        },
        version: 0,
      }));
    });

    // 访问首页，应该触发 401，然后自动跳转登录页
    await page.goto('/');
    await page.waitForTimeout(3000);

    // 应该被重定向到登录页
    expect(page.url()).toContain('/login');

    // localStorage 应该被清除了
    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.state.isAuthenticated).toBe(false);
    }

    printReport(diag, page.url(), stored);
  });

  test('token=undefined 字符串时也能正确处理', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('neptune-auth', JSON.stringify({
        state: {
          user: { id: '1', name: 'Bug', email: 'bug@test.com', role: 'admin', tenantId: 't1' },
          token: undefined,
          isAuthenticated: true,
        },
        version: 0,
      }));
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // token 是 undefined，isAuthenticated 应该是 true 但 getStoredToken 返回 null
    // getAuthHeaders 会返回空对象，不发 Authorization header
    // 后端收到无 Authorization → 401 → 清除 auth → 跳转登录页
    expect(page.url()).toContain('/login');
  });
});
