import {expect, test} from '@playwright/test';
import {API_URL, attachDiagnostics, loginViaApi, printReport} from './helpers';

test.describe('技能与记忆治理', () => {
  test.beforeEach(async ({page}) => {
    await loginViaApi(page);
  });

  test('技能目录使用中文治理文案', async ({page}) => {
    const diag = attachDiagnostics(page);
    const skillsResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/skills') && response.status() === 200,
    );

    await page.goto('/skills', {waitUntil: 'domcontentloaded'});
    await skillsResponse;

    await expect(page.getByText('技能目录').first()).toBeVisible();
    await expect(page.getByPlaceholder('搜索技能...')).toBeVisible();
    await expect(page.getByText('我的技能')).toBeVisible();
    await expect(page.getByText(/上传技能|正在上传/)).toBeVisible();
    await expect(page.getByText('Skills').first()).not.toBeVisible();
    await expect(page.getByPlaceholder('Search skills...')).toHaveCount(0);

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('技能详情支持显式上架和下架动作', async ({page}) => {
    const now = new Date().toISOString();
    const skillId = '11111111-1111-4111-8111-111111111111';
    let skillStatus: 'active' | 'draft' = 'draft';
    const skillRequests: Array<{method: string; url: string}> = [];

    await page.route('**/api/v1/skills', route => {
      if (route.request().method() !== 'GET') return route.fallback();
      skillRequests.push({method: route.request().method(), url: route.request().url()});
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: skillId,
            tenantId: 'tenant-test',
            name: '月结检查技能',
            description: '验证技能上架治理动作',
            content: '# 月结检查技能',
            status: skillStatus,
            createdAt: now,
            updatedAt: now,
          }],
          meta: {count: 1, limit: 50, offset: 0},
        }),
      });
    });

    await page.route(`**/api/v1/skills/${skillId}`, route => {
      if (route.request().method() !== 'GET') return route.fallback();
      skillRequests.push({method: route.request().method(), url: route.request().url()});
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: skillId,
          tenantId: 'tenant-test',
          name: '月结检查技能',
          description: '验证技能上架治理动作',
          content: '# 月结检查技能',
          status: skillStatus,
          createdAt: now,
          updatedAt: now,
        }),
      });
    });

    await page.route(`**/api/v1/skills/${skillId}/publish`, route => {
      skillRequests.push({method: route.request().method(), url: route.request().url()});
      skillStatus = 'active';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: skillId,
          tenantId: 'tenant-test',
          name: '月结检查技能',
          description: '验证技能上架治理动作',
          content: '# 月结检查技能',
          status: skillStatus,
          createdAt: now,
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route(`**/api/v1/skills/${skillId}/unpublish`, route => {
      skillRequests.push({method: route.request().method(), url: route.request().url()});
      skillStatus = 'draft';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: skillId,
          tenantId: 'tenant-test',
          name: '月结检查技能',
          description: '验证技能上架治理动作',
          content: '# 月结检查技能',
          status: skillStatus,
          createdAt: now,
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto(`/skills/${skillId}`, {waitUntil: 'domcontentloaded'});

    await expect(page.getByText('草稿').first()).toBeVisible();
    await page.getByRole('button', {name: '上架技能'}).click();
    await expect(page.getByText('已上架').first()).toBeVisible();
    await expect(page.getByRole('button', {name: '下架为草稿'})).toBeVisible();

    await page.getByRole('button', {name: '下架为草稿'}).click();
    await expect(page.getByText('草稿').first()).toBeVisible();

    expect(skillRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({method: 'POST', url: expect.stringContaining(`/api/v1/skills/${skillId}/publish`)}),
      expect.objectContaining({method: 'POST', url: expect.stringContaining(`/api/v1/skills/${skillId}/unpublish`)}),
    ]));
  });

  test('智能体配置页展示中文记忆、知识和技能治理入口，并按分类上传', async ({page}) => {
    const diag = attachDiagnostics(page);
    const authState = await page.evaluate(() => localStorage.getItem('neptune-auth'));
    const token = authState ? JSON.parse(authState).state?.token : null;
    expect(token).toBeTruthy();

    const createAgent = await page.request.post(`${API_URL}/agents`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        name: `治理测试智能体 ${Date.now()}`,
        description: '用于验证记忆和技能治理面',
        systemPrompt: '你是治理测试智能体。',
        modelConfig: {provider: 'anthropic', model: 'test-model', temperature: 0.1, maxTokens: 256},
        tools: [],
        skills: [],
        mcpServers: [],
      },
    });
    expect(createAgent.ok()).toBeTruthy();
    const agent = await createAgent.json();

    const documentRequests: Array<{category?: string; name?: string}> = [];
    await page.route('**/api/v1/agents/*/documents', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as {category?: string; name?: string};
        documentRequests.push({category: body.category, name: body.name});
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: `doc-${documentRequests.length}`,
            name: body.name,
            type: 'text/markdown',
            category: body.category,
            size: 12,
            uploadedAt: new Date().toISOString(),
          }),
        });
        return;
      }

      const url = new URL(route.request().url());
      const category = url.searchParams.get('category');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({data: category ? [] : []}),
      });
    });

    await page.goto(`/agents/${agent.id}`, {waitUntil: 'domcontentloaded'});

    await expect(page.getByRole('heading', {name: '智能体档案'})).toBeVisible();
    await expect(page.getByRole('heading', {name: '记忆管理'})).toBeVisible();
    await expect(page.getByRole('heading', {name: '知识库'})).toBeVisible();
    await expect(page.getByRole('heading', {name: '已绑定技能'})).toBeVisible();
    await expect(page.getByRole('button', {name: '浏览技能目录'})).toBeVisible();

    const memoryUpload = page.waitForResponse(response =>
      response.url().includes(`/api/v1/agents/${agent.id}/documents`) && response.request().method() === 'POST',
    );
    await page.getByLabel('上传记忆材料').setInputFiles({
      name: '偏好记忆.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('偏好记忆'),
    });
    await memoryUpload;

    const knowledgeUpload = page.waitForResponse(response =>
      response.url().includes(`/api/v1/agents/${agent.id}/documents`) && response.request().method() === 'POST',
    );
    await page.getByLabel('上传知识材料').setInputFiles({
      name: '制度知识.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('制度知识'),
    });
    await knowledgeUpload;

    expect(documentRequests.map(request => request.category)).toEqual(['memory', 'knowledge']);
    await expect(page.getByText('偏好记忆.md')).toBeVisible();
    await expect(page.getByText('制度知识.md')).toBeVisible();

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });
});
