process.env.DATA_ROOT = `/tmp/neptune-run-control-${Date.now()}`;
process.env.NEPTUNE_ENGINE_MODE = 'controlled';

import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import {and, eq} from 'drizzle-orm';
import {createTestApp, TEST_AGENT_TEMPLATE} from './setup';
import {db} from '../src/db';
import {auditEvents, billingRecords, humanReviews, policyDecisions, runEvents, runs, tenants} from '../src/db/schema';

async function createRunControlUser(app: FastifyInstance, label: string) {
    const suffix = `${label}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
            tenantName: `RunControl ${suffix}`,
            name: `RunControl User ${suffix}`,
            email: `run-control-${suffix}@test.com`,
            password: 'password123',
        },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    return {
        token: body.accessToken as string,
        tenantId: body.user.tenantId as string,
        userId: body.user.id as string,
    };
}

async function createAgent(app: FastifyInstance, token: string) {
    const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: {authorization: `Bearer ${token}`},
        payload: {
            ...TEST_AGENT_TEMPLATE,
            name: `RunControl Agent ${Date.now()}`,
        },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
}

async function createThread(app: FastifyInstance, token: string, agentId: string, title: string) {
    const res = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads`,
        headers: {authorization: `Bearer ${token}`},
        payload: {title},
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
}

