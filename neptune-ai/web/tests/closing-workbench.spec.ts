import {expect, test} from '@playwright/test';
import {attachDiagnostics, loginViaApi, printReport} from './helpers';

test.describe('关账工作台', () => {
  test.beforeEach(async ({page}) => {
    await loginViaApi(page);
  });

  test('冒烟测试：中文入口、关账事实 API 和核心标签可用', async ({page}) => {
    const diag = attachDiagnostics(page);
    const workspacesResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/closing/workspaces') && response.status() === 200,
    );

    await page.goto('/close', {waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading', {name: '关账工作台'})).toBeVisible();
    await ensureCloseWorkspace(page);
    await expect(page.getByTestId('nav-close')).toBeVisible();
    await expect(page.getByRole('button', {name: /期间总览/})).toBeVisible();
    await expect(page.getByRole('button', {name: /检查清单/})).toBeVisible();
    await expect(page.getByRole('button', {name: /异常发现/})).toBeVisible();
    await expect(page.getByRole('button', {name: /证据中心/})).toBeVisible();
    await expect(page.getByRole('button', {name: /复核队列/})).toBeVisible();
    await expect(page.getByRole('button', {name: /summarize 关账报告/})).toBeVisible();

    await workspacesResponse;
    const apiRequests = diag.requests.filter(request => request.includes('/closing/'));
    expect(apiRequests.length).toBeGreaterThanOrEqual(1);

    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

  test('正常流程：发起检查、提交复核并生成关账报告', async ({page}) => {
    const diag = attachDiagnostics(page);

    await page.goto('/close', {waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading', {name: '关账工作台'})).toBeVisible();
    await ensureCloseWorkspace(page);
    const createWorkspaceResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/closing/workspaces') && response.status() === 201,
    );
    await page.getByRole('button', {name: '新建演示工作区'}).click();
    await createWorkspaceResponse;
    await expect(page.getByText(/华东共享中心 2026-04 月结/).first()).toBeVisible();

    const generateChecksResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/closing/workspaces/')
      && response.url().includes('/checks:generate')
      && response.status() === 200,
    );
    await page.getByRole('button', {name: '发起关账检查'}).click();
    await generateChecksResponse;
    await expect(page.getByRole('heading', {name: '异常发现'})).toBeVisible();
    await expect(page.getByText('存在未过账凭证')).toBeVisible();
    await expect(page.getByText('阻塞').first()).toBeVisible();

    const submitReviewResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/closing/findings/')
      && response.url().includes('/submit-review')
      && response.status() === 201,
    );
    await page.getByRole('button', {name: '提交复核'}).click();
    await submitReviewResponse;
    await expect(page.getByRole('heading', {name: '复核队列'})).toBeVisible();
    await expect(page.getByText('复核状态：待复核')).toBeVisible();

    const approveReviewResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/closing/reviews/')
      && response.url().includes('/approve')
      && response.status() === 200,
    );
    await page.getByRole('button', {name: '批准复核'}).click();
    await approveReviewResponse;
    await expect(page.getByText('复核状态：已批准')).toBeVisible();

    const reportResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/closing/workspaces/')
      && response.url().includes('/report-snapshots')
      && response.status() === 201,
    );
    await page.getByRole('button', {name: '生成关账报告'}).click();
    await reportResponse;
    await expect(page.getByRole('heading', {name: '关账报告'})).toBeVisible();
    await expect(page.getByText(/关账报告/).last()).toBeVisible();
    await expect(page.getByText(/快照/).first()).toBeVisible();

    const apiRequests = diag.requests.filter(request => request.includes('/closing/'));
    expect(apiRequests.length).toBeGreaterThanOrEqual(6);
    printReport(diag, page.url(), await page.evaluate(() => localStorage.getItem('neptune-auth')));
  });

});

