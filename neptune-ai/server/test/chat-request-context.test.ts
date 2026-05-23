import {describe, expect, test} from 'bun:test';
import type {ChatConnectedEvent, ChatDoneEvent, ChatErrorEvent} from '../../../shared/types/neptune-ai';

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
});
