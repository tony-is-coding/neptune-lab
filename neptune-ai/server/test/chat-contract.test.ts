import {describe, expect, test} from 'bun:test';
import {mapSSEEvent} from '../src/services/sse-event-mapper';
import type {ChatStreamEvent} from '../../../shared/types/neptune-ai';

function assertChatEvent(event: ChatStreamEvent): ChatStreamEvent {
    return event;
}

describe('chat contract', () => {
    test('maps text delta to shared text event', () => {
        const [event] = mapSSEEvent({
            type: 'stream_event',
            event: {
                type: 'content_block_delta',
                delta: {type: 'text_delta', text: 'hello'},
            },
        });

        const typed = assertChatEvent(event);
        expect(typed.type).toBe('text');
        if (typed.type === 'text') {
            expect(typed.content).toBe('hello');
            expect(typed.isDelta).toBe(true);
        }
    });

    test('maps tool result error to shared tool status error', () => {
        const events = mapSSEEvent({
            type: 'tool_result',
            toolUseId: 'tool-1',
            output: {message: 'denied'},
            isError: true,
        });

        expect(events.some(event => event.type === 'tool_result')).toBe(true);
        expect(events).toContainEqual({
            type: 'tool_status',
            id: 'tool-1',
            status: 'error',
        });
    });

    test('accepts artifact as shared chat event', () => {
        const event: ChatStreamEvent = {
            type: 'artifact',
            id: 'artifact-1',
            title: 'report.md',
            fileType: '.md',
            content: '# Report',
        };

        expect(event.type).toBe('artifact');
    });
});
