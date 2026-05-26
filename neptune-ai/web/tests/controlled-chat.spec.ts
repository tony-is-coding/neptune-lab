import {test, expect} from '@playwright/test';
import {API_URL, attachDiagnostics, authHeaders, ensureE2EAgent, loginViaApi, printReport} from './helpers';

test.describe('Controlled model chat', () => {
  test.beforeEach(async ({page}) => {
    await loginViaApi(page);
  });

  test('streams model response, tool UI, completion state, and history through Collaborate', async ({page}) => {
    const diag = attachDiagnostics(page);

    const agent = await ensureE2EAgent(page);
    const headers = await authHeaders(page);

    const threadRes = await page.request.post(`${API_URL}/agents/${agent.id}/threads`, {
      headers,
      data: {title: `Controlled browser ${Date.now()}`},
    });
    expect(threadRes.ok()).toBeTruthy();
    const thread = await threadRes.json();

    await page.goto(`/collaborate/${agent.id}?threadId=${thread.id}`, {waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading', {name: agent.name})).toBeVisible({timeout: 15000});

    const textarea = page.locator('textarea').last();
    await expect(textarea).toBeVisible({timeout: 15000});

    const prompt = `controlled browser dispatch ${Date.now()}`;
    const chatResponsePromise = page.waitForResponse(response =>
      response.url().includes(`/api/v1/agents/${agent.id}/threads/${thread.id}/chat`) &&
      response.request().method() === 'POST',
    );
    await textarea.fill(prompt);
    await textarea.press('Enter');
    const chatResponse = await chatResponsePromise;
    expect(chatResponse.status()).toBe(200);
    expect(chatResponse.headers()['x-request-id']).toBeTruthy();

    await expect(page.getByText(prompt, {exact: true})).toBeVisible({timeout: 15000});
    await expect(page.getByText(/E2E OK: controlled model dispatch is healthy/).first()).toBeVisible({timeout: 30000});
    await expect(page.getByText(/执行 E2EControlledTool/)).toBeVisible({timeout: 30000});
    await expect(textarea).toBeEnabled({timeout: 15000});

    const currentUrl = page.url();
    const threadId = new URL(currentUrl).searchParams.get('threadId');
    expect(threadId).toBeTruthy();

    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.getByText(prompt, {exact: true})).toBeVisible({timeout: 15000});
    await expect(page.getByText(/E2E OK: controlled model dispatch is healthy/).first()).toBeVisible({timeout: 15000});

    const stored = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    printReport(diag, page.url(), stored);
  });
});
