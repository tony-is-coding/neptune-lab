process.env.DATA_ROOT = `/tmp/neptune-run-observability-${Date.now()}`;

import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import {createTestApp} from './setup';
import {db} from '../src/db';
import {
    agentTemplates,
    agentTemplateVersions,
    artifacts,
    auditEvents,
    evidenceArtifacts,
    policyDecisions,
    runEvents,
    runs,
    sessions,
    tenants,
    toolInvocations,
    users,
} from '../src/db/schema';

async function registerUser(app: FastifyInstance, label: string): Promise<{token: string; tenantId: string; userId: string}> {
    const suffix = `${label}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
            tenantName: `观测租户 ${suffix}`,
            name: `观测用户 ${suffix}`,
            email: `observability-${suffix}@test.com`,
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

async function seedRunFacts(input: {
    tenantId: string;
    userId: string;
    requestId: string;
}) {
    const [agent] = await db.insert(agentTemplates).values({
        tenantId: input.tenantId,
        name: '观测智能体',
        description: '用于验证运行观测关联。',
        systemPrompt: '你是观测测试智能体。',
        modelConfig: {
            provider: 'controlled',
            model: 'neptune-controlled-model',
            temperature: 0,
            maxTokens: 512,
        },
        tools: ['ledger.check'],
        skills: [{id: 'skill-observe', name: '观测技能', version: '1.0.0'}],
        mcpServers: [{name: 'erp-snapshot', url: 'http://localhost/mcp'}],
    }).returning();

    const [version] = await db.insert(agentTemplateVersions).values({
        tenantId: input.tenantId,
        agentId: agent.id,
        version: 1,
        createdBy: input.userId,
        snapshot: {
            name: agent.name,
            description: agent.description,
            modelConfig: agent.modelConfig,
            tools: agent.tools,
            skills: agent.skills,
            mcpServers: agent.mcpServers,
        },
    }).returning();

    const threadId = `observability-thread-${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(sessions).values({
        id: threadId,
        tenantId: input.tenantId,
        userId: input.userId,
        templateId: agent.id,
        status: 'idle',
        title: '观测线程',
        workspace: `/tmp/neptune/observability/${threadId}`,
    });

    const startedAt = new Date('2026-05-22T08:00:00.000Z');
    const completedAt = new Date('2026-05-22T08:00:03.250Z');
    const [run] = await db.insert(runs).values({
        tenantId: input.tenantId,
        userId: input.userId,
        agentId: agent.id,
        agentVersionId: version.id,
        threadId,
        requestId: input.requestId,
        status: 'completed',
        model: 'neptune-controlled-model',
        inputTokens: 11,
        outputTokens: 22,
        metadata: {durationMs: 3250},
        startedAt,
        completedAt,
    }).returning();

    await db.insert(runEvents).values([
        {
            tenantId: input.tenantId,
            runId: run.id,
            eventType: 'run.started',
            sequence: 1,
            requestId: input.requestId,
            payloadSummary: {threadId},
        },
        {
            tenantId: input.tenantId,
            runId: run.id,
            eventType: 'run.completed',
            sequence: 2,
            requestId: input.requestId,
            payloadSummary: {durationMs: 3250, model: 'neptune-controlled-model'},
        },
    ]);

    await db.insert(toolInvocations).values({
        tenantId: input.tenantId,
        runId: run.id,
        toolUseId: 'tool-use-observe',
        toolName: 'ledger.check',
        status: 'completed',
        requestId: input.requestId,
        inputSummary: {scope: 'period'},
        outputSummary: {findingCount: 1},
        completedAt,
    });

    const [artifact] = await db.insert(artifacts).values({
        tenantId: input.tenantId,
        runId: run.id,
        requestId: input.requestId,
        artifactType: 'report',
        title: '观测报告',
        mimeType: 'application/json',
        sha256: 'sha256-observability-report',
        storageUri: 'memory://observability-report',
        sourceType: 'generated_report',
        createdBy: input.userId,
        metadataSummary: {source: 'test'},
    }).returning();

    await db.insert(evidenceArtifacts).values({
        tenantId: input.tenantId,
        artifactId: artifact.id,
        runId: run.id,
        requestId: input.requestId,
        evidenceType: 'runtime_observation',
        sourceSystem: 'controlled-engine',
        sourceHash: 'sha256-observability-evidence',
        importedBy: input.userId,
        metadataSummary: {trace: 'internal'},
    });

    await db.insert(policyDecisions).values({
        tenantId: input.tenantId,
        runId: run.id,
        requestId: input.requestId,
        policyType: 'model',
        subjectType: 'model',
        subjectId: 'neptune-controlled-model',
        decision: 'allow',
        reason: '模型策略预检通过',
        detailsSummary: {provider: 'controlled'},
    });

    await db.insert(auditEvents).values([
        {
            tenantId: input.tenantId,
            userId: input.userId,
            requestId: input.requestId,
            action: 'run.started',
            resourceType: 'run',
            resourceId: run.id,
            metadata: {agentVersionId: version.id},
        },
        {
            tenantId: input.tenantId,
            userId: input.userId,
            requestId: input.requestId,
            action: 'run.completed',
            resourceType: 'run',
            resourceId: run.id,
            metadata: {durationMs: 3250},
        },
    ]);

    return {runId: run.id, threadId, agentId: agent.id, agentVersionId: version.id};
}

describe('Run observability platform facts', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await createTestApp();
    });

    afterAll(async () => {
        await app.close();
    });

    test('returns stable observability links for a run without leaking snapshot internals', async () => {
        const user = await registerUser(app, 'owner');
        const seeded = await seedRunFacts({
            tenantId: user.tenantId,
            userId: user.userId,
            requestId: 'req-observability-owner',
        });

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs/${seeded.runId}/observability`,
            headers: {authorization: `Bearer ${user.token}`},
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({
            tenantId: user.tenantId,
            runId: seeded.runId,
            requestId: 'req-observability-owner',
            threadId: seeded.threadId,
            agentId: seeded.agentId,
            agentVersionId: seeded.agentVersionId,
            status: 'completed',
            model: 'neptune-controlled-model',
            durationMs: 3250,
            tokenUsage: {
                inputTokens: 11,
                outputTokens: 22,
                totalTokens: 33,
            },
            factCounts: {
                events: 2,
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
                version: 1,
                versionHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
                snapshotSummary: {
                    name: '观测智能体',
                    modelProvider: 'controlled',
                    model: 'neptune-controlled-model',
                    toolCount: 1,
                    skillCount: 1,
                    mcpServerCount: 1,
                },
            },
            updatedAt: expect.any(String),
        });

        expect(JSON.stringify(res.json())).not.toContain('systemPrompt');
        expect(JSON.stringify(res.json())).not.toContain('你是观测测试智能体');
    });

    test('does not expose run observability links across tenants', async () => {
        const owner = await registerUser(app, 'tenant-a');
        const other = await registerUser(app, 'tenant-b');
        const seeded = await seedRunFacts({
            tenantId: owner.tenantId,
            userId: owner.userId,
            requestId: 'req-observability-cross-tenant',
        });

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/platform-facts/runs/${seeded.runId}/observability`,
            headers: {authorization: `Bearer ${other.token}`},
        });

        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应运行记录，或你没有权限访问。',
        });
    });
});
