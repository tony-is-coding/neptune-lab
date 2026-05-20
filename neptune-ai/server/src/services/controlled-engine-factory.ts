import {randomUUID} from 'crypto';
import type {EngineFactory, QueryableEngine, QueryUsageResult} from './thread-manager.js';
import {createLogger} from '../utils/logger.js';

const log = createLogger('controlled-engine-factory');

type QueryCompleteHandler = (payload: QueryUsageResult) => void;

class ControlledEngine implements QueryableEngine {
    private handlers = new Map<string, QueryCompleteHandler[]>();
    private messagesBySession = new Map<string, unknown[]>();

    async* query(sessionId: string, content: string): AsyncIterable<unknown> {
        const assistantText = [
            'E2E OK: controlled model dispatch is healthy. ',
            `Received "${content}". `,
            'SSE text streaming, tool events, and completion state are verified.',
        ];
        const toolUseId = `controlled-tool-${randomUUID()}`;

        yield {
            type: 'system',
            subtype: 'init',
            session_id: sessionId,
            model: 'neptune-controlled-model',
        };

        yield {
            type: 'stream_event',
            event: {
                type: 'content_block_start',
                content_block: {
                    type: 'thinking',
                    thinking: '受控模型正在验证调度链路。',
                },
            },
        };

        yield {
            type: 'stream_event',
            event: {
                type: 'content_block_delta',
                delta: {
                    type: 'thinking_delta',
                    thinking: ' 已完成输入解析与工具计划。',
                },
            },
        };

        yield {
            type: 'tool_use',
            id: toolUseId,
            name: 'E2EControlledTool',
            input: {
                purpose: 'verify-model-interaction-ui',
                userInputLength: content.length,
            },
        };

        yield {
            type: 'tool_result',
            toolUseId,
            output: {
                status: 'ok',
                observed: ['tool_use', 'tool_result', 'stream_text'],
            },
        };

        for (const chunk of assistantText) {
            yield {
                type: 'stream_event',
                event: {
                    type: 'content_block_delta',
                    delta: {
                        type: 'text_delta',
                        text: chunk,
                    },
                },
            };
        }

        const fullText = assistantText.join('');
        const assistantMessage = {
            type: 'assistant',
            message: {
                content: [
                    {
                        type: 'text',
                        text: fullText,
                    },
                    {
                        type: 'tool_use',
                        id: toolUseId,
                        name: 'E2EControlledTool',
                        input: {
                            purpose: 'verify-model-interaction-ui',
                            userInputLength: content.length,
                        },
                    },
                ],
            },
        };
        yield assistantMessage;

        const messages = [
            {
                role: 'user',
                content,
            },
            assistantMessage,
        ];
        this.messagesBySession.set(sessionId, messages);

        this.emitQueryComplete({
            sessionId,
            modelUsage: {
                'neptune-controlled-model': {
                    inputTokens: Math.max(1, Math.ceil(content.length / 4)),
                    outputTokens: 36,
                    cacheReadInputTokens: 0,
                    cacheCreationInputTokens: 0,
                    costUSD: 0,
                },
            },
        });

        yield {
            type: 'result',
            subtype: 'success',
            is_error: false,
            result: fullText,
        };
    }

    async destroy(): Promise<void> {
        this.handlers.clear();
    }

    on(event: string, handler: (payload: unknown) => void): void {
        const handlers = this.handlers.get(event) || [];
        handlers.push(handler as QueryCompleteHandler);
        this.handlers.set(event, handlers);
    }

    _getSessionMessages(sessionId: string): unknown[] {
        return this.messagesBySession.get(sessionId) || [];
    }

    private emitQueryComplete(payload: QueryUsageResult): void {
        for (const handler of this.handlers.get('query:complete') || []) {
            handler(payload);
        }
    }
}

export class ControlledEngineFactory implements EngineFactory {
    async createAndLoad(params: {
        tenantId: string;
        workspace: string;
    }): Promise<{engine: QueryableEngine; sdkSessionId: string}> {
        const sdkSessionId = `controlled-session-${randomUUID()}`;
        log.info('Controlled Engine 创建完成', {
            tenantId: params.tenantId,
            workspace: params.workspace,
            sdkSessionId,
        });

        return {
            engine: new ControlledEngine(),
            sdkSessionId,
        };
    }
}
