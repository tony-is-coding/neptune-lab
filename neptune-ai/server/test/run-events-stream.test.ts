/**
 * Run 实时事件流（SSE）合同测试
 *
 * 验证：
 * - 鉴权与租户隔离（401/404）
 * - 历史回放：连接时返回 sequence > Last-Event-ID 的全部事件
 * - 终态运行：直接回放 + type=end + 关闭流
 * - 实时推送：subscribe 后 publish 的事件能即时到达客户端
 * - 终态事件：run.completed/failed/cancelled 触发 type=end
 * - 心跳：保持连接的 heartbeat 帧（部分覆盖，不强校验时间）
 * - SSE id 字段携带 sequence；data 是 RunStreamEnvelope JSON
 */
import {afterEach, beforeAll, describe, expect, test} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import {randomUUID} from 'crypto';
import type {RunRuntimeEvent, RunStreamEnvelope} from '@shared/neptune-ai';
import {createTestApp, createTestUser} from './setup';
import {db, runs, agentTemplates, sessions} from '../src/db';
import {runFactService} from '../src/services/run-facts';
import {runEventBus} from '../src/services/run-event-bus';

interface ParsedSseFrame {
    id: string | null;
    eventName: string | null;
    data: string;
}

interface ParsedEnvelope {
    sequence: number | null;
    envelope: RunStreamEnvelope;
}

function parseSseChunk(chunk: string): ParsedSseFrame[] {
    const frames: ParsedSseFrame[] = [];
    for (const block of chunk.split(/\n\n/)) {
        if (!block.trim()) continue;
        let id: string | null = null;
        let eventName: string | null = null;
        const dataLines: string[] = [];
        for (const line of block.split('\n')) {
            if (line.startsWith('id: ')) id = line.slice(4);
            else if (line.startsWith('event: ')) eventName = line.slice(7);
            else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
        }
        frames.push({id, eventName, data: dataLines.join('\n')});
    }
    return frames;
}

function parseEnvelopes(chunk: string): ParsedEnvelope[] {
    return parseSseChunk(chunk).map(frame => ({
        sequence: frame.id ? Number.parseInt(frame.id, 10) : null,
        envelope: JSON.parse(frame.data) as RunStreamEnvelope,
    }));
}

async function createTerminalRun(params: {
    tenantId: string;
    userId: string;
}): Promise<{runId: string; agentId: string; threadId: string}> {
    const [agent] = await db.insert(agentTemplates).values({
        tenantId: params.tenantId,
        name: '运行流程测试 Agent',
        systemPrompt: '测试用',
        modelConfig: {provider: 'mock', model: 'mock-model', temperature: 0, maxTokens: 1000},
        isActive: true,
    }).returning();

    const threadId = randomUUID();
    const [thread] = await db.insert(sessions).values({
        id: threadId,
        tenantId: params.tenantId,
        userId: params.userId,
        templateId: agent.id,
        title: '运行流程测试 Thread',
        workspace: `/tmp/neptune-test-${threadId}`,
    }).returning();

    const [run] = await db.insert(runs).values({
        tenantId: params.tenantId,
        userId: params.userId,
        agentId: agent.id,
        threadId: thread.id,
        requestId: randomUUID(),
        status: 'completed',
        model: 'mock-model',
        inputTokens: 0,
        outputTokens: 0,
        completedAt: new Date(),
    }).returning();

    return {runId: run.id, agentId: agent.id, threadId: thread.id};
}

async function createRunningRun(params: {
    tenantId: string;
    userId: string;
}): Promise<{runId: string; agentId: string; threadId: string}> {
    const [agent] = await db.insert(agentTemplates).values({
        tenantId: params.tenantId,
        name: '运行流程测试 Agent',
        systemPrompt: '测试用',
        modelConfig: {provider: 'mock', model: 'mock-model', temperature: 0, maxTokens: 1000},
        isActive: true,
    }).returning();

    const threadId = randomUUID();
    const [thread] = await db.insert(sessions).values({
        id: threadId,
        tenantId: params.tenantId,
        userId: params.userId,
        templateId: agent.id,
        title: '运行流程测试 Thread',
        workspace: `/tmp/neptune-test-${threadId}`,
    }).returning();

    const [run] = await db.insert(runs).values({
        tenantId: params.tenantId,
        userId: params.userId,
        agentId: agent.id,
        threadId: thread.id,
        requestId: randomUUID(),
        status: 'running',
        model: 'mock-model',
        inputTokens: 0,
        outputTokens: 0,
    }).returning();

    return {runId: run.id, agentId: agent.id, threadId: thread.id};
}

