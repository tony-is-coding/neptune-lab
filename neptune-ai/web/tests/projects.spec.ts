import { test, expect, type Page } from '@playwright/test';
import { API_URL, loginViaApi } from './helpers';

test.describe('客户项目交付台', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  async function gotoDelivery(page: Page) {
    await page.goto('/delivery', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '交付台' })).toBeVisible();
  }

  test('交付台展示客户项目列表并支持创建与归档', async ({ page }) => {
    const projectName = `华东月结项目 ${Date.now()}`;

    await gotoDelivery(page);
    await expect(page.getByRole('heading', { name: '客户项目' })).toBeVisible();

    await page.getByTestId('create-project-button').click();
    await page.getByLabel('客户项目名称').fill(projectName);
    await page.getByLabel('项目说明').fill('用于验证客户项目、受控运行和治理事实链。');
    await page.getByLabel('运行环境').selectOption('sandbox');

    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/projects') &&
      response.request().method() === 'POST' &&
      response.status() === 201
    );
    await page.getByRole('button', { name: '创建项目' }).click();
    await createResponse;

    const projectCard = page.getByTestId('project-card').filter({ hasText: projectName });
    await expect(projectCard).toBeVisible();
    await expect(projectCard).toContainText('交付中');

    await projectCard.getByRole('button', { name: '归档项目' }).click();
    await page.getByRole('button', { name: '确认归档' }).click();

    await expect(projectCard).toContainText('已归档');
    await expect(projectCard).toContainText('历史运行、成果文件和审计事件仍会保留');
  });

  test('项目 API 错误信封显示中文原因和请求编号', async ({ page }) => {
    await page.route('**/api/v1/projects**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'FORBIDDEN',
            message: '你没有权限访问客户项目。',
            requestId: 'req_project_forbidden',
            details: {},
          }),
        });
        return;
      }
      await route.fallback();
    });

    await gotoDelivery(page);
    await expect(page.getByText('你没有权限访问客户项目。')).toBeVisible();
    await expect(page.getByText('请求编号：req_project_forbidden')).toBeVisible();
  });

  test('交付台可以发起受控运行并跳转治理台运行详情', async ({ page }) => {
    const token = await page.evaluate(() => {
      const stored = localStorage.getItem('neptune-auth');
      return stored ? JSON.parse(stored).state.token as string : '';
    });
    const createAgentRes = await page.request.post(`${API_URL}/agents`, {
      headers: {authorization: `Bearer ${token}`},
      data: {
        name: `交付智能体 ${Date.now()}`,
        description: '用于交付台发起受控运行的测试智能体。',
        systemPrompt: '你是企业交付助手。',
        modelConfig: {
          provider: 'controlled',
          model: 'neptune-controlled-model',
          temperature: 0,
          maxTokens: 512,
        },
      },
    });
    expect(createAgentRes.ok()).toBeTruthy();
    const agent = await createAgentRes.json();

    await gotoDelivery(page);
    await page.getByRole('banner').getByRole('button', {name: '发起受控运行'}).click();
    await page.getByLabel('智能体').selectOption(agent.id);
    await page.getByLabel('运行标题').fill('交付台受控运行');
    await page.getByLabel('运行输入').fill('请生成一条交付验收摘要。');

    const createRunResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/runs') &&
      response.request().method() === 'POST' &&
      response.status() === 201
    );
    await page.getByRole('button', {name: '开始运行'}).click();
    const response = await createRunResponse;
    const createdRun = await response.json();

    await expect(page).toHaveURL(new RegExp(`/governance\\?tab=runs&runId=${createdRun.id}`));
    await expect(page.getByRole('heading', {name: '治理台'})).toBeVisible();
    // 治理台头部"运行 ID"短码可能与"请求 ID"短码碰巧前 8 字符相同，
    // 所以用 .first() 落到第一处即可（运行 ID 比请求 ID 更早渲染）。
    await expect(page.getByText(new RegExp(createdRun.id.slice(0, 8))).first()).toBeVisible();
  });

  test('受控运行表单用中文校验运行输入', async ({ page }) => {
    await page.route('**/api/v1/agents?active=true*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: '11111111-1111-4111-8111-111111111111',
          tenantId: 'tenant-test',
          name: '测试智能体',
          description: '测试用',
          icon: 'smart_toy',
          systemPrompt: '',
          modelConfig: {provider: 'controlled', model: 'neptune-controlled-model', temperature: 0, maxTokens: 512},
          tools: [],
          skills: [],
          mcpServers: [],
          constraints: {},
          version: 1,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
        meta: {count: 1, limit: 100, offset: 0},
      }),
    }));

    await gotoDelivery(page);
    await page.getByRole('banner').getByRole('button', {name: '发起受控运行'}).click();
    await page.getByRole('button', {name: '开始运行'}).click();

    await expect(page.getByText('运行输入不能为空')).toBeVisible();
  });

  test('配额不足时交付台禁止发起受控运行', async ({ page }) => {
    let createRunCalled = false;
    await page.route('**/api/v1/agents?active=true*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: '22222222-2222-4222-8222-222222222222',
          tenantId: 'tenant-test',
          name: '配额测试智能体',
          description: '测试用',
          icon: 'smart_toy',
          systemPrompt: '',
          modelConfig: {provider: 'controlled', model: 'neptune-controlled-model', temperature: 0, maxTokens: 512},
          tools: [],
          skills: [],
          mcpServers: [],
          constraints: {},
          version: 1,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
        meta: {count: 1, limit: 100, offset: 0},
      }),
    }));
    await page.route('**/api/v1/platform-facts/quota/status**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-test',
        allowed: false,
        reason: 'CONCURRENT_SESSION_LIMIT',
        quota: {maxTokensPerDay: 100, maxConcurrentSessions: 1},
        usage: {totalTokensToday: 4, runningSessions: 1},
        remaining: {tokensToday: 96, concurrentSessions: 0},
        message: '租户并发运行数已达到上限',
        updatedAt: new Date().toISOString(),
      }),
    }));
    await page.route('**/api/v1/runs', route => {
      createRunCalled = true;
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({error: 'SHOULD_NOT_CREATE_RUN', message: '不应提交运行'}),
      });
    });

    await gotoDelivery(page);
    await page.getByRole('banner').getByRole('button', {name: '发起受控运行'}).click();
    await page.getByLabel('运行输入').fill('这次运行应该被配额状态阻止。');

    await expect(page.getByText('本次受控运行暂不可发起：运行中并发已达到租户上限，等待现有运行结束后再发起。')).toBeVisible();
    await expect(page.getByRole('button', {name: '开始运行'})).toBeDisabled();
    expect(createRunCalled).toBe(false);
  });

  test('后端配额拒绝时显示治理化错误并保留运行弹窗', async ({ page }) => {
    let quotaRequestCount = 0;
    await page.route('**/api/v1/agents?active=true*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: '33333333-3333-4333-8333-333333333333',
          tenantId: 'tenant-test',
          name: '后端拒绝测试智能体',
          description: '测试用',
          icon: 'smart_toy',
          systemPrompt: '',
          modelConfig: {provider: 'controlled', model: 'neptune-controlled-model', temperature: 0, maxTokens: 512},
          tools: [],
          skills: [],
          mcpServers: [],
          constraints: {},
          version: 1,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
        meta: {count: 1, limit: 100, offset: 0},
      }),
    }));
    await page.route('**/api/v1/platform-facts/quota/status**', route => {
      quotaRequestCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenantId: 'tenant-test',
          allowed: quotaRequestCount === 1,
          reason: quotaRequestCount === 1 ? null : 'TOKEN_QUOTA_EXCEEDED',
          quota: {maxTokensPerDay: 10, maxConcurrentSessions: 1},
          usage: {totalTokensToday: quotaRequestCount === 1 ? 0 : 10, runningSessions: 0},
          remaining: {tokensToday: quotaRequestCount === 1 ? 10 : 0, concurrentSessions: 1},
          message: quotaRequestCount === 1 ? '当前租户配额允许发起新的运行' : '租户 token 配额不足',
          updatedAt: new Date().toISOString(),
        }),
      });
    });
    await page.route('**/api/v1/runs', route => route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'QUOTA_EXCEEDED',
        message: '租户配额不足',
        requestId: 'req_run_quota_denied',
        details: {
          reason: 'TOKEN_QUOTA_EXCEEDED',
          quota: {maxTokensPerDay: 10, maxConcurrentSessions: 1},
          usage: {totalTokensToday: 10, runningSessions: 0},
        },
      }),
    }));

    await gotoDelivery(page);
    await page.getByRole('banner').getByRole('button', {name: '发起受控运行'}).click();
    await expect(page.getByText('允许发起新运行')).toBeVisible();
    await page.getByLabel('运行输入').fill('预检通过后后端仍可能拒绝。');

    await page.getByRole('button', {name: '开始运行'}).click();

    await expect(page.getByRole('heading', {name: '发起受控运行'})).toBeVisible();
    await expect(page.getByText('本次受控运行被租户配额拒绝：今日 token 已达到租户配额上限，暂不能发起新运行。')).toBeVisible();
    await expect(page.getByText('请求编号：req_run_quota_denied')).toBeVisible();
    await expect(page.getByRole('link', {name: '查看治理台配额状态'})).toHaveAttribute('href', '/governance?tab=costs');
    await expect(page.getByText('本次受控运行暂不可发起：今日 token 已达到租户配额上限，暂不能发起新运行。')).toBeVisible();
    expect(quotaRequestCount).toBeGreaterThanOrEqual(2);
  });
});
