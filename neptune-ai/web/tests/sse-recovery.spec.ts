import {test, expect} from '@playwright/test';
import {API_URL, loginViaApi} from './helpers';

async function getAuthHeaders(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('neptune-auth') || '{}');
    return {Authorization: `Bearer ${stored?.state?.token || ''}`};
  });
}

async function prepareThread(page: import('@playwright/test').Page, title: string) {
  const headers = await getAuthHeaders(page);
  const agentsRes = await page.request.get(`${API_URL}/agents`, {headers});
  expect(agentsRes.ok()).toBeTruthy();
  const agents = await agentsRes.json();
  const agent = agents.data.find((item: {name: string}) => item.name === 'E2E Assistant') || agents.data[0];
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
    await page.goto(`/collaborate/${agent.id}?threadId=${thread.id}`, {waitUntil: 'domcontentloaded'});

    const textarea = page.locator('textarea').last();
    await textarea.fill(`slow stream ${Date.now()}`);
    await textarea.press('Enter');

    const stopButton = page.getByRole('button', {name: '停止生成'});
    await expect(stopButton).toBeVisible({timeout: 15000});
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
});
