/**
 * BUG #2 修复验证测试 - Agents 页面无限刷新问题
 *
 * 问题描述：AgentConfig 页面因 useEffect 依赖项中 navigate 函数引用不稳定导致无限循环
 * 修复方式：使用 useCallback 稳定 navigate 引用
 *
 * 验证场景：
 * 1. 访问 /agents 页面，检查是否不再无限刷新
 * 2. 点击 Agent 进入详情页，页面是否稳定
 * 3. 检查 console 是否有错误
 * 4. 验证页面不会持续触发网络请求
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, attachDiagnostics, printReport } from './helpers';

test.describe('BUG #2 修复验证 - Agents 页面无限刷新', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('TC1: 访问 /agents 页面，验证不再无限刷新', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 记录网络请求次数
    let agentApiCallCount = 0;
    page.on('request', req => {
      if (req.url().includes('/api/v1/agents')) {
        agentApiCallCount++;
      }
    });

    // 导航到 Agents 列表页
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // 等待 5 秒，观察是否有额外的请求
    await page.waitForTimeout(5000);

    // 验证 API 调用次数合理（初始加载应该只有 1-2 次）
    console.log(`Agent API 调用次数: ${agentApiCallCount}`);
    expect(agentApiCallCount).toBeLessThan(5);

    // 验证页面稳定
    const pageTitle = await page.locator('h2, h1').filter({ hasText: /agents/i }).first().isVisible();
    expect(pageTitle).toBeTruthy();

    console.log('✅ /agents 页面稳定，无无限刷新');

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('TC2: 点击 Agent 进入详情页，验证页面稳定', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 记录网络请求次数
    let agentDetailApiCallCount = 0;
    page.on('request', req => {
      if (req.url().includes('/api/v1/agents/') && !req.url().includes('/stats')) {
        agentDetailApiCallCount++;
      }
    });

    // 导航到 Agents 列表页
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // 等待 Agent 列表加载
    await page.waitForSelector('a[href*="/agents/"]', { timeout: 5000 });

    const agentLinks = page.locator('a[href*="/agents/"]');
    const count = await agentLinks.count();

    if (count > 0) {
      // 点击第一个 Agent
      await agentLinks.first().click();
      await page.waitForLoadState('networkidle');

      // 等待 5 秒，观察是否有额外的请求
      await page.waitForTimeout(5000);

      // 验证 API 调用次数合理（初始加载应该只有 1 次）
      console.log(`Agent Detail API 调用次数: ${agentDetailApiCallCount}`);
      expect(agentDetailApiCallCount).toBeLessThan(3);

      // 验证主要内容区域显示
      await expect(page.locator('text=Agent Profile')).toBeVisible();
      await expect(page.locator('text=Core Configuration')).toBeVisible();

      console.log('✅ Agent 详情页稳定，无无限刷新');
    } else {
      test.skip(true, 'No agents available for testing');
    }

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('TC3: 验证 useCallback 稳定 navigate 引用', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 导航到 Agents 列表页
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // 等待 Agent 列表加载
    await page.waitForSelector('a[href*="/agents/"]', { timeout: 5000 });

    const agentLinks = page.locator('a[href*="/agents/"]');
    const count = await agentLinks.count();

    if (count > 0) {
      // 点击第一个 Agent
      await agentLinks.first().click();
      await page.waitForLoadState('networkidle');

      // 验证 useEffect 不会因 navigate 变化而重新触发
      // 通过检查 console 日志确认没有重复的渲染警告
      const hasRenderWarnings = diag.logs.some(log =>
        log.includes('Warning') && log.includes('render')
      );

      expect(hasRenderWarnings).toBeFalsy();

      console.log('✅ useCallback 稳定 navigate 引用生效');
    } else {
      test.skip(true, 'No agents available for testing');
    }

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('TC4: 检查 console 是否有错误', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 导航到 Agents 列表页
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // 等待 Agent 列表加载
    await page.waitForSelector('a[href*="/agents/"]', { timeout: 5000 });

    const agentLinks = page.locator('a[href*="/agents/"]');
    const count = await agentLinks.count();

    if (count > 0) {
      // 点击第一个 Agent
      await agentLinks.first().click();
      await page.waitForLoadState('networkidle');

      // 等待 5 秒，收集所有错误
      await page.waitForTimeout(5000);

      // 验证没有严重错误
      const hasErrors = diag.errors.length > 0;
      if (hasErrors) {
        console.log('检测到的错误:', diag.errors);
      }

      // 允许一些非关键警告，但不应该有严重错误
      const hasCriticalErrors = diag.errors.some(err =>
        err.includes('Uncaught') || err.includes('TypeError')
      );

      expect(hasCriticalErrors).toBeFalsy();

      console.log('✅ 无严重 console 错误');
    } else {
      test.skip(true, 'No agents available for testing');
    }

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });
});
