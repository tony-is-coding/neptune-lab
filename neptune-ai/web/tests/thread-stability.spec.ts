import {test, expect} from '@playwright/test';
import {API_URL, authHeaders, ensureE2EAgent, loginViaApi} from './helpers';

async function setupAgentAndThread(page: import('@playwright/test').Page, title: string) {
  const headers = await authHeaders(page);
  const agent = await ensureE2EAgent(page);
  const threadRes = await page.request.post(`${API_URL}/agents/${agent.id}/threads`, {
    headers,
    data: {title},
  });
  expect(threadRes.ok()).toBeTruthy();
  return {agent, thread: await threadRes.json(), headers};
}

test.describe('Thread stability', () => {
  test.beforeEach(async ({page}) => {
    await loginViaApi(page);
  });

  test('preserves separate thread histories across refresh and thread switching', async ({page}) => {
    const first = await setupAgentAndThread(page, `Stable first ${Date.now()}`);
    const secondRes = await page.request.post(`${API_URL}/agents/${first.agent.id}/threads`, {
      headers: first.headers,
      data: {title: `Stable second ${Date.now()}`},
    });
    expect(secondRes.ok()).toBeTruthy();
    const secondThread = await secondRes.json();

    const firstPrompt = `first stable message ${Date.now()}`;
    const secondPrompt = `second stable message ${Date.now()}`;

    await page.goto(`/collaborate/${first.agent.id}?threadId=${first.thread.id}`, {waitUntil: 'domcontentloaded'});
    await page.locator('textarea').last().fill(firstPrompt);
    await page.locator('textarea').last().press('Enter');
    await expect(page.getByText(/E2E OK: controlled model dispatch is healthy/).first()).toBeVisible({timeout: 30000});

    await page.goto(`/collaborate/${first.agent.id}?threadId=${secondThread.id}`, {waitUntil: 'domcontentloaded'});
    await page.locator('textarea').last().fill(secondPrompt);
    await page.locator('textarea').last().press('Enter');
    await expect(page.getByText(secondPrompt, {exact: true})).toBeVisible({timeout: 15000});
    await expect(page.getByText(firstPrompt, {exact: true})).not.toBeVisible();

    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.getByText(secondPrompt, {exact: true})).toBeVisible({timeout: 15000});
    await expect(page.getByText(firstPrompt, {exact: true})).not.toBeVisible();

    await page.goto(`/collaborate/${first.agent.id}?threadId=${first.thread.id}`, {waitUntil: 'domcontentloaded'});
    await expect(page.getByText(firstPrompt, {exact: true})).toBeVisible({timeout: 15000});
    await expect(page.getByText(secondPrompt, {exact: true})).not.toBeVisible();
  });
});
