import {describe, expect, test} from 'bun:test';
import type {ChatConnectedEvent, ChatDoneEvent, ChatErrorEvent} from '../../../shared/types/neptune-ai';
import {createTestApp} from './setup';
import {createApiErrorEnvelope} from '../src/utils/api-error';
import {mapSSEEvent} from '../src/services/sse-event-mapper';

describe('chat request context contract', () => {
    test('connected done and error events carry requestId', () => {
        const connected: ChatConnectedEvent = {
            type: 'connected',
            requestId: 'req_123',
            threadId: 'thread_1',
            timestamp: 1,
        };
        const done: ChatDoneEvent = {
            type: 'done',
            requestId: 'req_123',
            usage: {},
        };
        const error: ChatErrorEvent = {
            type: 'error',
            error: 'QUERY_ERROR',
            message: 'failed',
            requestId: 'req_123',
        };

        expect(connected.requestId).toBe(done.requestId);
        expect(error.requestId).toBe(done.requestId);
    });

    test('REST responses expose request id in header and auth error body', async () => {
        const app = await createTestApp();
        const requestId = 'req-test-rest-context';

        try {
            const unauthorized = await app.inject({
                method: 'GET',
                url: '/api/v1/agents',
                headers: {'x-request-id': requestId},
            });

            expect(unauthorized.statusCode).toBe(401);
            expect(unauthorized.headers['x-request-id']).toBe(requestId);
            expect(unauthorized.json()).toMatchObject({
                error: 'UNAUTHORIZED',
                requestId,
                details: {},
            });
            expect(typeof unauthorized.json().message).toBe('string');
            expect(unauthorized.json().message.length).toBeGreaterThan(0);

            const health = await app.inject({
                method: 'GET',
                url: '/health',
            });

            expect(health.statusCode).toBe(200);
            expect(health.headers['x-request-id']).toBeTruthy();
        } finally {
            await app.close();
        }
    });

    test('REST error envelope is normalized for user-facing message and details', () => {
        expect(createApiErrorEnvelope({
            error: 'QUOTA_EXCEEDED',
            message: '租户配额不足',
            requestId: 'req-quota',
        })).toEqual({
            error: 'QUOTA_EXCEEDED',
            message: '租户配额不足',
            requestId: 'req-quota',
            details: {},
        });
    });

    test('SSE engine error maps to stable error envelope fields', () => {
        const [event] = mapSSEEvent({
            type: 'error',
            error: {code: 'QUOTA_EXCEEDED', message: '租户配额不足'},
            requestId: 'req-sse-error',
        });

        expect(event).toEqual({
            type: 'error',
            error: 'QUOTA_EXCEEDED',
            message: '租户配额不足',
            requestId: 'req-sse-error',
            details: {},
        });
    });
});
