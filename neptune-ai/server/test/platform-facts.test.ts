process.env.DATA_ROOT = `/tmp/neptune-platform-facts-${Date.now()}`;

import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import {and, eq} from 'drizzle-orm';
import {createTestApp, TEST_AGENT_TEMPLATE} from './setup';
import {db} from '../src/db';
import {
    agentTemplateVersions,
    artifacts,
    auditEvents,
    billingRecords,
    evidenceArtifacts,
    humanReviews,
    policyDecisions,
    runEvents,
    runs,
    toolInvocations,
} from '../src/db/schema';

async function createTestUser(app: FastifyInstance): Promise<{token: string; tenantId: string; userId: string}> {
    const suffix = Math.random().toString(36).slice(2, 8);
    const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
            tenantName: `Platform Facts ${suffix}`,
            name: `Platform Facts User ${suffix}`,
            email: `platform-facts-${suffix}@test.com`,
            password: 'password123',
        },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();

    return {
        token: body.accessToken,
        tenantId: body.user.tenantId,
        userId: body.user.id,
    };
}

describe('AgentOps platform facts', () => {
    let app: FastifyInstance;
    let previousEngineMode: string | undefined;
    let token: string;
    let tenantId: string;
    let userId: string;
    let agentId: string;
    let threadId: string;
    let otherToken: string;

    beforeAll(async () => {
        previousEngineMode = process.env.NEPTUNE_ENGINE_MODE;
        process.env.NEPTUNE_ENGINE_MODE = 'controlled';

        app = await createTestApp();
        const user = await createTestUser(app);
        token = user.token;
        tenantId = user.tenantId;
        userId = user.userId;

        const agentRes = await app.inject({
            method: 'POST',
            url: '/api/v1/agents',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                ...TEST_AGENT_TEMPLATE,
                name: `Platform Facts Agent ${Date.now()}`,
            },
        });
        expect(agentRes.statusCode).toBe(201);
        agentId = agentRes.json().id;

        const threadRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/threads`,
            headers: {authorization: `Bearer ${token}`},
            payload: {title: 'Platform facts'},
        });
        expect(threadRes.statusCode).toBe(201);
        threadId = threadRes.json().id;

        const otherUser = await createTestUser(app);
        otherToken = otherUser.token;
    });

    afterAll(async () => {
        if (previousEngineMode === undefined) {
            delete process.env.NEPTUNE_ENGINE_MODE;
        } else {
            process.env.NEPTUNE_ENGINE_MODE = previousEngineMode;
        }
        await app.close();
    });

    test('chat dispatch records agent version, run lifecycle, and audit events', async () => {
        const chatRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/threads/${threadId}/chat`,
            headers: {authorization: `Bearer ${token}`},
            payload: {content: 'record platform facts'},
        });

        expect(chatRes.statusCode).toBe(200);
        const requestId = String(chatRes.headers['x-request-id']);
        expect(requestId).toBeTruthy();

        const versionRows = await db
            .select()
            .from(agentTemplateVersions)
            .where(and(
                eq(agentTemplateVersions.tenantId, tenantId),
                eq(agentTemplateVersions.agentId, agentId),
                eq(agentTemplateVersions.version, 1),
            ));
        expect(versionRows).toHaveLength(1);
        expect(versionRows[0].snapshot).toMatchObject({
            name: expect.any(String),
            modelConfig: expect.any(Object),
        });

        const runRows = await db
            .select()
            .from(runs)
            .where(and(
                eq(runs.tenantId, tenantId),
                eq(runs.threadId, threadId),
                eq(runs.requestId, requestId),
            ));
        expect(runRows).toHaveLength(1);
        expect(runRows[0]).toMatchObject({
            userId,
            agentId,
            status: 'completed',
            inputTokens: expect.any(Number),
            outputTokens: expect.any(Number),
            model: 'neptune-controlled-model',
        });
        expect(runRows[0].agentVersionId).toBe(versionRows[0].id);
        expect(runRows[0].completedAt).toBeTruthy();

        const auditRows = await db
            .select()
            .from(auditEvents)
            .where(and(
                eq(auditEvents.tenantId, tenantId),
                eq(auditEvents.requestId, requestId),
            ));
        expect(auditRows.map(row => row.action)).toContain('run.started');
        expect(auditRows.map(row => row.action)).toContain('run.completed');
        expect(auditRows.every(row => row.userId === userId)).toBe(true);
    });

    test('governance APIs expose stable DTO lists with pagination and filtering', async () => {
        const runsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs?threadId=${threadId}&status=completed&limit=1&offset=0`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(runsRes.statusCode).toBe(200);
        const runsBody = runsRes.json();
        expect(runsBody.data).toHaveLength(1);
        expect(runsBody.data[0]).toMatchObject({
            id: expect.any(String),
            tenantId,
            userId,
            agentId,
            threadId,
            status: 'completed',
            model: 'neptune-controlled-model',
            inputTokens: expect.any(Number),
            outputTokens: expect.any(Number),
            startedAt: expect.any(String),
        });
        expect(runsBody.data[0].completedAt).toEqual(expect.any(String));
        expect(runsBody.data[0]).not.toHaveProperty('metadata');
        expect(runsBody.data[0]).not.toHaveProperty('error');
        expect(runsBody.meta).toMatchObject({
            count: expect.any(Number),
            limit: 1,
            offset: 0,
        });

        const versionsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/agents/${agentId}/versions`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(versionsRes.statusCode).toBe(200);
        const versionsBody = versionsRes.json();
        expect(versionsBody.data).toHaveLength(1);
        expect(versionsBody.data[0]).toMatchObject({
            id: expect.any(String),
            tenantId,
            agentId,
            version: 1,
            versionHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
            createdAt: expect.any(String),
            snapshotSummary: {
                name: expect.any(String),
                description: expect.any(String),
                modelProvider: expect.any(String),
                model: expect.any(String),
                toolCount: expect.any(Number),
                skillCount: expect.any(Number),
                mcpServerCount: expect.any(Number),
            },
        });
        expect(versionsBody.data[0]).not.toHaveProperty('snapshot');

        const auditRes = await app.inject({
            method: 'GET',
            url: '/api/v1/platform-facts/audit-events?action=run.completed&resourceType=run&outcome=success&limit=1',
            headers: {authorization: `Bearer ${token}`},
        });
        expect(auditRes.statusCode).toBe(200);
        const auditBody = auditRes.json();
        expect(auditBody.data).toHaveLength(1);
        expect(auditBody.data[0]).toMatchObject({
            id: expect.any(Number),
            tenantId,
            userId,
            action: 'run.completed',
            resourceType: 'run',
            outcome: 'success',
            createdAt: expect.any(String),
        });
        expect(auditBody.meta).toMatchObject({
            count: expect.any(Number),
            limit: 1,
            offset: 0,
        });
    });

    test('audit events can be filtered and exported as a tenant-scoped CSV audit action', async () => {
        const resourceId = `run-export-${Date.now()}`;
        const otherResourceId = `run-export-other-${Date.now()}`;
        await db.insert(auditEvents).values([
            {
                tenantId,
                userId,
                requestId: 'req-audit-export-1',
                action: 'run.completed',
                resourceType: 'run',
                resourceId,
                outcome: 'success',
                metadata: {secret: 'metadata secret should not leave csv'},
            },
            {
                tenantId,
                userId,
                requestId: 'req-audit-export-2',
                action: 'run.failed',
                resourceType: 'run',
                resourceId: otherResourceId,
                outcome: 'failure',
                metadata: {note: 'not part of filtered export'},
            },
        ]);

        const exportRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/audit-events/export?action=run.completed&resourceType=run&resourceId=${resourceId}&outcome=success`,
            headers: {authorization: `Bearer ${token}`},
        });

        expect(exportRes.statusCode).toBe(200);
        expect(String(exportRes.headers['content-type'])).toContain('text/csv');
        expect(String(exportRes.headers['content-disposition'])).toContain('neptune-audit-events');
        const csv = exportRes.body;
        expect(csv).toContain('id,createdAt,tenantId,userId,requestId,action,resourceType,resourceId,outcome');
        expect(csv).toContain(`req-audit-export-1,run.completed,run,${resourceId},success`);
        expect(csv).not.toContain('req-audit-export-2');
        expect(csv).not.toContain('metadata secret');

        const exportAuditRows = await db
            .select()
            .from(auditEvents)
            .where(and(
                eq(auditEvents.tenantId, tenantId),
                eq(auditEvents.action, 'audit_events.exported'),
                eq(auditEvents.resourceType, 'audit_events'),
            ));
        expect(exportAuditRows.length).toBeGreaterThanOrEqual(1);
        expect(exportAuditRows.some(row => row.userId === userId && row.outcome === 'success')).toBe(true);

        const otherExportRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/audit-events/export?action=run.completed&resourceType=run&resourceId=${resourceId}&outcome=success`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherExportRes.statusCode).toBe(200);
        expect(otherExportRes.body).toContain('id,createdAt,tenantId,userId,requestId,action,resourceType,resourceId,outcome');
        expect(otherExportRes.body).not.toContain(resourceId);
        expect(otherExportRes.body).not.toContain('req-audit-export-1');
    });

    test('run event and tool invocation facts are persisted and queryable', async () => {
        const [runRow] = await db
            .select()
            .from(runs)
            .where(and(
                eq(runs.tenantId, tenantId),
                eq(runs.threadId, threadId),
                eq(runs.status, 'completed'),
            ));
        expect(runRow).toBeTruthy();

        const eventRows = await db
            .select()
            .from(runEvents)
            .where(and(
                eq(runEvents.tenantId, tenantId),
                eq(runEvents.runId, runRow.id),
            ));
        expect(eventRows.map(row => row.eventType)).toContain('run.started');
        expect(eventRows.map(row => row.eventType)).toContain('tool.invocation.started');
        expect(eventRows.map(row => row.eventType)).toContain('tool.invocation.completed');
        expect(eventRows.map(row => row.eventType)).toContain('run.completed');

        const toolRows = await db
            .select()
            .from(toolInvocations)
            .where(and(
                eq(toolInvocations.tenantId, tenantId),
                eq(toolInvocations.runId, runRow.id),
            ));
        expect(toolRows).toHaveLength(1);
        expect(toolRows[0]).toMatchObject({
            toolName: 'E2EControlledTool',
            status: 'completed',
        });
        expect(toolRows[0].completedAt).toBeTruthy();

        const eventsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs/${runRow.id}/events?limit=100`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(eventsRes.statusCode).toBe(200);
        const eventsBody = eventsRes.json();
        expect(eventsBody.data.map((event: {eventType: string}) => event.eventType)).toContain('run.started');
        expect(eventsBody.data[0]).toMatchObject({
            tenantId,
            runId: runRow.id,
            eventType: expect.any(String),
            sequence: expect.any(Number),
            occurredAt: expect.any(String),
        });
        expect(eventsBody.data[0]).not.toHaveProperty('payload');

        const toolsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs/${runRow.id}/tool-invocations`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(toolsRes.statusCode).toBe(200);
        const toolsBody = toolsRes.json();
        expect(toolsBody.data).toHaveLength(1);
        expect(toolsBody.data[0]).toMatchObject({
            tenantId,
            runId: runRow.id,
            toolName: 'E2EControlledTool',
            status: 'completed',
            inputSummary: expect.any(Object),
            outputSummary: expect.any(Object),
        });
        expect(JSON.stringify(toolsBody.data[0])).not.toContain('secret');
    });

    test('policy decisions are persisted and queryable as platform facts', async () => {
        const [runRow] = await db
            .select()
            .from(runs)
            .where(and(
                eq(runs.tenantId, tenantId),
                eq(runs.threadId, threadId),
                eq(runs.status, 'completed'),
            ));
        expect(runRow).toBeTruthy();

        const decisionRows = await db
            .select()
            .from(policyDecisions)
            .where(and(
                eq(policyDecisions.tenantId, tenantId),
                eq(policyDecisions.runId, runRow.id),
            ));
        expect(decisionRows.map(row => row.policyType)).toContain('model');
        expect(decisionRows.map(row => row.policyType)).toContain('tool');
        expect(decisionRows.every(row => row.decision === 'allow')).toBe(true);

        const decisionsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/policy-decisions?runId=${runRow.id}&decision=allow&limit=50`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(decisionsRes.statusCode).toBe(200);
        const decisionsBody = decisionsRes.json();
        expect(decisionsBody.data.length).toBeGreaterThanOrEqual(2);
        expect(decisionsBody.data[0]).toMatchObject({
            tenantId,
            runId: runRow.id,
            requestId: expect.any(String),
            policyType: expect.any(String),
            subjectType: expect.any(String),
            subjectId: expect.any(String),
            decision: 'allow',
            reason: expect.any(String),
            detailsSummary: expect.any(Object),
            createdAt: expect.any(String),
        });
        expect(JSON.stringify(decisionsBody.data)).not.toContain('secret');
        expect(JSON.stringify(decisionsBody.data)).not.toContain('credential');
    });

    test('human reviews can be requested, listed, approved, audited, and protected by tenant', async () => {
        const reviewThreadRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/threads`,
            headers: {authorization: `Bearer ${token}`},
            payload: {title: 'Human review facts'},
        });
        expect(reviewThreadRes.statusCode).toBe(201);
        const reviewThreadId = reviewThreadRes.json().id;

        const chatRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/threads/${reviewThreadId}/chat`,
            headers: {authorization: `Bearer ${token}`},
            payload: {content: 'create human review run'},
        });
        expect(chatRes.statusCode).toBe(200);
        const requestId = String(chatRes.headers['x-request-id']);

        const [runRow] = await db
            .select()
            .from(runs)
            .where(and(
                eq(runs.tenantId, tenantId),
                eq(runs.threadId, reviewThreadId),
                eq(runs.requestId, requestId),
            ));
        expect(runRow).toBeTruthy();

        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/platform-facts/human-reviews',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                runId: runRow.id,
                requestId,
                reviewType: 'approval',
                subjectType: 'run',
                subjectId: runRow.id,
                title: 'Approve generated result',
                reason: 'High risk output requires explicit approval',
                metadataSummary: {
                    riskLevel: 'high',
                    secret: 'metadata secret',
                    token: 'metadata token',
                },
            },
        });
        expect(createRes.statusCode).toBe(201);
        const createdReview = createRes.json();
        expect(createdReview).toMatchObject({
            tenantId,
            runId: runRow.id,
            requestId,
            reviewType: 'approval',
            status: 'pending',
            subjectType: 'run',
            subjectId: runRow.id,
            title: 'Approve generated result',
            requestedBy: userId,
            decidedBy: null,
            decision: null,
            decidedAt: null,
            createdAt: expect.any(String),
        });

        const pendingRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/human-reviews?runId=${runRow.id}&status=pending&limit=10`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(pendingRes.statusCode).toBe(200);
        const pendingBody = pendingRes.json();
        expect(pendingBody.data).toHaveLength(1);
        expect(pendingBody.data[0]).toMatchObject({
            id: createdReview.id,
            tenantId,
            status: 'pending',
        });
        expect(pendingBody.meta).toMatchObject({
            count: 1,
            limit: 10,
            offset: 0,
        });

        const otherPendingRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/human-reviews?runId=${runRow.id}&status=pending`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherPendingRes.statusCode).toBe(200);
        expect(otherPendingRes.json()).toMatchObject({
            data: [],
            meta: {
                count: 0,
                offset: 0,
            },
        });

        const otherDecisionRes = await app.inject({
            method: 'POST',
            url: `/api/v1/platform-facts/human-reviews/${createdReview.id}/decision`,
            headers: {authorization: `Bearer ${otherToken}`},
            payload: {
                decision: 'approve',
                reason: 'other tenant cannot decide',
            },
        });
        expect(otherDecisionRes.statusCode).toBe(404);
        expect(otherDecisionRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应复核项，或你没有权限访问。',
        });

        const approveRes = await app.inject({
            method: 'POST',
            url: `/api/v1/platform-facts/human-reviews/${createdReview.id}/decision`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                decision: 'approve',
                reason: 'Evidence is sufficient',
                decisionSummary: {
                    visibleNote: 'approved after checking evidence',
                    secret: 'decision secret',
                    token: 'decision token',
                    credential: 'decision credential',
                },
            },
        });
        expect(approveRes.statusCode).toBe(200);
        const approvedReview = approveRes.json();
        expect(approvedReview).toMatchObject({
            id: createdReview.id,
            tenantId,
            runId: runRow.id,
            status: 'approved',
            decision: 'approve',
            decisionReason: 'Evidence is sufficient',
            decidedBy: userId,
            decidedAt: expect.any(String),
            decisionSummary: {
                visibleNote: 'approved after checking evidence',
                secret: '[redacted]',
                token: '[redacted]',
                credential: '[redacted]',
            },
        });
        const serializedDecisionSummary = JSON.stringify(approvedReview.decisionSummary);
        expect(serializedDecisionSummary).not.toContain('decision secret');
        expect(serializedDecisionSummary).not.toContain('decision token');
        expect(serializedDecisionSummary).not.toContain('decision credential');

        const [reviewRow] = await db
            .select()
            .from(humanReviews)
            .where(and(
                eq(humanReviews.tenantId, tenantId),
                eq(humanReviews.id, createdReview.id),
            ));
        expect(reviewRow).toMatchObject({
            status: 'approved',
            decision: 'approve',
            decisionReason: 'Evidence is sufficient',
            decidedBy: userId,
        });
        expect(reviewRow.decidedAt).toBeTruthy();

        const reviewAuditRows = await db
            .select()
            .from(auditEvents)
            .where(and(
                eq(auditEvents.tenantId, tenantId),
                eq(auditEvents.resourceType, 'human_review'),
                eq(auditEvents.resourceId, createdReview.id),
            ));
        const reviewAuditActions = reviewAuditRows.map(row => row.action);
        expect(reviewAuditActions).toContain('human_review.requested');
        expect(reviewAuditActions).toContain('human_review.approved');
        expect(reviewAuditRows.every(row => row.userId === userId)).toBe(true);

        const duplicateDecisionRes = await app.inject({
            method: 'POST',
            url: `/api/v1/platform-facts/human-reviews/${createdReview.id}/decision`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                decision: 'approve',
                reason: 'duplicate approval',
            },
        });
        expect(duplicateDecisionRes.statusCode).toBe(409);
        expect(duplicateDecisionRes.json()).toMatchObject({
            error: 'STATE_CONFLICT',
            message: '该复核项已经处理，不能重复决策。',
        });
    });

    test('human reviews support waiver decisions as platform facts', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/platform-facts/human-reviews',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                reviewType: 'waiver',
                subjectType: 'policy_exception',
                subjectId: `policy-exception-${Date.now()}`,
                title: 'Waive low impact exception',
                reason: 'Temporary low impact exception needs a human waiver',
            },
        });
        expect(createRes.statusCode).toBe(201);
        const reviewId = createRes.json().id;

        const waiveRes = await app.inject({
            method: 'POST',
            url: `/api/v1/platform-facts/human-reviews/${reviewId}/decision`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                decision: 'waive',
                reason: 'Accepted under temporary policy exception',
            },
        });
        expect(waiveRes.statusCode).toBe(200);
        expect(waiveRes.json()).toMatchObject({
            id: reviewId,
            tenantId,
            reviewType: 'waiver',
            status: 'waived',
            decision: 'waive',
            decisionReason: 'Accepted under temporary policy exception',
            decidedBy: userId,
            decidedAt: expect.any(String),
        });

        const reviewAuditRows = await db
            .select()
            .from(auditEvents)
            .where(and(
                eq(auditEvents.tenantId, tenantId),
                eq(auditEvents.resourceType, 'human_review'),
                eq(auditEvents.resourceId, reviewId),
            ));
        expect(reviewAuditRows.map(row => row.action)).toContain('human_review.waived');
    });

    test('artifact, evidence, and cost summary are queryable as platform facts', async () => {
        const artifactThreadRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/threads`,
            headers: {authorization: `Bearer ${token}`},
            payload: {title: 'Artifact facts'},
        });
        expect(artifactThreadRes.statusCode).toBe(201);
        const artifactThreadId = artifactThreadRes.json().id;

        const chatRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/threads/${artifactThreadId}/chat`,
            headers: {authorization: `Bearer ${token}`},
            payload: {content: 'advanced workflow should create artifact facts'},
        });
        expect(chatRes.statusCode).toBe(200);
        const requestId = String(chatRes.headers['x-request-id']);

        const [runRow] = await db
            .select()
            .from(runs)
            .where(and(
                eq(runs.tenantId, tenantId),
                eq(runs.threadId, artifactThreadId),
                eq(runs.requestId, requestId),
            ));
        expect(runRow).toBeTruthy();

        const artifactRows = await db
            .select()
            .from(artifacts)
            .where(and(
                eq(artifacts.tenantId, tenantId),
                eq(artifacts.runId, runRow.id),
            ));
        expect(artifactRows).toHaveLength(1);
        expect(artifactRows[0]).toMatchObject({
            title: 'workflow-summary.md',
            artifactType: 'file',
            sourceType: 'runtime_tool',
            storageUri: 'workspace:///tmp/workflow-summary.md',
            requestId,
        });
        expect(artifactRows[0].sha256).toEqual(expect.any(String));
        expect(artifactRows[0].sizeBytes).toBeGreaterThan(0);

        const evidenceRows = await db
            .select()
            .from(evidenceArtifacts)
            .where(and(
                eq(evidenceArtifacts.tenantId, tenantId),
                eq(evidenceArtifacts.runId, runRow.id),
            ));
        expect(evidenceRows).toHaveLength(1);
        expect(evidenceRows[0]).toMatchObject({
            artifactId: artifactRows[0].id,
            evidenceType: 'generated_extract',
            sourceSystem: 'runtime_tool',
            sourceHash: artifactRows[0].sha256,
            requestId,
        });

        const artifactsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs/${runRow.id}/artifacts`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(artifactsRes.statusCode).toBe(200);
        const artifactsBody = artifactsRes.json();
        expect(artifactsBody.data).toHaveLength(1);
        expect(artifactsBody.data[0]).toMatchObject({
            tenantId,
            runId: runRow.id,
            requestId,
            title: 'workflow-summary.md',
            artifactType: 'file',
            sourceType: 'runtime_tool',
            storageUri: 'workspace:///tmp/workflow-summary.md',
            sha256: expect.any(String),
            createdAt: expect.any(String),
        });
        expect(artifactsBody.data[0]).not.toHaveProperty('content');
        expect(JSON.stringify(artifactsBody.data)).not.toContain('source prompt');
        expect(JSON.stringify(artifactsBody.data)).not.toContain('secret');

        const evidenceRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs/${runRow.id}/evidence-artifacts`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(evidenceRes.statusCode).toBe(200);
        const evidenceBody = evidenceRes.json();
        expect(evidenceBody.data).toHaveLength(1);
        expect(evidenceBody.data[0]).toMatchObject({
            tenantId,
            artifactId: artifactRows[0].id,
            runId: runRow.id,
            evidenceType: 'generated_extract',
            sourceSystem: 'runtime_tool',
            sourceHash: artifactRows[0].sha256,
            createdAt: expect.any(String),
        });
        expect(JSON.stringify(evidenceBody.data)).not.toContain('source prompt');

        const costRes = await app.inject({
            method: 'GET',
            url: '/api/v1/platform-facts/cost-summary?period=all_time',
            headers: {authorization: `Bearer ${token}`},
        });
        expect(costRes.statusCode).toBe(200);
        const costBody = costRes.json();
        const recordCount = Number(costBody.recordCount);
        expect(recordCount).toBeGreaterThanOrEqual(1);
        expect(Number(costBody.totalTokens)).toBe(Number(costBody.totalInputTokens) + Number(costBody.totalOutputTokens));
        expect(costBody.byModel.some((row: {model: string | null}) => row.model === 'neptune-controlled-model')).toBe(true);
        expect(costBody).toMatchObject({
            tenantId,
            period: 'all_time',
            totalInputTokens: expect.any(Number),
            totalOutputTokens: expect.any(Number),
            totalTokens: expect.any(Number),
            totalCostCents: expect.any(Number),
            recordCount: expect.any(Number),
            quota: {
                maxTokensPerDay: expect.any(Number),
                maxConcurrentSessions: expect.any(Number),
            },
            quotaUsage: {
                totalTokensToday: expect.any(Number),
                runningSessions: expect.any(Number),
            },
            byModel: expect.any(Array),
            updatedAt: expect.any(String),
        });

        const billingRows = await db
            .select()
            .from(billingRecords)
            .where(and(
                eq(billingRecords.tenantId, tenantId),
                eq(billingRecords.sessionId, artifactThreadId),
            ));
        expect(billingRows.length).toBeGreaterThanOrEqual(1);
    });

    test('governance APIs do not leak facts across tenants', async () => {
        const runsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/runs?threadId=${threadId}`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(runsRes.statusCode).toBe(200);
        expect(runsRes.json()).toMatchObject({
            data: [],
            meta: {
                count: 0,
                offset: 0,
            },
        });

        const versionsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/agents/${agentId}/versions`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(versionsRes.statusCode).toBe(200);
        expect(versionsRes.json()).toMatchObject({
            data: [],
            meta: {
                count: 0,
                offset: 0,
            },
        });

        const [runRow] = await db
            .select()
            .from(runs)
            .where(and(
                eq(runs.tenantId, tenantId),
                eq(runs.threadId, threadId),
            ));
        expect(runRow).toBeTruthy();

        const eventsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs/${runRow.id}/events`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(eventsRes.statusCode).toBe(404);
        expect(eventsRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应运行记录，或你没有权限访问。',
        });

        const toolsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs/${runRow.id}/tool-invocations`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(toolsRes.statusCode).toBe(404);
        expect(toolsRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应运行记录，或你没有权限访问。',
        });

        const decisionsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/policy-decisions?runId=${runRow.id}`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(decisionsRes.statusCode).toBe(200);
        expect(decisionsRes.json()).toMatchObject({
            data: [],
            meta: {
                count: 0,
                offset: 0,
            },
        });

        const artifactsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs/${runRow.id}/artifacts`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(artifactsRes.statusCode).toBe(404);
        expect(artifactsRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应运行记录，或你没有权限访问。',
        });

        const evidenceRes = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs/${runRow.id}/evidence-artifacts`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(evidenceRes.statusCode).toBe(404);
        expect(evidenceRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应运行记录，或你没有权限访问。',
        });
    });

    test('agent version DTO exposes only redacted snapshot summary', async () => {
        const [versionRow] = await db
            .select()
            .from(agentTemplateVersions)
            .where(and(
                eq(agentTemplateVersions.tenantId, tenantId),
                eq(agentTemplateVersions.agentId, agentId),
                eq(agentTemplateVersions.version, 1),
            ));
        expect(versionRow).toBeTruthy();

        await db.update(agentTemplateVersions)
            .set({
                snapshot: {
                    ...versionRow.snapshot,
                    systemPrompt: 'secret system prompt',
                    credential: 'secret credential',
                    apiCredential: {token: 'secret token'},
                    mcpServers: [{
                        name: 'secure-mcp',
                        url: 'https://mcp.example.com',
                        authConfig: {token: 'secret auth token'},
                        credential: 'secret mcp credential',
                    }],
                },
            })
            .where(eq(agentTemplateVersions.id, versionRow.id));

        const versionsRes = await app.inject({
            method: 'GET',
            url: `/api/v1/agents/${agentId}/versions`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(versionsRes.statusCode).toBe(200);
        const versionDto = versionsRes.json().data[0];
        const serialized = JSON.stringify(versionDto);

        expect(versionDto.snapshotSummary).toMatchObject({
            name: expect.any(String),
            mcpServerCount: 1,
        });
        expect(versionDto.versionHash).toEqual(expect.stringMatching(/^sha256:[a-f0-9]{64}$/));
        expect(serialized).not.toContain('secret system prompt');
        expect(serialized).not.toContain('secret credential');
        expect(serialized).not.toContain('secret token');
        expect(serialized).not.toContain('authConfig');
        expect(serialized).not.toContain('credential');
    });
});
