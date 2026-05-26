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
  const thread = await threadRes.json();

  return {agent, thread};
}

test.describe('Advanced Agent workflow', () => {
  test.beforeEach(async ({page}) => {
    await loginViaApi(page);
  });

  test('renders ask_user, artifact detail, plan progress, and restores them after reload', async ({page}) => {
    const {agent, thread} = await prepareThread(page, `Advanced workflow ${Date.now()}`);

    await page.goto(`/collaborate/${agent.id}?threadId=${thread.id}`, {waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading', {name: agent.name})).toBeVisible({timeout: 15000});

    const prompt = `advanced workflow ${Date.now()}`;
    const textarea = page.locator('textarea').last();
    await textarea.fill(prompt);
    await textarea.press('Enter');

    await expect(page.getByText('请选择下一步执行策略')).toBeVisible({timeout: 30000});
    await page.getByRole('button', {name: /继续生成报告/}).click();
    await page.getByRole('button', {name: '提交回答'}).click();
    await expect(page.getByText('已回答')).toBeVisible({timeout: 15000});

    await expect(page.getByText('任务列表')).toBeVisible({timeout: 30000});
    await expect(page.getByText('梳理当前工作流状态')).toBeVisible({timeout: 30000});
    await expect(page.getByText('生成可审阅的交付物')).toBeVisible({timeout: 30000});
    await expect(page.getByText('2/2')).toBeVisible({timeout: 30000});

    await expect(page.getByText('成果')).toBeVisible({timeout: 30000});
    const artifactItem = page.getByText('workflow-summary.md').nth(1);
    await expect(artifactItem).toBeVisible({timeout: 30000});
    await artifactItem.click();
    await expect(page.getByText('Agent Workflow Acceptance')).toBeVisible({timeout: 15000});
    await expect(page.getByText('ask_user, artifact, and plan are visible')).toBeVisible({timeout: 15000});

    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.getByText(prompt, {exact: true})).toBeVisible({timeout: 15000});
    await expect(page.getByText('请选择下一步执行策略')).toBeVisible({timeout: 15000});
    await expect(page.getByText('workflow-summary.md').nth(1)).toBeVisible({timeout: 15000});
    await expect(page.getByText('梳理当前工作流状态')).toBeVisible({timeout: 15000});
  });
});