describe('RunControl API', () => {
    let app: FastifyInstance;
    let token: string;
    let tenantId: string;
    let userId: string;
    let agentId: string;
    let otherToken: string;

    beforeAll(async () => {
        app = await createTestApp();
        const user = await createRunControlUser(app, 'owner');
        token = user.token;
        tenantId = user.tenantId;
        userId = user.userId;
        agentId = await createAgent(app, token);

        const otherUser = await createRunControlUser(app, 'other');
        otherToken = otherUser.token;
    });

    afterAll(async () => {
        await app.close();
    });

    test('creates a controlled run through the formal run API and exposes detail facts', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/runs',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                agentId,
                input: 'advanced workflow should create artifact facts',
                title: 'RunControl contract',
            },
        });

        expect(createRes.statusCode).toBe(201);
        const created = createRes.json();
        const createdRunId = created.id as string;
        const requestId = String(createRes.headers['x-request-id']);
        expect(created).toMatchObject({
            id: expect.any(String),
            tenantId,
            userId,
            agentId,
            requestId,
            status: 'completed',
            threadId: expect.any(String),
            agentVersionId: expect.any(String),
            model: 'neptune-controlled-model',
            inputTokens: expect.any(Number),
            outputTokens: expect.any(Number),
            startedAt: expect.any(String),
            completedAt: expect.any(String),
        });

        const detailRes = await app.inject({
            method: 'GET',
            url: `/api/v1/runs/${createdRunId}`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(detailRes.statusCode).toBe(200);
        const detailBody = detailRes.json();
        expect(detailBody).toMatchObject({
            run: {
                id: createdRunId,
                status: 'completed',
                tenantId,
            },
            observability: {
                runId: createdRunId,
            },
        });
        expect(typeof detailBody.observability.factCounts.events).toBe('number');
        expect(typeof detailBody.observability.factCounts.toolInvocations).toBe('number');
        expect(typeof detailBody.observability.factCounts.artifacts).toBe('number');
        expect(typeof detailBody.observability.factCounts.evidenceArtifacts).toBe('number');
        expect(typeof detailBody.observability.factCounts.policyDecisions).toBe('number');
        expect(typeof detailBody.observability.factCounts.auditEvents).toBe('number');
        expect(Array.isArray(detailBody.events.data)).toBe(true);
        expect(Array.isArray(detailBody.toolInvocations.data)).toBe(true);
        expect(Array.isArray(detailBody.artifacts.data)).toBe(true);
        expect(Array.isArray(detailBody.evidenceArtifacts.data)).toBe(true);
        expect(Array.isArray(detailBody.policyDecisions.data)).toBe(true);
        expect(Array.isArray(detailBody.humanReviews.data)).toBe(true);
        expect(Array.isArray(detailBody.auditEvents.data)).toBe(true);
        expect(detailBody.events.data.map((event: {eventType: string}) => event.eventType)).toContain('run.completed');
        expect(detailBody.toolInvocations.data.map((tool: {status: string}) => tool.status)).toContain('completed');
        expect(detailBody.artifacts.data).toHaveLength(1);
        expect(detailBody.artifacts.data[0]).toMatchObject({
            runId: createdRunId,
            title: 'workflow-summary.md',
            sourceType: 'runtime_tool',
        });
        expect(detailBody.evidenceArtifacts.data).toHaveLength(1);
        expect(detailBody.evidenceArtifacts.data[0]).toMatchObject({
            runId: createdRunId,
            evidenceType: 'generated_extract',
            sourceSystem: 'runtime_tool',
        });
        // PolicyDecision 仅记录治理性决策（deny / review_required），成功运行不写 allow 占位。
        expect(detailBody.policyDecisions.data).toEqual([]);
        expect(detailBody.auditEvents.data.map((event: {action: string}) => event.action)).toEqual(expect.arrayContaining(['run.created', 'run.completed']));
        expect(detailBody.observability.factCounts.artifacts).toBeGreaterThanOrEqual(1);
        expect(detailBody.observability.factCounts.evidenceArtifacts).toBeGreaterThanOrEqual(1);
        expect(JSON.stringify(detailBody)).not.toContain('source prompt');
        expect(JSON.stringify(detailBody)).not.toContain('secret');

        const [review] = await db.insert(humanReviews).values({
            tenantId,
            runId: createdRunId,
            requestId,
            reviewType: 'run_result',
            status: 'pending',
            subjectType: 'run',
            subjectId: createdRunId,
            title: '运行结果需要复核',
            reason: '高风险输出需要人工确认',
            requestedBy: userId,
        }).returning();

        const detailWithReviewRes = await app.inject({
            method: 'GET',
            url: `/api/v1/runs/${createdRunId}`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(detailWithReviewRes.statusCode).toBe(200);
        expect(detailWithReviewRes.json().humanReviews.data).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: review.id,
                runId: createdRunId,
                status: 'pending',
                title: '运行结果需要复核',
            }),
        ]));

        const auditRows = await db.select()
            .from(auditEvents)
            .where(and(
                eq(auditEvents.tenantId, tenantId),
                eq(auditEvents.resourceType, 'run'),
                eq(auditEvents.resourceId, createdRunId),
            ));
        expect(auditRows.map(row => row.action)).toContain('run.created');
        expect(auditRows.map(row => row.action)).toContain('run.completed');
        expect(auditRows.every(row => row.userId === userId)).toBe(true);
    });

    test('quota denial through formal run API returns 429 envelope and persists governance facts without starting a run', async () => {
        const quotaUser = await createRunControlUser(app, 'quota-deny');
        const quotaAgentId = await createAgent(app, quotaUser.token);
        await db.update(tenants)
            .set({quota: {maxTokensPerDay: 0, maxConcurrentSessions: 10}})
            .where(eq(tenants.id, quotaUser.tenantId));
        const requestId = `req-run-quota-denied-${Date.now()}`;
        const billingRowsBefore = await db.select().from(billingRecords).where(
            eq(billingRecords.tenantId, quotaUser.tenantId),
        );

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/runs',
            headers: {authorization: `Bearer ${quotaUser.token}`, 'x-request-id': requestId},
            payload: {
                agentId: quotaAgentId,
                input: '这次正式运行应该被租户配额拒绝',
                title: 'Quota denied run',
            },
        });

        expect(res.statusCode).toBe(429);
        expect(res.headers['x-request-id']).toBe(requestId);
        expect(res.json()).toMatchObject({
            error: 'QUOTA_EXCEEDED',
            message: '租户配额不足',
            requestId,
            details: {
                reason: 'TOKEN_QUOTA_EXCEEDED',
                quota: {maxTokensPerDay: 0, maxConcurrentSessions: 10},
                usage: {totalTokensToday: 0, runningSessions: 0},
            },
        });

        const runRows = await db.select().from(runs).where(and(
            eq(runs.tenantId, quotaUser.tenantId),
            eq(runs.requestId, requestId),
        ));
        expect(runRows).toHaveLength(0);

        const billingRowsAfter = await db.select().from(billingRecords).where(
            eq(billingRecords.tenantId, quotaUser.tenantId),
        );
        expect(billingRowsAfter).toHaveLength(billingRowsBefore.length);

        const policyRows = await db.select().from(policyDecisions).where(and(
            eq(policyDecisions.tenantId, quotaUser.tenantId),
            eq(policyDecisions.requestId, requestId),
            eq(policyDecisions.policyType, 'quota'),
        ));
        expect(policyRows).toHaveLength(1);
        expect(policyRows[0]).toMatchObject({
            decision: 'deny',
            reason: '租户 token 配额不足',
        });

        const auditRows = await db.select().from(auditEvents).where(and(
            eq(auditEvents.tenantId, quotaUser.tenantId),
            eq(auditEvents.requestId, requestId),
            eq(auditEvents.action, 'quota.blocked'),
        ));
        expect(auditRows).toHaveLength(1);
        expect(auditRows[0]).toMatchObject({
            outcome: 'failure',
            resourceType: 'thread',
        });
    });

    test('cancel marks a running run as cancelled, records an event and rejects completed runs', async () => {
        const runningThreadId = await createThread(app, token, agentId, 'Running run for cancel');
        const [runningRun] = await db.insert(runs).values({
            tenantId,
            userId,
            agentId,
            threadId: runningThreadId,
            requestId: 'req-cancel-running',
            status: 'running',
        }).returning();

        const cancelRes = await app.inject({
            method: 'POST',
            url: `/api/v1/runs/${runningRun.id}/cancel`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(cancelRes.statusCode).toBe(200);
        expect(cancelRes.json()).toMatchObject({
            id: runningRun.id,
            status: 'cancelled',
            completedAt: expect.any(String),
        });

        const cancelEventRows = await db.select()
            .from(runEvents)
            .where(and(
                eq(runEvents.tenantId, tenantId),
                eq(runEvents.runId, runningRun.id),
                eq(runEvents.eventType, 'run.cancelled'),
            ));
        expect(cancelEventRows).toHaveLength(1);

        const completedRunRes = await app.inject({
            method: 'POST',
            url: '/api/v1/runs',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                agentId,
                input: '生成一个已完成运行用于取消门禁',
            },
        });
        expect(completedRunRes.statusCode).toBe(201);

        const rejectRes = await app.inject({
            method: 'POST',
            url: `/api/v1/runs/${completedRunRes.json().id}/cancel`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(rejectRes.statusCode).toBe(409);
        expect(rejectRes.json()).toMatchObject({
            error: 'STATE_CONFLICT',
            message: '当前运行状态不允许取消。',
            requestId: expect.any(String),
        });
    });

    test('retry creates a new controlled run from a failed run and protects tenant boundary', async () => {
        const failedThreadId = await createThread(app, token, agentId, 'Failed run for retry');
        const [failedRun] = await db.insert(runs).values({
            tenantId,
            userId,
            agentId,
            threadId: failedThreadId,
            requestId: 'req-failed-for-retry',
            status: 'failed',
            error: {message: '上一次运行失败'},
            completedAt: new Date(),
        }).returning();

        const retryRes = await app.inject({
            method: 'POST',
            url: `/api/v1/runs/${failedRun.id}/retry`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                input: '重试上一次失败的受控运行',
            },
        });
        expect(retryRes.statusCode).toBe(201);
        expect(retryRes.json()).toMatchObject({
            id: expect.any(String),
            status: 'completed',
            agentId,
            retryOfRunId: failedRun.id,
        });

        const otherDetailRes = await app.inject({
            method: 'GET',
            url: `/api/v1/runs/${failedRun.id}`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherDetailRes.statusCode).toBe(404);
        expect(otherDetailRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应运行记录，或你没有权限访问。',
            requestId: expect.any(String),
        });
    });

    test('lists controlled runs scoped to a thread and protects thread tenant boundary', async () => {
        const threadId = await createThread(app, token, agentId, 'Thread scoped controlled runs');
        const [completedRun] = await db.insert(runs).values({
            tenantId,
            userId,
            agentId,
            threadId,
            requestId: 'req-thread-run-completed',
            status: 'completed',
            model: 'neptune-controlled-model',
            inputTokens: 12,
            outputTokens: 34,
            completedAt: new Date(),
        }).returning();
        const [failedRun] = await db.insert(runs).values({
            tenantId,
            userId,
            agentId,
            threadId,
            requestId: 'req-thread-run-failed',
            status: 'failed',
            error: {message: 'failed run should be filterable'},
            completedAt: new Date(),
        }).returning();

        const listRes = await app.inject({
            method: 'GET',
            url: `/api/v1/agents/${agentId}/threads/${threadId}/runs?status=completed&limit=1&offset=0`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(listRes.statusCode).toBe(200);
        const body = listRes.json();
        expect(body.data).toHaveLength(1);
        expect(body.data[0]).toMatchObject({
            id: completedRun.id,
            tenantId,
            userId,
            agentId,
            threadId,
            requestId: 'req-thread-run-completed',
            status: 'completed',
            model: 'neptune-controlled-model',
            inputTokens: 12,
            outputTokens: 34,
            completedAt: expect.any(String),
        });
        expect(body.data[0]).not.toHaveProperty('metadata');
        expect(body.data[0]).not.toHaveProperty('error');
        expect(body.meta).toMatchObject({
            count: 1,
            limit: 1,
            offset: 0,
        });

        const allRes = await app.inject({
            method: 'GET',
            url: `/api/v1/agents/${agentId}/threads/${threadId}/runs?limit=10`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(allRes.statusCode).toBe(200);
        expect(allRes.json().data.map((run: {id: string}) => run.id)).toEqual(expect.arrayContaining([
            completedRun.id,
            failedRun.id,
        ]));

        const otherTenantRes = await app.inject({
            method: 'GET',
            url: `/api/v1/agents/${agentId}/threads/${threadId}/runs`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherTenantRes.statusCode).toBe(404);
        expect(otherTenantRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: 'Thread 不存在',
        });
    });

    test('validates request body with Chinese error envelopes', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/runs',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                agentId,
                input: ' ',
            },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({
            error: 'VALIDATION_FAILED',
            message: '运行输入不能为空',
            requestId: expect.any(String),
            details: {field: 'input'},
        });
    });
});
