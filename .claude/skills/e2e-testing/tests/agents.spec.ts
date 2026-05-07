/**
 * Agent 管理测试 — 列表、创建、编辑
 */
import { test, expect } from '@playwright/test';
import { DEV_URL, loginViaApi, createAgentViaApi, attachDiagnostics, assertNoErrors } from './helpers';

test.describe('Agent 管理', () => {
  let token: string;

  test.beforeEach(async ({ page }) => {
    const result = await loginViaApi(page);
    token = result.token;
  });

  test('Agent 列表页正常渲染', async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto(`${DEV_URL}/agents`);
    await page.waitForLoadState('networkidle');

    // 页面不应在登录页
    await expect(page).not.toHaveURL(/\/login/);

    assertNoErrors(diag);
  });

  test('创建新 Agent', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 通过 API 创建（验证 API 可用）
    const agent = await createAgentViaApi(page, token, {
      name: `E2E Test Agent ${Date.now()}`,
      description: 'Created by E2E test',
    });

    expect(agent.id).toBeTruthy();
    expect(agent.name).toContain('E2E Test Agent');

    // 刷新列表页，新 agent 应出现
    await page.goto(`${DEV_URL}/agents`);
    await page.waitForLoadState('networkidle');

    assertNoErrors(diag);
  });

  test('Agent 列表加载 API 数据', async ({ page }) => {
    const diag = attachDiagnostics(page);

    // 创建一个 agent
    await createAgentViaApi(page, token, {
      name: `List Test ${Date.now()}`,
    });

    // 访问列表页，等待 API 响应
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/v1/agents') && resp.status() === 200);
    await page.goto(`${DEV_URL}/agents`);
    const response = await responsePromise;

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);

    assertNoErrors(diag);
  });
});
