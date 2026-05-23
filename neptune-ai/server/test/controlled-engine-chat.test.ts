process.env.DATA_ROOT = `/tmp/neptune-controlled-chat-${Date.now()}`;

import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import {createTestApp, TEST_AGENT_TEMPLATE} from './setup';

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
    let agentId: string;
    let threadId: string;

    beforeAll(async () => {
        previousEngineMode = process.env.NEPTUNE_ENGINE_MODE;
        process.env.NEPTUNE_ENGINE_MODE = 'controlled';

        app = await createTestApp();
        const user = await createTestUser(app);
        token = user.token;

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
    });
});
