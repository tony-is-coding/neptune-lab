/**
 * API 对齐诊断测试
 * 检查每个页面是否正确连接后端 API
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, attachDiagnostics, printReport } from './helpers';

test.describe('API 对齐诊断', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('/skills 页面 API 调用诊断', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/skills');
    await page.waitForLoadState('networkidle');

    // 收集所有 API 请求
    const apiRequests = diag.requests.filter(r => r.includes('/api/'));
    const getXhrRequests = apiRequests.filter(r => r.includes('>> GET') && r.includes('/api/'));

    console.log('\n=== /skills 页面 API 请求 ===');
    apiRequests.forEach(r => console.log(r));

    if (getXhrRequests.length === 0) {
      console.log('!! /skills 页面没有发起任何 API 请求 — 可能使用了 mock 数据');
    }

    // 检查是否有 mock 数据标记
    const mockWarnings = diag.logs.filter(l => l.includes('mock') || l.includes('Mock'));
    if (mockWarnings.length > 0) {
      console.log('\n=== Mock 警告 ===');
      mockWarnings.forEach(l => console.log(l));
    }

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('/ (首页) Agent 列表 API 调用诊断', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const apiRequests = diag.requests.filter(r => r.includes('/api/'));
    const agentRequests = apiRequests.filter(r => r.includes('/agents'));

    console.log('\n=== / 首页 API 请求 ===');
    apiRequests.forEach(r => console.log(r));

    if (agentRequests.length === 0) {
      console.log('!! 首页没有发起 /agents API 请求');
    }

    // 检查 agent 列表是否为空
    const agentCards = await page.locator('a[href*="/collaborate/"]').count();
    const noAgentText = await page.locator('text=No agents').isVisible();
    console.log(`\nAgent 卡片数量: ${agentCards}`);
    console.log(`"No agents" 提示可见: ${noAgentText}`);

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('/collaborate Agent + Thread API 调用诊断', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/collaborate');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const apiRequests = diag.requests.filter(r => r.includes('/api/'));
    const agentRequests = apiRequests.filter(r => r.includes('/agents'));
    const threadRequests = apiRequests.filter(r => r.includes('/threads'));

    console.log('\n=== /collaborate 页面 API 请求 ===');
    apiRequests.forEach(r => console.log(r));

    if (agentRequests.length === 0) {
      console.log('!! /collaborate 没有发起 /agents API 请求');
    }
    if (threadRequests.length === 0) {
      console.log('!! /collaborate 没有发起 /threads API 请求');
    }

    // 检查各 API 响应状态
    const statusCodes = apiRequests
      .filter(r => r.startsWith('<<'))
      .map(r => r.match(/<< (\d+)/)?.[1])
      .filter(Boolean);
    console.log('\nAPI 响应状态码:', [...new Set(statusCodes)]);

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('/agents 页面 API 调用诊断', async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const apiRequests = diag.requests.filter(r => r.includes('/api/'));

    console.log('\n=== /agents 页面 API 请求 ===');
    apiRequests.forEach(r => console.log(r));

    if (apiRequests.length === 0) {
      console.log('!! /agents 页面没有发起任何 API 请求');
    }

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });
});
