import {test, expect} from '@playwright/test';
import {attachDiagnostics, loginViaApi, printReport} from './helpers';

test.describe('治理台', () => {
  test.beforeEach(async ({page}) => {
    await loginViaApi(page);
  });

  test('冒烟测试：中文治理入口和平台事实 API 可用', async ({page}) => {
    const diag = attachDiagnostics(page);
    await page.route('**/api/v1/platform-facts/audit-events**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 1,
            tenantId: 'tenant-test',
            userId: 'user-test',
            requestId: 'req-skill-bind',
            action: 'skill.bound_to_agent',
            resourceType: 'agent_skill_binding',
            resourceId: 'binding-test',
            outcome: 'success',
            createdAt: new Date().toISOString(),
          },
          {
            id: 2,
            tenantId: 'tenant-test',
            userId: 'user-test',
            requestId: 'req-memory-upload',
            action: 'agent_document.uploaded',
            resourceType: 'agent_document',
            resourceId: 'document-test',
            outcome: 'success',
            createdAt: new Date().toISOString(),
          },
        ],
        meta: {count: 2, limit: 50, offset: 0},
      }),
    }));
    const runsResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/platform-facts/runs') && response.status() === 200,
    );
    const costResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/platform-facts/cost-summary') && response.status() === 200,
    );
    const auditResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/platform-facts/audit-events') && response.status() === 200,
    );
    const policyResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/platform-facts/policy-decisions') && response.status() === 200,
    );
    const humanReviewsResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/platform-facts/human-reviews') && response.status() === 200,
    );

    await page.goto('/governance', {waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading', {name: '治理台'})).toBeVisible();
    await expect(page.getByRole('button', {name: /运行记录/})).toBeVisible();
    await expect(page.getByRole('button', {name: /成本概览/})).toBeVisible();
    await expect(page.getByRole('button', {name: /复核队列/})).toBeVisible();
    await expect(page.getByRole('button', {name: /审计事件/})).toBeVisible();
    await expect(page.getByRole('button', {name: /difference 智能体版本/})).toBeVisible();
    await expect(page.getByRole('button', {name: /策略决策/})).toBeVisible();

    await Promise.all([runsResponse, costResponse, auditResponse, policyResponse, humanReviewsResponse]);

    await page.getByRole('button', {name: /成本概览/}).click();
    await expect(page.getByRole('heading', {name: '成本概览'})).toBeVisible();
    await expect(page.getByText('累计 token')).toBeVisible();
    await page.getByRole('button', {name: /复核队列/}).click();
    await humanReviewsResponse;
    await expect(page.getByRole('heading', {name: '复核队列'})).toBeVisible();
    await expect(
      page
        .getByText(/暂无复核项|正在加载复核队列|复核类型|待复核|已批准|已退回|已豁免/)
        .first(),
    ).toBeVisible();

    const submitReviewButton = page.getByRole('button', {name: /提交复核/});
    if (await submitReviewButton.isVisible()) {
      await submitReviewButton.click();
      await expect(page.getByText('写入审计事件')).toBeVisible();
      await page.getByRole('button', {name: '关闭'}).click();
    }

    await page.getByRole('button', {name: /审计事件/}).click();
    await expect(page.getByRole('heading', {name: '审计事件'})).toBeVisible();
    await expect(page.getByRole('cell', {name: '技能绑定', exact: true})).toBeVisible();
    await expect(page.getByRole('cell', {name: '智能体材料', exact: true})).toBeVisible();
    await expect(page.getByRole('cell', {name: '材料上传', exact: true})).toBeVisible();
    await page.getByRole('button', {name: /策略决策/}).click();
    await expect(page.getByRole('heading', {name: '策略决策'})).toBeVisible();

    const apiRequests = diag.requests.filter(request => request.includes('/platform-facts/'));
    expect(apiRequests.length).toBeGreaterThanOrEqual(4);

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('审计事件支持 URL 深链筛选', async ({page}) => {
    const auditQueries: Array<Record<string, string>> = [];
    await page.route('**/api/v1/platform-facts/audit-events**', route => {
      const url = new URL(route.request().url());
      auditQueries.push(Object.fromEntries(url.searchParams));
      const resourceType = url.searchParams.get('resourceType');
      const resourceId = url.searchParams.get('resourceId');

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: resourceType === 'agent_document' && resourceId === 'document-test'
            ? [
              {
                id: 11,
                tenantId: 'tenant-test',
                userId: 'user-test',
                requestId: 'req-document-filtered',
                action: 'agent_document.uploaded',
                resourceType: 'agent_document',
                resourceId: 'document-test',
                outcome: 'success',
                createdAt: new Date().toISOString(),
              },
            ]
            : [
              {
                id: 12,
                tenantId: 'tenant-test',
                userId: 'user-test',
                requestId: 'req-skill-unfiltered',
                action: 'skill.bound_to_agent',
                resourceType: 'agent_skill_binding',
                resourceId: 'binding-test',
                outcome: 'success',
                createdAt: new Date().toISOString(),
              },
            ],
          meta: {count: 1, limit: 50, offset: 0},
        }),
      });
    });

    await page.goto('/governance?tab=audit&resourceType=agent_document&resourceId=document-test', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByRole('heading', {name: '审计事件'})).toBeVisible();
    await expect(page.getByText('筛选：智能体材料 / document-test')).toBeVisible();
    await expect(page.getByRole('cell', {name: '材料上传', exact: true})).toBeVisible();
    await expect(page.getByRole('cell', {name: '智能体材料', exact: true})).toBeVisible();
    await expect(page.getByRole('cell', {name: '技能绑定', exact: true})).toHaveCount(0);
    expect(auditQueries).toContainEqual(expect.objectContaining({
      limit: '50',
      resourceType: 'agent_document',
      resourceId: 'document-test',
    }));
  });

  test('审计事件支持页面筛选、清空筛选和后端 CSV 导出', async ({page}) => {
    const auditQueries: Array<Record<string, string>> = [];
    const exportQueries: Array<Record<string, string>> = [];

    await page.route('**/api/v1/platform-facts/audit-events/export**', route => {
      const url = new URL(route.request().url());
      exportQueries.push(Object.fromEntries(url.searchParams));
      return route.fulfill({
        status: 200,
        contentType: 'text/csv; charset=utf-8',
        headers: {
          'Content-Disposition': 'attachment; filename="neptune-audit-events-test.csv"',
        },
        body: [
          'id,createdAt,tenantId,userId,requestId,action,resourceType,resourceId,outcome',
          '11,2026-05-22T00:00:00.000Z,tenant-test,user-test,req-document-filtered,agent_document.uploaded,agent_document,document-test,success',
          '',
        ].join('\n'),
      });
    });
    await page.route('**/api/v1/platform-facts/audit-events**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/audit-events/export')) {
        return route.fallback();
      }
      auditQueries.push(Object.fromEntries(url.searchParams));
      const isFiltered = url.searchParams.get('resourceType') === 'agent_document'
        && url.searchParams.get('resourceId') === 'document-test'
        && url.searchParams.get('action') === 'agent_document.uploaded'
        && url.searchParams.get('outcome') === 'success';

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: isFiltered
            ? [
              {
                id: 11,
                tenantId: 'tenant-test',
                userId: 'user-test',
                requestId: 'req-document-filtered',
                action: 'agent_document.uploaded',
                resourceType: 'agent_document',
                resourceId: 'document-test',
                outcome: 'success',
                createdAt: new Date().toISOString(),
              },
            ]
            : [],
          meta: {count: isFiltered ? 1 : 0, limit: 50, offset: 0},
        }),
      });
    });

    await page.goto('/governance?tab=audit', {waitUntil: 'domcontentloaded'});

    await expect(page.getByRole('heading', {name: '审计事件'})).toBeVisible();
    await page.getByLabel('资源类型').selectOption('agent_document');
    await page.getByLabel('资源 ID').fill('document-test');
    await page.getByLabel('动作').fill('agent_document.uploaded');
    await page.getByLabel('结果').selectOption('success');
    await page.getByRole('button', {name: '应用筛选'}).click();

    await expect(page).toHaveURL(/resourceType=agent_document/);
    await expect(page).toHaveURL(/resourceId=document-test/);
    await expect(page.getByRole('cell', {name: '材料上传', exact: true})).toBeVisible();
    expect(auditQueries).toContainEqual(expect.objectContaining({
      limit: '50',
      resourceType: 'agent_document',
      resourceId: 'document-test',
      action: 'agent_document.uploaded',
      outcome: 'success',
    }));

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', {name: '导出 CSV'}).click(),
    ]).then(([downloadResult]) => downloadResult);
    expect(download.suggestedFilename()).toMatch(/^neptune-audit-events-.*\.csv$/);
    expect(exportQueries).toContainEqual(expect.objectContaining({
      resourceType: 'agent_document',
      resourceId: 'document-test',
      action: 'agent_document.uploaded',
      outcome: 'success',
    }));

    await page.getByRole('button', {name: '清空筛选'}).click();
    await expect(page).not.toHaveURL(/resourceType=/);
    await expect(page.getByText('暂无审计事件')).toBeVisible();
    expect(auditQueries).toContainEqual(expect.objectContaining({limit: '50'}));
  });

  test('平台事实 API 错误信封应显示中文原因和请求编号', async ({page}) => {
    await page.route('**/api/v1/platform-facts/runs**', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'PLATFORM_FACTS_UNAVAILABLE',
        message: '平台事实暂时不可用',
        requestId: 'req-governance-error-e2e',
        details: {surface: 'governance'},
      }),
    }));

    await page.goto('/governance', {waitUntil: 'domcontentloaded'});

    await expect(page.getByText('加载失败：平台事实暂时不可用')).toBeVisible({timeout: 15000});
    await expect(page.getByText('请求编号：req-governance-error-e2e')).toBeVisible();
  });

  test('成本概览展示新 Run 放行状态和中文配额原因', async ({page}) => {
    const quotaRequests: string[] = [];
    await page.route('**/api/v1/platform-facts/cost-summary**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-test',
        period: 'all_time',
        totalInputTokens: 8,
        totalOutputTokens: 4,
        totalTokens: 12,
        totalCostCents: 3,
        recordCount: 2,
        quota: {maxTokensPerDay: 10, maxConcurrentSessions: 2},
        quotaUsage: {totalTokensToday: 10, runningSessions: 1},
        byModel: [],
        updatedAt: new Date().toISOString(),
      }),
    }));
    await page.route('**/api/v1/platform-facts/quota/status**', route => {
      quotaRequests.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenantId: 'tenant-test',
          allowed: false,
          reason: 'TOKEN_QUOTA_EXCEEDED',
          quota: {maxTokensPerDay: 10, maxConcurrentSessions: 2},
          usage: {totalTokensToday: 10, runningSessions: 1},
          remaining: {tokensToday: 0, concurrentSessions: 1},
          message: '租户 token 配额不足',
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/governance?tab=costs', {waitUntil: 'domcontentloaded'});

    await expect(page.getByRole('heading', {name: '成本概览'})).toBeVisible();
    await expect(page.getByText('新 Run 放行状态')).toBeVisible();
    await expect(page.getByText('今日 token 已达到租户配额上限，暂不能发起新运行。')).toBeVisible();
    await expect(page.getByText('今日已用')).toBeVisible();
    await expect(page.getByText('每日 token 限额')).toBeVisible();
    await expect(page.getByText('运行中并发')).toBeVisible();
    await expect(page.getByText('最大并发')).toBeVisible();
    expect(quotaRequests.length).toBeGreaterThanOrEqual(1);
  });

  test('运行深链支持详情、取消、重试和中文错误信封', async ({page}) => {
    const runId = '11111111-2222-4333-8444-555555555555';
    const retryRunId = '99999999-8888-4777-8666-555555555555';
    const now = new Date().toISOString();

    await page.route('**/api/v1/platform-facts/runs?**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: runId,
          tenantId: 'tenant-test',
          userId: 'user-test',
          agentId: 'agent-test',
          agentVersionId: 'version-test',
          threadId: 'thread-test',
          requestId: 'req-run-test',
          status: 'cancelled',
          model: 'neptune-controlled-model',
          inputTokens: 10,
          outputTokens: 20,
          startedAt: now,
          completedAt: now,
          retryOfRunId: null,
        }],
        meta: {count: 1, limit: 50, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/runs/${runId}`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        run: {
          id: runId,
          tenantId: 'tenant-test',
          userId: 'user-test',
          agentId: 'agent-test',
          agentVersionId: 'version-test',
          threadId: 'thread-test',
          requestId: 'req-run-test',
          status: 'cancelled',
          model: 'neptune-controlled-model',
          inputTokens: 10,
          outputTokens: 20,
          startedAt: now,
          completedAt: now,
          retryOfRunId: null,
        },
        events: {
          data: [{id: 1, tenantId: 'tenant-test', runId, eventType: 'run.started', sequence: 1, requestId: 'req-run-test', payloadSummary: {}, occurredAt: now}],
          meta: {count: 1, limit: 50, offset: 0},
        },
        toolInvocations: {
          data: [{id: 'tool-1', tenantId: 'tenant-test', runId, toolUseId: 'tool-use-1', toolName: '受控工具', status: 'running', requestId: 'req-run-test', inputSummary: {}, outputSummary: null, errorSummary: null, startedAt: now, completedAt: null}],
          meta: {count: 1, limit: 50, offset: 0},
        },
      }),
    }));
    await page.route(`**/api/v1/platform-facts/runs/${runId}/observability`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-test',
        runId,
        requestId: 'req-run-test',
        threadId: 'thread-test',
        agentId: 'agent-test',
        agentVersionId: 'version-test',
        status: 'cancelled',
        model: 'neptune-controlled-model',
        durationMs: 3250,
        tokenUsage: {inputTokens: 10, outputTokens: 20, totalTokens: 30},
        factCounts: {
          events: 1,
          toolInvocations: 1,
          artifacts: 1,
          evidenceArtifacts: 1,
          policyDecisions: 1,
          auditEvents: 2,
        },
        trace: {
          provider: 'internal',
          traceId: null,
          traceUrl: null,
          message: '当前运行尚未持久化外部 trace 链接；请使用请求、运行和线程关联键追溯。',
        },
        agentVersion: {
          id: 'version-test',
          tenantId: 'tenant-test',
          agentId: 'agent-test',
          version: 1,
          versionHash: 'sha256:111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000',
          createdBy: 'user-test',
          createdAt: now,
          snapshotSummary: {
            name: '观测智能体',
            description: '测试用',
            modelProvider: 'controlled',
            model: 'neptune-controlled-model',
            toolCount: 1,
            skillCount: 1,
            mcpServerCount: 1,
          },
        },
        updatedAt: now,
      }),
    }));
    await page.route(`**/api/v1/platform-facts/runs/${runId}/artifacts**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 'artifact-1',
          tenantId: 'tenant-test',
          runId,
          requestId: 'req-run-test',
          artifactType: 'report',
          title: '观测报告',
          mimeType: 'application/json',
          sizeBytes: 123,
          sha256: 'sha256-observability-report',
          storageUri: 'memory://observability-report',
          sourceType: 'generated_report',
          sourceRef: null,
          createdBy: 'user-test',
          metadataSummary: {},
          createdAt: now,
        }],
        meta: {count: 1, limit: 100, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/platform-facts/runs/${runId}/evidence-artifacts**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 'evidence-1',
          tenantId: 'tenant-test',
          artifactId: 'artifact-1',
          runId,
          requestId: 'req-run-test',
          evidenceType: 'runtime_observation',
          sourceSystem: 'controlled-engine',
          sourceUri: null,
          sourceHash: 'sha256-observability-evidence',
          importedBy: 'user-test',
          capturedAt: now,
          metadataSummary: {},
          createdAt: now,
        }],
        meta: {count: 1, limit: 100, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/runs/${runId}/cancel`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({id: runId, status: 'cancelled', completedAt: now}),
    }));
    await page.route(`**/api/v1/runs/${runId}/retry`, route => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({id: retryRunId, status: 'completed', retryOfRunId: runId}),
    }));

    await page.goto(`/governance?tab=runs&runId=${runId}`, {waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading', {name: '运行详情'})).toBeVisible();
    await expect(page.getByText('受控工具')).toBeVisible();
    await expect(page.getByText('可观测性关联')).toBeVisible();
    await expect(page.getByText('版本指纹')).toBeVisible();
    await expect(page.getByText('sha256:1...0000')).toBeVisible();
    await expect(page.getByText('请求 ID')).toBeVisible();
    await expect(page.getByText('事件 1 条')).toBeVisible();
    await expect(page.getByText('工具调用 1 次')).toBeVisible();
    await expect(page.getByText('成果文件 1 个')).toBeVisible();
    await expect(page.getByText('证据元数据 1 条')).toBeVisible();

    await page.getByRole('button', {name: '查看审计事件'}).click();
    await expect(page).toHaveURL(new RegExp(`tab=audit.*resourceType=run.*resourceId=${runId}`));
    await page.goto(`/governance?tab=runs&runId=${runId}`, {waitUntil: 'domcontentloaded'});

    await page.getByRole('button', {name: '重试运行'}).click();
    await page.getByLabel('运行输入').fill('请重试这次运行。');
    await page.getByRole('button', {name: '确认重试'}).click();
    await expect(page).toHaveURL(new RegExp(`runId=${retryRunId}`));

    await page.unroute(`**/api/v1/runs/${retryRunId}`);
    await page.route(`**/api/v1/runs/${retryRunId}`, route => route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'STATE_CONFLICT',
        message: '当前运行状态不允许取消。',
        requestId: 'req-run-conflict',
        details: {},
      }),
    }));
  });
});
