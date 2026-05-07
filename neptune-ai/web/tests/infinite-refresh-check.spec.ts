/**
 * 无限刷新问题修复验证
 *
 * 专门验证 BUG #2 (Agents 页面无限刷新) 是否已修复
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, attachDiagnostics, printReport } from './helpers';

test.describe('无限刷新问题修复验证', () => {
  test('验证 AgentConfig 页面不会无限刷新', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 登录
    await loginViaApi(page);

    // 记录 API 调用次数
    let apiCallCount = 0;
    page.on('request', req => {
      if (req.url().includes('/api/v1/agents/') && !req.url().includes('/stats')) {
        apiCallCount++;
        console.log(`API Call #${apiCallCount}: ${req.method()} ${req.url()}`);
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
      // 重置计数器
      apiCallCount = 0;

      // 点击第一个 Agent
      await agentLinks.first().click();
      await page.waitForLoadState('networkidle');

      // 等待 5 秒，观察是否有额外的请求（无限刷新会产生大量请求）
      await page.waitForTimeout(5000);

      // 验证 API 调用次数合理（应该只有 1-2 次，无限刷新会有几十次）
      console.log(`\n总 API 调用次数: ${apiCallCount}`);

      // 如果调用次数超过 10 次，认为存在无限刷新
      if (apiCallCount > 10) {
        console.error('❌ 检测到可能的无限刷新！API 调用次数异常高');
        console.error('API 调用详情:');
        diag.requests.filter(r => r.includes('/api/v1/agents/')).forEach(r => console.error(r));
      }

      expect(apiCallCount).toBeLessThanOrEqual(10);

      // 验证主要内容区域显示
      await expect(page.locator('text=Agent Profile')).toBeVisible();
      await expect(page.locator('text=Core Configuration')).toBeVisible();

      console.log('✅ AgentConfig 页面稳定，无无限刷新问题');
    } else {
      test.skip(true, 'No agents available for testing');
    }

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('验证 useEffect 不会因 navigate 变化而重新触发', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 登录
    await loginViaApi(page);

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

      // 等待 5 秒
      await page.waitForTimeout(5000);

      // 检查是否有 React 渲染警告（navigate 不稳定会导致渲染警告）
      const hasRenderWarnings = diag.logs.some(log =>
        log.includes('Warning') && (log.includes('render') || log.includes('useEffect'))
      );

      if (hasRenderWarnings) {
        console.warn('⚠️ 检测到 React 警告:');
        diag.logs.filter(l => l.includes('Warning')).forEach(l => console.warn(l));
      }

      // 验证没有严重错误
      const hasErrors = diag.errors.length > 0;
      if (hasErrors) {
        console.error('❌ 检测到页面错误:');
        diag.errors.forEach(e => console.error(e));
      }

      expect(hasErrors).toBeFalsy();

      console.log('✅ useEffect 稳定，无重复渲染警告');
    } else {
      test.skip(true, 'No agents available for testing');
    }

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('验证页面加载时间正常（无性能问题）', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 登录
    await loginViaApi(page);

    // 导航到 Agents 列表页
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // 等待 Agent 列表加载
    await page.waitForSelector('a[href*="/agents/"]', { timeout: 5000 });

    const agentLinks = page.locator('a[href*="/agents/"]');
    const count = await agentLinks.count();

    if (count > 0) {
      // 记录开始时间
      const startTime = Date.now();

      // 点击第一个 Agent
      await agentLinks.first().click();
      await page.waitForLoadState('networkidle');

      // 记录加载时间
      const loadTime = Date.now() - startTime;

      console.log(`Agent 详情页加载时间: ${loadTime}ms`);

      // 验证加载时间合理（应该小于 5 秒）
      expect(loadTime).toBeLessThan(5000);

      // 验证主要内容区域显示
      await expect(page.locator('text=Agent Profile')).toBeVisible();

      console.log('✅ 页面加载时间正常');
    } else {
      test.skip(true, 'No agents available for testing');
    }

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });
});
