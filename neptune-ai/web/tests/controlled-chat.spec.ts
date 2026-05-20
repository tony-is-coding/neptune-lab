import {test, expect} from '@playwright/test';
import {API_URL, attachDiagnostics, loginViaApi, printReport} from './helpers';

test.describe('Controlled model chat', () => {
  test.beforeEach(async ({page}) => {
    await loginViaApi(page);
  });

  test('streams model response, tool UI, completion state, and history through Collaborate', async ({page}) => {
    const diag = attachDiagnostics(page);

    const agentsRes = await page.request.get(`${API_URL}/agents`, {
      headers: await page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem('neptune-auth') || '{}');
        return {Authorization: `Bearer ${stored?.state?.token || ''}`};
      }),
    });
    expect(agentsRes.ok()).toBeTruthy();
    const agents = await agentsRes.json();
    const agent = agents.data.find((item: {name: string}) => item.name === 'E2E Assistant') || agents.data[0];
    expect(agent?.id).toBeTruthy();
    const authHeaders = await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('neptune-auth') || '{}');
      return {Authorization: `Bearer ${stored?.state?.token || ''}`};
    });

    const threadRes = await page.request.post(`${API_URL}/agents/${agent.id}/threads`, {
      headers: authHeaders,
      data: {title: `Controlled browser ${Date.now()}`},
    });
    expect(threadRes.ok()).toBeTruthy();
    const thread = await threadRes.json();

    await page.goto(`/collaborate/${agent.id}?threadId=${thread.id}`, {waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading', {name: agent.name})).toBeVisible({timeout: 15000});

    const textarea = page.locator('textarea').last();
    await expect(textarea).toBeVisible({timeout: 15000});

    const prompt = `controlled browser dispatch ${Date.now()}`;
    await textarea.fill(prompt);
    await textarea.press('Enter');

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