test.describe('关账工作台事实链前端验收', () => {
  test.beforeEach(async ({page}) => {
    await seedAuth(page);
  });

  test('事实链：关账异常可以追溯到受控运行和审计链', async ({page}) => {
    const now = new Date().toISOString();
    const workspaceId = 'workspace-facts';
    const periodId = 'period-2026-04';
    const runId = 'run-close-facts';

    await page.route('**/api/v1/closing/workspaces?**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: workspaceId,
          tenantId: 'tenant-test',
          name: '华东共享中心 2026-04 月结',
          scope: {ledgerName: '总账账套 A'},
          status: 'active',
          createdBy: 'user-test',
          createdAt: now,
          updatedAt: now,
        }],
        meta: {count: 1, limit: 20, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/overview`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        workspace: {
          id: workspaceId,
          tenantId: 'tenant-test',
          name: '华东共享中心 2026-04 月结',
          scope: {ledgerName: '总账账套 A'},
          status: 'active',
          createdBy: 'user-test',
          createdAt: now,
          updatedAt: now,
        },
        currentPeriod: {
          id: periodId,
          tenantId: 'tenant-test',
          workspaceId,
          periodKey: '2026-04',
          startsAt: '2026-04-01T00:00:00.000Z',
          endsAt: '2026-04-30T23:59:59.000Z',
          status: 'review_pending',
          lockedBy: null,
          lockedAt: null,
          metadataSummary: {},
          createdAt: now,
          updatedAt: now,
        },
        checklistSummary: {total: 1, passed: 0, failed: 1, blocking: 1, reviewPending: 0},
        findingSummary: {open: 1, resolved: 0, waived: 0, blocking: 1},
        latestReport: null,
      }),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/checklist`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 'check-1',
          tenantId: 'tenant-test',
          workspaceId,
          periodId,
          code: 'GL-OPEN-VOUCHER',
          title: '未过账凭证检查',
          description: '检查总账未过账凭证。',
          severity: 'blocking',
          status: 'failed',
          runId,
          ownerUserId: null,
          reviewerUserId: null,
          metadataSummary: {},
          createdAt: now,
          updatedAt: now,
        }],
        meta: {count: 1, limit: 50, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/findings`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 'finding-1',
          tenantId: 'tenant-test',
          workspaceId,
          periodId,
          checklistItemId: 'check-1',
          runId,
          title: '存在未过账凭证',
          summary: '发现 3 张未过账凭证。',
          severity: 'blocking',
          status: 'open',
          assigneeId: null,
          evidenceArtifactIds: ['evidence-1'],
          evidenceCount: 1,
          humanReviewId: null,
          reviewStatus: null,
          decisionReason: null,
          metadataSummary: {},
          createdAt: now,
          updatedAt: now,
        }],
        meta: {count: 1, limit: 50, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/evidence-artifacts**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 'evidence-1',
          tenantId: 'tenant-test',
          artifactId: 'artifact-1',
          runId,
          requestId: 'req-close-facts',
          evidenceType: 'runtime_observation',
          sourceSystem: 'mock-erp',
          sourceUri: null,
          sourceHash: 'sha256-close-evidence',
          importedBy: 'user-test',
          capturedAt: now,
          metadataSummary: {rowCount: 3, columnCount: 6},
          createdAt: now,
        }],
        meta: {count: 1, limit: 100, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/report-snapshots`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 'report-1',
          tenantId: 'tenant-test',
          workspaceId,
          periodId,
          status: 'generated',
          title: '2026-04 关账报告',
          summary: {findingCount: 1},
          snapshot: {},
          snapshotHash: 'sha256-close-report-facts',
          runIds: [runId],
          evidenceArtifactIds: ['evidence-1'],
          findingIds: ['finding-1'],
          humanReviewIds: [],
          auditEventIds: [1],
          artifactId: null,
          generatedBy: 'user-test',
          generatedAt: now,
          createdAt: now,
        }],
        meta: {count: 1, limit: 50, offset: 0},
      }),
    }));
    await page.route('**/api/v1/closing/report-snapshots/report-1', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        report: {
          id: 'report-1',
          tenantId: 'tenant-test',
          workspaceId,
          periodId,
          status: 'generated',
          title: '2026-04 关账报告',
          summary: {findingCount: 1},
          snapshot: {},
          snapshotHash: 'sha256-close-report-facts',
          runIds: [runId],
          evidenceArtifactIds: ['evidence-1'],
          findingIds: ['finding-1'],
          humanReviewIds: ['review-1'],
          auditEventIds: [1],
          artifactId: null,
          generatedBy: 'user-test',
          generatedAt: now,
          createdAt: now,
        },
        facts: {
          runs: [{
            id: runId,
            tenantId: 'tenant-test',
            userId: 'user-test',
            agentId: 'agent-close',
            agentVersionId: 'agent-version-close',
            threadId: 'thread-close',
            requestId: 'req-close-facts',
            status: 'completed',
            model: 'controlled-close-model',
            inputTokens: 12,
            outputTokens: 8,
            startedAt: now,
            completedAt: now,
            retryOfRunId: null,
          }],
          evidenceArtifacts: [{
            id: 'evidence-1',
            tenantId: 'tenant-test',
            artifactId: 'artifact-1',
            runId,
            requestId: 'req-close-facts',
            evidenceType: 'runtime_observation',
            sourceSystem: 'mock-erp',
            sourceUri: null,
            sourceHash: 'sha256-close-evidence',
            importedBy: 'user-test',
            capturedAt: now,
            metadataSummary: {},
            createdAt: now,
          }],
          findings: [{
            id: 'finding-1',
            tenantId: 'tenant-test',
            workspaceId,
            periodId,
            checklistItemId: 'check-1',
            runId,
            title: '存在未过账凭证',
            summary: '发现 3 张未过账凭证。',
            severity: 'blocking',
            status: 'approved',
            assigneeId: null,
            evidenceArtifactIds: ['evidence-1'],
            evidenceCount: 1,
            humanReviewId: 'review-1',
            reviewStatus: 'approved',
            decisionReason: '财务负责人已批准。',
            metadataSummary: {},
            createdAt: now,
            updatedAt: now,
          }],
          humanReviews: [{
            id: 'review-1',
            tenantId: 'tenant-test',
            runId,
            requestId: 'req-close-facts',
            reviewType: 'close_finding',
            status: 'approved',
            subjectType: 'closing_finding',
            subjectId: 'finding-1',
            title: '关账异常复核：存在未过账凭证',
            reason: '阻塞项需要财务负责人复核。',
            assignedTo: null,
            requestedBy: 'user-test',
            decidedBy: 'reviewer-test',
            decision: 'approve',
            decisionReason: '财务负责人已批准。',
            decisionSummary: {},
            createdAt: now,
            decidedAt: now,
          }],
          auditEvents: [{
            id: 1,
            tenantId: 'tenant-test',
            userId: 'user-test',
            requestId: 'req-close-facts',
            action: 'closing.report_snapshot.generated',
            resourceType: 'closing_report',
            resourceId: 'report-1',
            outcome: 'success',
            createdAt: now,
          }],
        },
      }),
    }));
    await page.route('**/api/v1/platform-facts/runs?**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: runId,
          tenantId: 'tenant-test',
          userId: 'user-test',
          agentId: 'agent-close',
          agentVersionId: 'agent-version-close',
          threadId: 'thread-close',
          requestId: 'req-close-facts',
          status: 'completed',
          model: 'controlled-close-model',
          inputTokens: 12,
          outputTokens: 8,
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
          agentId: 'agent-close',
          agentVersionId: 'agent-version-close',
          threadId: 'thread-close',
          requestId: 'req-close-facts',
          status: 'completed',
          model: 'controlled-close-model',
          inputTokens: 12,
          outputTokens: 8,
          startedAt: now,
          completedAt: now,
          retryOfRunId: null,
        },
        observability: null,
        events: {data: [], meta: {count: 0, limit: 50, offset: 0}},
        toolInvocations: {data: [], meta: {count: 0, limit: 50, offset: 0}},
        artifacts: {data: [], meta: {count: 0, limit: 50, offset: 0}},
        evidenceArtifacts: {data: [], meta: {count: 0, limit: 50, offset: 0}},
        policyDecisions: {data: [], meta: {count: 0, limit: 50, offset: 0}},
        humanReviews: {data: [], meta: {count: 0, limit: 50, offset: 0}},
        auditEvents: {data: [], meta: {count: 0, limit: 50, offset: 0}},
      }),
    }));
    await page.route(`**/api/v1/platform-facts/runs/${runId}/observability`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-test',
        runId,
        requestId: 'req-close-facts',
        threadId: 'thread-close',
        agentId: 'agent-close',
        agentVersionId: 'agent-version-close',
        status: 'completed',
        model: 'controlled-close-model',
        durationMs: 1200,
        tokenUsage: {inputTokens: 12, outputTokens: 8, totalTokens: 20},
        factCounts: {events: 0, toolInvocations: 0, artifacts: 0, evidenceArtifacts: 0, policyDecisions: 0, auditEvents: 0},
        trace: {provider: 'internal', traceId: null, traceUrl: null, message: '本地验收 trace'},
        agentVersion: null,
        updatedAt: now,
      }),
    }));
    await page.route('**/api/v1/platform-facts/cost-summary**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-test',
        period: 'all_time',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCostCents: 0,
        recordCount: 0,
        quota: {maxTokensPerDay: 1000, maxConcurrentSessions: 2},
        quotaUsage: {totalTokensToday: 0, runningSessions: 0},
        byModel: [],
        updatedAt: now,
      }),
    }));
    await page.route('**/api/v1/platform-facts/quota/status', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-test',
        allowed: true,
        reason: null,
        quota: {maxTokensPerDay: 1000, maxConcurrentSessions: 2},
        usage: {totalTokensToday: 0, runningSessions: 0},
        remaining: {tokensToday: 1000, concurrentSessions: 2},
        message: '允许发起新运行',
        updatedAt: now,
      }),
    }));
    await page.route('**/api/v1/platform-facts/policy-decisions**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({data: [], meta: {count: 0, limit: 50, offset: 0}}),
    }));
    await page.route('**/api/v1/platform-facts/human-reviews**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({data: [], meta: {count: 0, limit: 50, offset: 0}}),
    }));
    await page.route('**/api/v1/platform-facts/audit-events**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({data: [], meta: {count: 0, limit: 50, offset: 0}}),
    }));
    await page.route('**/api/v1/platform-facts/agents/**/versions**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({data: [], meta: {count: 0, limit: 50, offset: 0}}),
    }));

    await page.goto('/close', {waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading', {name: '关账工作台'})).toBeVisible();

    await page.getByRole('button', {name: /期间总览/}).click();
    await expect(page.getByRole('heading', {name: '本期受控运行事实链'})).toBeVisible();
    await expect(page.getByText('关账检查运行', {exact: true})).toBeVisible();
    await expect(page.getByText('证据链', {exact: true})).toBeVisible();
    await expect(page.getByText('复核与审计', {exact: true})).toBeVisible();

    await page.getByRole('button', {name: /summarize 关账报告/}).click();
    await expect(page.getByRole('heading', {name: '关账报告'})).toBeVisible();
    await page.getByRole('button', {name: '展开报告依据'}).click();
    await expect(page.getByRole('heading', {name: '报告依据详情'})).toBeVisible();
    await expect(page.getByText('运行', {exact: true}).first()).toBeVisible();
    await expect(page.getByText('证据', {exact: true}).first()).toBeVisible();
    await expect(page.getByText('异常', {exact: true}).first()).toBeVisible();
    await expect(page.getByText('复核', {exact: true}).first()).toBeVisible();
    await expect(page.getByText('审计事件', {exact: true}).first()).toBeVisible();
    await expect(page.getByText('1 次').first()).toBeVisible();
    await expect(page.getByText('1 条').first()).toBeVisible();
    await expect(page.getByText('1 个').first()).toBeVisible();
    await expect(page.getByText('1 项').first()).toBeVisible();
    await expect(page.getByText('sha256-close-evidence').first()).toBeVisible();
    await expect(page.getByText('发现 3 张未过账凭证。')).toBeVisible();
    await expect(page.getByText(/控制项 GL-OPEN-VOUCHER/)).toBeVisible();
    await expect(page.getByText(/审批人 reviewer-test/).first()).toBeVisible();
    await expect(page.getByText(/财务负责人已批准。/).first()).toBeVisible();
    await expect(page.getByText(/请求 req-close-facts/).first()).toBeVisible();
    await expect(page.getByText('关账报告生成').first()).toBeVisible();

    await page.getByRole('button', {name: /异常发现/}).click();
    await expect(page.getByRole('heading', {name: '异常发现'})).toBeVisible();
    await expect(page.getByRole('link', {name: '查看运行追踪'}).first()).toBeVisible();
    await expect(page.getByRole('link', {name: '查看审计事件'}).first()).toBeVisible();

    await page.getByRole('button', {name: /证据中心/}).click();
    await expect(page.getByRole('heading', {name: '证据中心'})).toBeVisible();
    await expect(page.getByText('运行观察 · mock-erp')).toBeVisible();
    await expect(page.getByText(/hash sha256-close-evidence/)).toBeVisible();
    await expect(page.getByText('行数 3')).toBeVisible();
    await expect(page.getByText('列数 6')).toBeVisible();
    await expect(page.getByText(/关联异常：存在未过账凭证/)).toBeVisible();

    await page.getByRole('link', {name: '查看运行追踪'}).first().click();
    await expect(page).toHaveURL(/\/governance\?tab=runs&runId=/);
    await expect(page.getByRole('heading', {name: '治理台'})).toBeVisible();
  });

  test('证据中心可以导入 CSV 证据并刷新证据链', async ({page}) => {
    const now = new Date().toISOString();
    const workspaceId = 'workspace-csv-import';
    const periodId = 'period-csv-import';
    let imported = false;
    const importRequests: string[] = [];

    await page.route('**/api/v1/closing/workspaces?**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: workspaceId,
          tenantId: 'tenant-test',
          name: '华东共享中心 2026-08 月结',
          scope: {ledgerName: '总账账套 A'},
          status: 'active',
          createdBy: 'user-test',
          createdAt: now,
          updatedAt: now,
        }],
        meta: {count: 1, limit: 20, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/overview`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        workspace: {
          id: workspaceId,
          tenantId: 'tenant-test',
          name: '华东共享中心 2026-08 月结',
          scope: {ledgerName: '总账账套 A'},
          status: 'active',
          createdBy: 'user-test',
          createdAt: now,
          updatedAt: now,
        },
        currentPeriod: {
          id: periodId,
          tenantId: 'tenant-test',
          workspaceId,
          periodKey: '2026-08',
          startsAt: '2026-08-01T00:00:00.000Z',
          endsAt: '2026-08-31T23:59:59.000Z',
          status: 'open',
          lockedBy: null,
          lockedAt: null,
          metadataSummary: {},
          createdAt: now,
          updatedAt: now,
        },
        checklistSummary: {total: 0, passed: 0, failed: 0, blocking: 0, reviewPending: 0},
        findingSummary: {open: imported ? 1 : 0, resolved: 0, waived: 0, blocking: 0},
        latestReport: null,
      }),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/checklist`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({data: [], meta: {count: 0, limit: 50, offset: 0}}),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/findings`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: imported ? [{
          id: 'finding-imported',
          tenantId: 'tenant-test',
          workspaceId,
          periodId,
          checklistItemId: 'manual-import',
          runId: null,
          title: '导入的试算平衡表证据',
          summary: 'CSV 证据已导入。',
          severity: 'warning',
          status: 'open',
          assigneeId: null,
          evidenceArtifactIds: ['evidence-csv-1'],
          evidenceCount: 1,
          humanReviewId: null,
          reviewStatus: null,
          decisionReason: null,
          metadataSummary: {},
          createdAt: now,
          updatedAt: now,
        }] : [],
        meta: {count: imported ? 1 : 0, limit: 50, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/evidence-artifacts**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: imported ? [{
          id: 'evidence-csv-1',
          tenantId: 'tenant-test',
          artifactId: 'artifact-csv-1',
          runId: null,
          requestId: 'req-csv-import',
          evidenceType: 'source_file',
          sourceSystem: 'manual-upload',
          sourceUri: 'memory://closing/imports/trial-balance.csv',
          sourceHash: '111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000',
          importedBy: 'user-test',
          capturedAt: now,
          metadataSummary: {rowCount: 1, columnCount: 2},
          createdAt: now,
        }] : [],
        meta: {count: imported ? 1 : 0, limit: 100, offset: 0},
      }),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/report-snapshots`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({data: [], meta: {count: 0, limit: 50, offset: 0}}),
    }));
    await page.route(`**/api/v1/closing/workspaces/${workspaceId}/evidence-imports:csv`, async route => {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data');
      importRequests.push(route.request().postData() ?? '');
      imported = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          artifact: {
            id: 'artifact-csv-1',
            tenantId: 'tenant-test',
            runId: null,
            requestId: 'req-csv-import',
            artifactType: 'dataset',
            title: 'trial-balance.csv',
            mimeType: 'text/csv',
            sizeBytes: 24,
            sha256: '111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000',
            storageUri: 'memory://closing/imports/trial-balance.csv',
            sourceType: 'upload',
            sourceRef: 'manual-upload',
            createdBy: 'user-test',
            metadataSummary: {rowCount: 1, columnCount: 2},
            createdAt: now,
          },
          evidence: {
            id: 'evidence-csv-1',
            tenantId: 'tenant-test',
            artifactId: 'artifact-csv-1',
            runId: null,
            requestId: 'req-csv-import',
            evidenceType: 'source_file',
            sourceSystem: 'manual-upload',
            sourceUri: 'memory://closing/imports/trial-balance.csv',
            sourceHash: '111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000',
            importedBy: 'user-test',
            capturedAt: now,
            metadataSummary: {rowCount: 1, columnCount: 2},
            createdAt: now,
          },
          linkedFindings: [],
          summary: {rowCount: 1, columnCount: 2, schemaStatus: 'valid', linkedFindingCount: 0},
        }),
      });
    });

    await page.goto('/close', {waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('heading', {name: '关账工作台'})).toBeVisible();
    await page.getByRole('button', {name: /证据中心/}).click();
    await expect(page.getByText('暂无证据')).toBeVisible();
    await expect(page.getByRole('button', {name: '导入 CSV 证据'})).toBeVisible();

    await page.getByLabel('导入 CSV 证据').setInputFiles({
      name: 'trial-balance.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('account,amount\n1001,1200'),
    });

    await expect(page.getByText('源文件 · manual-upload')).toBeVisible();
    await expect(page.getByText(/hash 11112222/)).toBeVisible();
    await expect(page.getByText('行数 1')).toBeVisible();
    await expect(page.getByText('列数 2')).toBeVisible();
    await expect(page.getByText(/关联异常：导入的试算平衡表证据/)).toBeVisible();
    expect(importRequests).toHaveLength(1);
    expect(importRequests[0]).toContain('name="periodId"');
    expect(importRequests[0]).toContain(periodId);
    expect(importRequests[0]).toContain('name="file"');
    expect(importRequests[0]).toContain('filename="trial-balance.csv"');
    expect(importRequests[0]).toContain('account,amount\n1001,1200');
    expect(importRequests[0]).toContain('name="sourceSystem"');
    expect(importRequests[0]).toContain('manual-upload');
  });
});

async function seedAuth(page: import('@playwright/test').Page) {
  await page.goto('/login', {waitUntil: 'domcontentloaded'});
  await page.evaluate(() => {
    localStorage.setItem('neptune-auth', JSON.stringify({
      state: {
        token: 'e2e-token',
        user: {id: 'user-test', email: 'e2e@neptune.ai', name: 'Neptune E2E'},
        isAuthenticated: true,
      },
      version: 0,
    }));
  });
}

async function ensureCloseWorkspace(page: import('@playwright/test').Page) {
  const createButton = page.getByRole('button', {name: '创建演示工作区'});
  if (await createButton.isVisible()) {
    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/v1/closing/workspaces') && response.status() === 201,
    );
    await createButton.click();
    await createResponse;
  }
  await expect(page.getByText(/华东共享中心|会计期间/).first()).toBeVisible();
}
