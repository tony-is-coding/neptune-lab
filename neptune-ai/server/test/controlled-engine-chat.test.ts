process.env.DATA_ROOT = `/tmp/neptune-controlled-chat-${Date.now()}`;

import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import {createTestApp, TEST_AGENT_TEMPLATE} from './setup';
import {db} from '../src/db';
import {auditEvents, billingRecords, policyDecisions, runEvents, runs, tenants, toolInvocations} from '../src/db/schema';
import {and, eq} from 'drizzle-orm';

function parseSSE(payload: string): Array<{event: string; data: any}> {
    const events: Array<{event: string; data: any}> = [];

    for (const chunk of payload.split('\n\n')) {
        const lines = chunk.split('\n').filter(Boolean);
        const eventLine = lines.find(line => line.startsWith('event: '));
        const dataLine = lines.find(line => line.startsWith('data: '));
        if (!eventLine || !dataLine) continue;

        events.push({
            event: eventLine.slice('event: '.length),
            data: JSON.parse(dataLine.slice('data: '.length)),
        });
    }

    return events;
}

async function createTestUser(app: FastifyInstance): Promise<{token: string; tenantId: string}> {
    const suffix = Math.random().toString(36).slice(2, 8);
    const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
            tenantName: `Controlled Chat ${suffix}`,
            name: `Controlled User ${suffix}`,
            email: `controlled-chat-${suffix}@test.com`,
            password: 'password123',
        },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();

    return {
        token: body.accessToken,
        tenantId: body.user.tenantId,
    };
}

