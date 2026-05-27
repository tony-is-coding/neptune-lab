import {test, expect} from '@playwright/test';
import {API_URL, authHeaders, ensureE2EAgent, loginViaApi} from './helpers';

async function prepareThread(page: import('@playwright/test').Page, title: string) {
  const headers = await authHeaders(page);
  const agent = await ensureE2EAgent(page);
  const threadRes = await page.request.post(`${API_URL}/agents/${agent.id}/threads`, {
    headers,
    data: {title},
  });
  expect(threadRes.ok()).toBeTruthy();
  return {agent, thread: await threadRes.json(), headers};
}

test.describe('SSE recovery', () => {
  test.beforeEach(async ({page}) => {
    await loginViaApi(page);
  });

  test('lets the user stop a slow stream and continue using the input', async ({page}) => {
    const {agent, thread} = await prepareThread(page, `Abort recovery ${Date.now()}`);
    await page.route(`**/api/v1/agents/${agent.id}/threads/${thread.id}/chat`, async route => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: '',
      }).catch(() => {});
    });

    await page.goto(`/collaborate/${agent.id}?threadId=${thread.id}`, {waitUntil: 'domcontentloaded'});

    const textarea = page.locator('textarea').last();
    await textarea.fill(`slow stream ${Date.now()}`);
    await textarea.press('Enter');

    const stopButton = page.getByRole('button', {name: '停止生成'});
    await expect(stopButton).toBeVisible({timeout: 15000});
    await expect(stopButton).toBeEnabled({timeout: 15000});
    await stopButton.click();
    await expect(textarea).toBeEnabled({timeout: 15000});
  });

  test('shows recovery messages for 401, 409 running, and 404 missing thread', async ({page}) => {
    const {agent, thread, headers} = await prepareThread(page, `SSE errors ${Date.now()}`);
    await page.goto(`/collaborate/${agent.id}?threadId=${thread.id}`, {waitUntil: 'domcontentloaded'});

    await page.route(`**/api/v1/agents/${agent.id}/threads/${thread.id}/chat`, async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({error: 'UNAUTHORIZED', message: '登录已过期，请重新登录'}),
      });
    });

    const textarea = page.locator('textarea').last();
    await textarea.fill(`trigger 401 ${Date.now()}`);
    await textarea.press('Enter');
    await expect(page.getByText('登录已过期，请重新登录')).toBeVisible({timeout: 15000});
    await page.unroute(`**/api/v1/agents/${agent.id}/threads/${thread.id}/chat`);

    await page.request.patch(`${API_URL}/agents/${agent.id}/threads/${thread.id}`, {
      headers,
      data: {status: 'running'},
    });
    await page.locator('textarea').last().fill(`trigger 409 ${Date.now()}`);
    await page.locator('textarea').last().press('Enter');
    await expect(page.getByText('Thread 正在执行中')).toBeVisible({timeout: 15000});

    await page.request.patch(`${API_URL}/agents/${agent.id}/threads/${thread.id}`, {
      headers,
      data: {status: 'idle'},
    });
    await page.goto(`/collaborate/${agent.id}?threadId=00000000-0000-0000-0000-000000000000`, {waitUntil: 'domcontentloaded'});
    await expect(page.getByText('Failed to load conversation')).toBeVisible({timeout: 15000});
    await expect(page.getByText('getThreadHistory failed: 404')).toBeVisible({timeout: 15000});
  });

  test('配额不足时显示治理反馈并恢复输入', async ({page}) => {
    const {agent, thread} = await prepareThread(page, `配额测试 ${Date.now().toString().slice(-6)}`);
    const hitChatRequests: string[] = [];
    await page.route('**/api/v1/agents/*/threads/*/chat', async route => {
      hitChatRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'event: connected',
          `data: ${JSON.stringify({type: 'connected', requestId: 'req-quota-e2e', threadId: thread.id, timestamp: Date.now()})}`,
          '',
          'event: error',
          `data: ${JSON.stringify({
            type: 'error',
            error: 'QUOTA_EXCEEDED',
            message: '租户配额不足',
            requestId: 'req-quota-e2e',
            details: {
              reason: 'TOKEN_QUOTA_EXCEEDED',
              quota: {maxTokensPerDay: 1, maxConcurrentSessions: 10},
              usage: {totalTokensToday: 1, runningSessions: 0},
            },
          })}`,
          '',
          '',
        ].join('\n'),
      });
    });

    await page.goto(`/collaborate/${agent.id}?threadId=${thread.id}`, {waitUntil: 'domcontentloaded'});
    await expect(page.locator('textarea').last()).toBeVisible({timeout: 15000});

    const textarea = page.locator('textarea').last();
    await textarea.fill(`trigger quota ${Date.now()}`);
    await textarea.press('Enter');

    await expect.poll(() => hitChatRequests.length, {timeout: 15000}).toBe(1);
    await expect(page.getByText('租户配额不足')).toBeVisible({timeout: 15000});
    await expect(page.getByText('本次运行未启动，系统已写入配额策略拒绝和审计事件。')).toBeVisible();
    await expect(page.getByText('查看成本概览：/governance?tab=costs')).toBeVisible();
    await expect(page.getByText('查看策略决策：/governance?tab=policy')).toBeVisible();
    await expect(page.getByText('请求编号：req-quota-e2e')).toBeVisible();
    await expect(page.getByText(/E2E OK|执行 E2EControlledTool/)).toHaveCount(0);
    await expect(textarea).toBeEnabled({timeout: 15000});
  });

  test('HTTP 配额拒绝时保留错误信封并显示治理反馈', async ({page}) => {
    const {agent, thread} = await prepareThread(page, `HTTP 配额 ${Date.now().toString().slice(-6)}`);
    const hitChatRequests: string[] = [];
    await page.route('**/api/v1/agents/*/threads/*/chat', async route => {
      hitChatRequests.push(route.request().url());
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'QUOTA_EXCEEDED',
          message: '租户配额不足',
          requestId: 'req-http-quota-e2e',
          details: {
            reason: 'TOKEN_QUOTA_EXCEEDED',
            quota: {maxTokensPerDay: 1, maxConcurrentSessions: 10},
            usage: {totalTokensToday: 1, runningSessions: 0},
          },
        }),
      });
    });

    await page.goto(`/collaborate/${agent.id}?threadId=${thread.id}`, {waitUntil: 'domcontentloaded'});
    await expect(page.locator('textarea').last()).toBeVisible({timeout: 15000});

    const textarea = page.locator('textarea').last();
    await textarea.fill(`trigger http quota ${Date.now()}`);
    await textarea.press('Enter');

    await expect.poll(() => hitChatRequests.length, {timeout: 15000}).toBe(1);
    await expect(page.getByText('租户配额不足')).toBeVisible({timeout: 15000});
    await expect(page.getByText('本次运行未启动，系统已写入配额策略拒绝和审计事件。')).toBeVisible();
    await expect(page.getByText('查看成本概览：/governance?tab=costs')).toBeVisible();
    await expect(page.getByText('查看策略决策：/governance?tab=policy')).toBeVisible();
    await expect(page.getByText('请求编号：req-http-quota-e2e')).toBeVisible();
    await expect(textarea).toBeEnabled({timeout: 15000});
  });
});