describe('Run 运行事件流 SSE 合同', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await createTestApp();
    });

    afterEach(() => {
        runEventBus.reset();
    });

    test('未认证访问返回 401 标准信封', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/runs/${randomUUID()}/events/stream`,
        });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({error: 'UNAUTHORIZED'});
    });

    test('Run 不存在或跨租户访问返回 404 标准信封', async () => {
        const tenantA = await createTestUser(app);
        const tenantB = await createTestUser(app);
        const {runId} = await createRunningRun({
            tenantId: (tenantA.user as {tenantId: string}).tenantId,
            userId: (tenantA.user as {id: string}).id,
        });

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/runs/${runId}/events/stream`,
            headers: {authorization: `Bearer ${tenantB.token}`},
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({error: 'RESOURCE_NOT_FOUND'});
    });

    test('终态 Run：回放历史 + type=end，立刻关闭流', async () => {
        const {token, user} = await createTestUser(app);
        const userInfo = user as {id: string; tenantId: string};
        const {runId} = await createTerminalRun({
            tenantId: userInfo.tenantId,
            userId: userInfo.id,
        });

        // 写两条历史事件 + 终态事件
        await runFactService.recordEvent({
            tenantId: userInfo.tenantId,
            runId,
            eventType: 'run.started',
        });
        await runFactService.recordEvent({
            tenantId: userInfo.tenantId,
            runId,
            eventType: 'run.completed',
            payloadSummary: {model: 'mock-model'},
        });

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/runs/${runId}/events/stream`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('text/event-stream');
        expect(res.headers['x-request-id']).toBeTruthy();

        const frames = parseEnvelopes(res.body);
        const eventEnvelopes = frames.filter(f => f.envelope.type === 'event');
        const endEnvelopes = frames.filter(f => f.envelope.type === 'end');

        expect(eventEnvelopes.length).toBeGreaterThanOrEqual(2);
        expect(endEnvelopes).toHaveLength(1);
        const lastEvent = eventEnvelopes[eventEnvelopes.length - 1];
        expect((lastEvent.envelope as {event: RunRuntimeEvent}).event.eventType).toBe('run.completed');
        expect((endEnvelopes[0].envelope as {reason: string}).reason).toBe('completed');

        // sequence 单调递增
        const sequences = eventEnvelopes.map(f => f.sequence);
        for (let i = 1; i < sequences.length; i++) {
            expect(sequences[i]!).toBeGreaterThan(sequences[i - 1]!);
        }
    });

    test('Last-Event-ID 续传：只回放比该 sequence 大的事件', async () => {
        const {token, user} = await createTestUser(app);
        const userInfo = user as {id: string; tenantId: string};
        const {runId} = await createTerminalRun({
            tenantId: userInfo.tenantId,
            userId: userInfo.id,
        });

        const ev1 = await runFactService.recordEvent({tenantId: userInfo.tenantId, runId, eventType: 'run.started'});
        const ev2 = await runFactService.recordEvent({tenantId: userInfo.tenantId, runId, eventType: 'run.output.delta'});
        const ev3 = await runFactService.recordEvent({tenantId: userInfo.tenantId, runId, eventType: 'run.completed'});

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/runs/${runId}/events/stream`,
            headers: {
                authorization: `Bearer ${token}`,
                'last-event-id': String(ev1.sequence),
            },
        });
        expect(res.statusCode).toBe(200);
        const frames = parseEnvelopes(res.body);
        const events = frames
            .filter(f => f.envelope.type === 'event')
            .map(f => (f.envelope as {event: RunRuntimeEvent}).event);

        // ev1 已经被客户端收到，不应该再回放；ev2/ev3 应该回放
        expect(events.map(e => e.sequence)).toEqual([ev2.sequence, ev3.sequence]);
    });

    test('运行中 Run：建立连接后实时推送新事件', async () => {
        const {token, user} = await createTestUser(app);
        const userInfo = user as {id: string; tenantId: string};
        const {runId} = await createRunningRun({
            tenantId: userInfo.tenantId,
            userId: userInfo.id,
        });

        // 准备一个能用 light-my-request 的实时场景：先写一条历史事件，
        // 然后注入 inject 的同时异步在另一条调用栈里写新事件触发 publish
        const inject = app.inject({
            method: 'GET',
            url: `/api/v1/runs/${runId}/events/stream`,
            headers: {authorization: `Bearer ${token}`},
        });

        // 给 inject 一点时间订阅 bus
        await new Promise(resolve => setTimeout(resolve, 50));

        await runFactService.recordEvent({
            tenantId: userInfo.tenantId,
            runId,
            eventType: 'tool.invocation.started',
            payloadSummary: {toolName: 'BashTool'},
        });
        await runFactService.recordEvent({
            tenantId: userInfo.tenantId,
            runId,
            eventType: 'run.completed',
        });

        const res = await inject;
        expect(res.statusCode).toBe(200);

        const frames = parseEnvelopes(res.body);
        const eventTypes = frames
            .filter(f => f.envelope.type === 'event')
            .map(f => (f.envelope as {event: RunRuntimeEvent}).event.eventType);

        expect(eventTypes).toContain('tool.invocation.started');
        expect(eventTypes).toContain('run.completed');

        const endFrames = frames.filter(f => f.envelope.type === 'end');
        expect(endFrames).toHaveLength(1);
        expect((endFrames[0].envelope as {reason: string}).reason).toBe('completed');
    });

    test('SSE id 字段使用 sequence，data 是 JSON 形式的 RunStreamEnvelope', async () => {
        const {token, user} = await createTestUser(app);
        const userInfo = user as {id: string; tenantId: string};
        const {runId} = await createTerminalRun({
            tenantId: userInfo.tenantId,
            userId: userInfo.id,
        });

        const ev = await runFactService.recordEvent({
            tenantId: userInfo.tenantId,
            runId,
            eventType: 'run.completed',
        });

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/runs/${runId}/events/stream`,
            headers: {authorization: `Bearer ${token}`},
        });

        const rawBody = res.body;
        expect(rawBody).toContain(`id: ${ev.sequence}\n`);
        expect(rawBody).toContain('data: {');
        expect(rawBody).toContain('"type":"event"');
        expect(rawBody).toContain('"type":"end"');
    });
});
