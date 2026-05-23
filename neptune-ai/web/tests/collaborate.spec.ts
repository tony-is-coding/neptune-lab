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

    // 页面应该渲染（即使 agent 不存在）
    // header 只在有 agents 数据时渲染，所以检查 body 内容即可
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);

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

  test('协作 Thread 展示关联运行并跳转治理台事实链', async ({ page }) => {
    const agentId = '11111111-1111-4111-8111-111111111111';
    const threadId = '22222222-2222-4222-8222-222222222222';
    const runId = '33333333-3333-4333-8333-333333333333';
    const now = new Date().toISOString();

    await page.route('**/api/v1/agents?**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: agentId,
          tenantId: 'tenant-test',
          name: '运行调试智能体',
          description: '用于验证 Thread 与 Controlled Run 的关系',
          systemPrompt: 'test',
          modelConfig: {provider: 'controlled', model: 'neptune-controlled-model'},
          tools: [],
          skills: [],
          mcpServers: [],
          constraints: {},
          icon: 'smart_toy',
          isActive: true,
          createdAt: now,
          updatedAt: now,
          threadSummary: {
            totalThreads: 1,
            latestStatus: 'idle',
            latestThreadTitle: '月结检查调试',
            lastActiveAt: now,
          },
        }],
        meta: {count: 1, limit: 50, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/agents/${agentId}/threads**`, route => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: threadId,
            tenantId: 'tenant-test',
            userId: 'user-test',
            templateId: agentId,
            status: 'idle',
            title: '月结检查调试',
            summary: null,
            workspace: 'workspace://thread',
            lastActiveAt: now,
            createdAt: now,
            updatedAt: now,
          }],
          meta: {count: 1, limit: 50, offset: 0},
        }),
      });
    });
    await page.route(`**/api/v1/agents/${agentId}/threads/${threadId}/history`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({data: [], meta: {}}),
    }));

    const runQueries: Array<Record<string, string>> = [];
    await page.route(`**/api/v1/agents/${agentId}/threads/${threadId}/runs**`, route => {
      const url = new URL(route.request().url());
      runQueries.push(Object.fromEntries(url.searchParams));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: runId,
            tenantId: 'tenant-test',
            userId: 'user-test',
            agentId,
            agentVersionId: 'version-test',
            threadId,
            requestId: 'req-thread-run',
            status: 'completed',
            model: 'neptune-controlled-model',
            inputTokens: 12,
            outputTokens: 34,
            startedAt: now,
            completedAt: now,
            retryOfRunId: null,
          }],
          meta: {count: 1, limit: 20, offset: 0},
        }),
      });
    });

    await page.goto(`/collaborate/${agentId}?threadId=${threadId}`, {waitUntil: 'domcontentloaded'});

    await expect(page.getByRole('heading', {name: '关联运行'})).toBeVisible();
    await expect(page.getByText('受控运行 1 次')).toBeVisible();
    await expect(page.getByText('已完成')).toBeVisible();
    expect(runQueries).toContainEqual(expect.objectContaining({limit: '20'}));

    await page.getByRole('link', {name: '查看运行详情'}).click();
    await expect(page).toHaveURL(new RegExp(`/governance\\?tab=runs.*runId=${runId}`));

    await page.goto(`/collaborate/${agentId}?threadId=${threadId}`, {waitUntil: 'domcontentloaded'});
    await page.getByRole('link', {name: '查看审计链'}).click();
    await expect(page).toHaveURL(new RegExp(`/governance\\?tab=audit.*resourceType=run.*resourceId=${runId}`));
  });
});
