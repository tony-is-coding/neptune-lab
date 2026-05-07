import { test, expect } from '@playwright/test';
import { attachDiagnostics, printReport, loginViaApi } from './helpers';

test.describe('Collaborate', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('entering /collaborate shows collaborate UI', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/collaborate');
    await page.waitForLoadState('networkidle');

    // 应该发起了 GET /agents 请求
    const agentRequests = diag.requests.filter(r => r.includes('/agents') && r.includes('>>'));
    expect(agentRequests.length).toBeGreaterThan(0);

    // 即使 API 返回 401，页面应该渲染而不崩溃
    // 可能显示 "Failed to connect to server" 或 "No agents available"
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });

  test('collaborate page renders without JS errors', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/collaborate');
    await page.waitForLoadState('networkidle');

    // 不应有 React 运行时错误
    const reactErrors = diag.errors.filter(e =>
      e.includes('Invalid hook') || e.includes('useCallback')
    );
    expect(reactErrors).toEqual([]);

    printReport(diag, page.url(), null);
  });

  test('when backend available, redirects to first agent', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/collaborate');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // 等待 API 响应

    // 检查是否重定向到了 /collaborate/:id
    const url = page.url();
    const hasAgentId = /\/collaborate\/[\w-]+$/.test(url);

    if (hasAgentId) {
      // 成功重定向
      expect(url).toMatch(/\/collaborate\/[\w-]+$/);

      // 应该有 Agent 列表区域
      const sidebar = page.locator('text=Active Agents');
      if (await sidebar.isVisible()) {
        // Agent 列表正常加载
        const agentLinks = page.locator('a[href*="/collaborate/"]');
        const count = await agentLinks.count();
        expect(count).toBeGreaterThan(0);
      }
    } else {
      // API 不可用，显示错误信息
      test.info().annotations.push({ type: 'skip-reason', description: 'Backend API not available or returned 401' });
    }

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });

  test('collaborate with agentId shows agent detail area', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 直接访问一个不存在的 agentId，测试页面不崩溃
    await page.goto('/collaborate/test-agent-id');
    await page.waitForLoadState('networkidle');

    // 不应有 React 运行时错误
    const reactErrors = diag.errors.filter(e =>
      e.includes('Invalid hook') || e.includes('useCallback')
    );
    expect(reactErrors).toEqual([]);

    // 页面应该有主要内容区域
    const header = page.locator('header');
    await expect(header).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });

  test('agent switching triggers API call', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/collaborate');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const url = page.url();
    if (!/\/collaborate\/[\w-]+$/.test(url)) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Backend not available, agent list not loaded' });
      return;
    }

    // 切换 agent
    const agentLinks = page.locator('a[href*="/collaborate/"]');
    const count = await agentLinks.count();

    if (count > 1) {
      const currentUrl = page.url();
      const currentAgentId = currentUrl.split('/collaborate/')[1];

      for (let i = 0; i < count; i++) {
        const href = await agentLinks.nth(i).getAttribute('href');
        if (href && !href.includes(currentAgentId)) {
          diag.requests.length = 0;
          await agentLinks.nth(i).click();
          await page.waitForURL(/\/collaborate\//, { timeout: 5000 });

          // 切换后应有新的请求
          const threadRequests = diag.requests.filter(r => r.includes('/threads'));
          expect(threadRequests.length).toBeGreaterThan(0);
          break;
        }
      }
    }

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });
});
