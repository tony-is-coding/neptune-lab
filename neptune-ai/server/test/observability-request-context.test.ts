import {describe, expect, test} from 'bun:test';
import {LangfuseTracingProvider} from '../src/services/observability/langfuse-tracing-provider';
import {TracingEventProcessor} from '../src/services/observability/tracing-event-processor';

function fakeLangfuse() {
    const traces: unknown[] = [];
    const spans: unknown[] = [];
    const generations: unknown[] = [];
    const traceUpdates: unknown[] = [];

    const makeNode = () => ({
        span(params: unknown) {
            spans.push(params);
            return makeNode();
        },
        generation(params: unknown) {
            generations.push(params);
            return {update: () => {}};
        },
        event: () => {},
        update(params: unknown) {
            traceUpdates.push(params);
        },
        end: () => {},
    });

    return {
        traces,
        spans,
        generations,
        traceUpdates,
        trace(params: unknown) {
            traces.push(params);
            return makeNode();
        },
        flushAsync: () => {},
        shutdownAsync: () => {},
    };
}

describe('request scoped langfuse provider', () => {
    test('two providers keep independent trace context', () => {
        const client = fakeLangfuse() as any;
        const first = new LangfuseTracingProvider(client);
        const second = new LangfuseTracingProvider(client);

        first.setTraceContext({name: 'query', sessionId: 't1', metadata: {requestId: 'r1'}});
        second.setTraceContext({name: 'query', sessionId: 't2', metadata: {requestId: 'r2'}});

        expect(client.traces).toHaveLength(2);
        expect(client.traces[0]).toMatchObject({sessionId: 't1', metadata: {requestId: 'r1'}});
        expect(client.traces[1]).toMatchObject({sessionId: 't2', metadata: {requestId: 'r2'}});
    });

    test('processor attaches request context to trace, spans, generations and trace updates', () => {
        const client = fakeLangfuse() as any;
        const provider = new LangfuseTracingProvider(client);
        const contextMetadata = {
            requestId: 'req-obs-1',
            threadId: 'thread-obs-1',
            agentId: 'agent-obs-1',
            tenantId: 'tenant-obs-1',
            userId: 'user-obs-1',
            sdkSessionId: 'sdk-obs-1',
            model: 'claude-test-model',
        };

        const processor = new TracingEventProcessor({
            provider,
            model: contextMetadata.model,
            threadId: contextMetadata.threadId,
            userId: contextMetadata.userId,
            tenantId: contextMetadata.tenantId,
            agentId: contextMetadata.agentId,
            requestId: contextMetadata.requestId,
            sdkSessionId: contextMetadata.sdkSessionId,
            userInput: 'hello',
            systemPrompt: 'system prompt',
        } as any);

        processor.process({
            type: 'stream_event',
            event: {
                type: 'message_start',
                message: {
                    model: contextMetadata.model,
                    usage: {input_tokens: 3, output_tokens: 0},
                },
            },
        });
        processor.process({
            type: 'stream_event',
            event: {
                type: 'content_block_delta',
                delta: {type: 'thinking_delta', thinking: 'reasoning'},
            },
        });
        processor.process({
            type: 'stream_event',
            event: {
                type: 'content_block_delta',
                delta: {type: 'text_delta', text: 'answer'},
            },
        });
        processor.process({
            type: 'assistant',
            message: {
                content: [{type: 'tool_use', name: 'E2ETool', input: {ok: true}}],
                usage: {input_tokens: 3, output_tokens: 5},
            },
        });
        processor.end({
            modelUsage: {
                [contextMetadata.model]: {
                    inputTokens: 3,
                    outputTokens: 5,
                    cacheReadInputTokens: 0,
                    cacheCreationInputTokens: 0,
                    costUSD: 0,
                },
            },
        }, 123);

        expect(client.traces[0]).toMatchObject({metadata: contextMetadata});
        expect(client.spans).toContainEqual(expect.objectContaining({name: 'turn', metadata: expect.objectContaining(contextMetadata)}));
        expect(client.spans).toContainEqual(expect.objectContaining({name: 'round-1', metadata: expect.objectContaining(contextMetadata)}));
        expect(client.spans).toContainEqual(expect.objectContaining({name: 'reasoning-1', metadata: expect.objectContaining(contextMetadata)}));
        expect(client.spans).toContainEqual(expect.objectContaining({name: 'tool: E2ETool', metadata: expect.objectContaining(contextMetadata)}));
        expect(client.generations).toContainEqual(expect.objectContaining({
            name: 'llm-turn-1',
            model: contextMetadata.model,
            metadata: expect.objectContaining(contextMetadata),
        }));
        expect(client.traceUpdates).toContainEqual(expect.objectContaining({
            metadata: expect.objectContaining({
                ...contextMetadata,
                durationMs: 123,
                totalRounds: 1,
            }),
        }));
    });
});