describe('Controlled Engine chat SSE', () => {
    let app: FastifyInstance;
    let previousEngineMode: string | undefined;
    let token: string;
    let tenantId: string;
    let agentId: string;
    let threadId: string;

    beforeAll(async () => {
        previousEngineMode = process.env.NEPTUNE_ENGINE_MODE;
        process.env.NEPTUNE_ENGINE_MODE = 'controlled';

        app = await createTestApp();
        const user = await createTestUser(app);
        token = user.token;
        tenantId = user.tenantId;

        const agentRes = await app.inject({
            method: 'POST',
            url: '/api/v1/agents',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                ...TEST_AGENT_TEMPLATE,
                name: `Controlled E2E Agent ${Date.now()}`,
            },
        });
        expect(agentRes.statusCode).toBe(201);
        agentId = agentRes.json().id;

        const threadRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/threads`,
            headers: {authorization: `Bearer ${token}`},
            payload: {title: 'Controlled chat'},
        });
        expect(threadRes.statusCode).toBe(201);
        threadId = threadRes.json().id;
    });

    afterAll(async () => {
        if (previousEngineMode === undefined) {
            delete process.env.NEPTUNE_ENGINE_MODE;
        } else {
            process.env.NEPTUNE_ENGINE_MODE = previousEngineMode;
        }
        await app.close();
    });

    test('streams thinking, tool events, text, done usage, and persisted history', async () => {
        const chatRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/threads/${threadId}/chat`,
            headers: {authorization: `Bearer ${token}`},
            payload: {content: 'verify controlled model dispatch'},
        });

        expect(chatRes.statusCode).toBe(200);
        expect(chatRes.headers['x-request-id']).toBeTruthy();
        const events = parseSSE(chatRes.payload);
        const messageEvents = events.filter(evt => evt.event === 'message').map(evt => evt.data);

        const connected = events.find(evt => evt.event === 'connected');
        expect(connected).toBeDefined();
        expect(connected?.data.requestId).toBe(chatRes.headers['x-request-id']);
        expect(messageEvents.some(evt => evt.type === 'thinking')).toBe(true);
        expect(messageEvents.some(evt => evt.type === 'tool_use' && evt.name === 'E2EControlledTool')).toBe(true);
        expect(messageEvents.some(evt => evt.type === 'tool_result')).toBe(true);
        expect(messageEvents.filter(evt => evt.type === 'text').map(evt => evt.content).join('')).toContain('E2E OK');

        const done = events.find(evt => evt.event === 'done');
        expect(done).toBeDefined();
        expect(done?.data.requestId).toBe(chatRes.headers['x-request-id']);
        expect(done?.data).toHaveProperty('usage');

        const historyRes = await app.inject({
            method: 'GET',
            url: `/api/v1/agents/${agentId}/threads/${threadId}/history`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(historyRes.statusCode).toBe(200);
        const history = historyRes.json().data;
        expect(Array.isArray(history)).toBe(true);
        expect(JSON.stringify(history)).toContain('verify controlled model dispatch');
        expect(JSON.stringify(history)).toContain('E2E OK');
        expect(JSON.stringify(history)).toContain('E2EControlledTool');

        const billing = await db
            .select()
            .from(billingRecords)
            .where(and(
                eq(billingRecords.tenantId, tenantId),
                eq(billingRecords.sessionId, threadId),
                eq(billingRecords.model, 'neptune-controlled-model'),
            ));

        expect(billing.length).toBeGreaterThanOrEqual(1);
        expect(billing.at(-1)?.inputTokens).toBeGreaterThan(0);
        expect(billing.at(-1)?.outputTokens).toBe(36);

        const [run] = await db.select()
            .from(runs)
            .where(and(
                eq(runs.tenantId, tenantId),
                eq(runs.threadId, threadId),
                eq(runs.requestId, String(chatRes.headers['x-request-id'])),
            ));
        expect(run).toBeTruthy();

        const persistedEvents = await db.select()
            .from(runEvents)
            .where(and(
                eq(runEvents.tenantId, tenantId),
                eq(runEvents.runId, run.id),
            ));
        expect(persistedEvents.map(event => event.eventType)).toContain('run.started');
        expect(persistedEvents.map(event => event.eventType)).toContain('tool.invocation.started');
        expect(persistedEvents.map(event => event.eventType)).toContain('tool.invocation.completed');
        expect(persistedEvents.map(event => event.eventType)).toContain('run.completed');

        const persistedTools = await db.select()
            .from(toolInvocations)
            .where(and(
                eq(toolInvocations.tenantId, tenantId),
                eq(toolInvocations.runId, run.id),
            ));
        expect(persistedTools).toHaveLength(1);
        expect(persistedTools[0]).toMatchObject({
            toolName: 'E2EControlledTool',
            status: 'completed',
        });

        const decisions = await db.select()
            .from(policyDecisions)
            .where(and(
                eq(policyDecisions.tenantId, tenantId),
                eq(policyDecisions.runId, run.id),
            ));
        expect(decisions.map(decision => decision.policyType)).toContain('model');
        expect(decisions.map(decision => decision.policyType)).toContain('tool');
        expect(decisions.every(decision => decision.decision === 'allow')).toBe(true);
    });

    test('rejects chat before engine dispatch when tenant quota is exhausted', async () => {
        await db.update(tenants)
            .set({quota: {maxTokensPerDay: 0, maxConcurrentSessions: 10}})
            .where(eq(tenants.id, tenantId));

        const quotaThreadRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/threads`,
            headers: {authorization: `Bearer ${token}`},
            payload: {title: 'Quota gate'},
        });
        expect(quotaThreadRes.statusCode).toBe(201);
        const quotaThreadId = quotaThreadRes.json().id;

        const chatRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/threads/${quotaThreadId}/chat`,
            headers: {authorization: `Bearer ${token}`},
            payload: {content: 'this should be rejected before engine starts'},
        });

        expect(chatRes.statusCode).toBe(200);
        const events = parseSSE(chatRes.payload);
        const error = events.find(evt => evt.event === 'error')?.data;
        expect(error).toMatchObject({
            type: 'error',
            error: 'QUOTA_EXCEEDED',
            message: '租户配额不足',
            requestId: chatRes.headers['x-request-id'],
            details: {
                reason: 'TOKEN_QUOTA_EXCEEDED',
                quota: {maxTokensPerDay: 0, maxConcurrentSessions: 10},
            },
        });

        const blockedRuns = await db.select()
            .from(runs)
            .where(and(
                eq(runs.tenantId, tenantId),
                eq(runs.threadId, quotaThreadId),
            ));
        expect(blockedRuns.length).toBe(0);

        const blockedBilling = await db.select()
            .from(billingRecords)
            .where(and(
                eq(billingRecords.tenantId, tenantId),
                eq(billingRecords.sessionId, quotaThreadId),
            ));
        expect(blockedBilling.length).toBe(0);

        const blockedAudit = await db.select()
            .from(auditEvents)
            .where(and(
                eq(auditEvents.tenantId, tenantId),
                eq(auditEvents.requestId, String(chatRes.headers['x-request-id'])),
                eq(auditEvents.action, 'quota.blocked'),
                eq(auditEvents.resourceType, 'thread'),
                eq(auditEvents.resourceId, quotaThreadId),
                eq(auditEvents.outcome, 'failure'),
            ));
        expect(blockedAudit.length).toBe(1);

        const blockedPolicy = await db.select()
            .from(policyDecisions)
            .where(and(
                eq(policyDecisions.tenantId, tenantId),
                eq(policyDecisions.requestId, String(chatRes.headers['x-request-id'])),
                eq(policyDecisions.policyType, 'quota'),
                eq(policyDecisions.subjectType, 'thread'),
                eq(policyDecisions.subjectId, quotaThreadId),
                eq(policyDecisions.decision, 'deny'),
            ));
        expect(blockedPolicy).toHaveLength(1);
        expect(blockedPolicy[0].reason).toBe('租户 token 配额不足');
    });
});
