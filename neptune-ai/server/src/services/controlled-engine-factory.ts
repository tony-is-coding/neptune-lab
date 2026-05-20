import {randomUUID} from 'crypto';
import type {EngineFactory, QueryableEngine, QueryUsageResult} from './thread-manager.js';
import {createLogger} from '../utils/logger.js';

const log = createLogger('controlled-engine-factory');

type QueryCompleteHandler = (payload: QueryUsageResult) => void;

class ControlledEngine implements QueryableEngine {
    private handlers = new Map<string, QueryCompleteHandler[]>();
    private messagesBySession = new Map<string, unknown[]>();

    async* query(sessionId: string, content: string): AsyncIterable<unknown> {
        if (content.toLowerCase().includes('advanced workflow')) {
            yield* this.queryAdvancedWorkflow(sessionId, content);
            return;
        }

        if (content.toLowerCase().includes('slow stream')) {
            yield* this.querySlowStream(sessionId, content);
            return;
        }

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

    private async* queryAdvancedWorkflow(sessionId: string, content: string): AsyncIterable<unknown> {
        const askToolId = `controlled-ask-${randomUUID()}`;
        const writeToolId = `controlled-write-${randomUUID()}`;
        const planId = `controlled-plan-${randomUUID()}`;
        const now = Date.now();
        const artifactContent = [
            '# Agent Workflow Acceptance',
            '',
            '- ask_user, artifact, and plan are visible',
            `- source prompt: ${content}`,
        ].join('\n');
        const finalText = 'Advanced workflow complete: decision captured, artifact generated, and plan finished.';

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
                    thinking: '正在组织高级工作流验收。',
                },
            },
        };

        yield {
            type: 'tool_use',
            id: askToolId,
            name: 'AskUserQuestion',
            input: {
                questions: [
                    {
                        header: '工作流决策',
                        question: '请选择下一步执行策略',
                        options: [
                            {
                                label: '继续生成报告',
                                description: '生成可审阅的工作流摘要。',
                            },
                            {
                                label: '先暂停',
                                description: '保留当前上下文，稍后继续。',
                            },
                        ],
                    },
                ],
            },
        };

        yield {
            type: 'plan_created',
            planId,
            title: '高级工作流验收计划',
            totalSteps: 2,
            createdAt: new Date(now).toISOString(),
        };

        yield {
            type: 'plan_step',
            planId,
            stepId: `${planId}-step-1`,
            stepNumber: 1,
            subject: '梳理当前工作流状态',
            activeForm: '正在梳理当前工作流状态',
            status: 'completed',
            updatedAt: new Date(now + 100).toISOString(),
        };

        yield {
            type: 'plan_step',
            planId,
            stepId: `${planId}-step-2`,
            stepNumber: 2,
            subject: '生成可审阅的交付物',
            activeForm: '正在生成可审阅的交付物',
            status: 'completed',
            updatedAt: new Date(now + 200).toISOString(),
        };

        yield {
            type: 'plan_done',
            planId,
            status: 'completed',
            summary: '高级工作流验收计划已完成。',
            duration: 240,
            completedAt: new Date(now + 240).toISOString(),
        };

        yield {
            type: 'tool_use',
            id: writeToolId,
            name: 'Write',
            input: {
                file_path: '/tmp/workflow-summary.md',
                content: artifactContent,
            },
        };

        yield {
            type: 'tool_result',
            toolUseId: writeToolId,
            output: {
                status: 'ok',
                path: '/tmp/workflow-summary.md',
            },
        };

        for (const chunk of ['Advanced workflow complete: ', 'decision captured, artifact generated, and plan finished.']) {
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

        const assistantMessage = {
            type: 'assistant',
            message: {
                content: [
                    {
                        type: 'text',
                        text: finalText,
                    },
                    {
                        type: 'tool_use',
                        id: askToolId,
                        name: 'AskUserQuestion',
                        input: {
                            questions: [
                                {
                                    header: '工作流决策',
                                    question: '请选择下一步执行策略',
                                    options: [
                                        {
                                            label: '继续生成报告',
                                            description: '生成可审阅的工作流摘要。',
                                        },
                                        {
                                            label: '先暂停',
                                            description: '保留当前上下文，稍后继续。',
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    {
                        type: 'tool_use',
                        id: writeToolId,
                        name: 'Write',
                        input: {
                            file_path: '/tmp/workflow-summary.md',
                            content: artifactContent,
                        },
                    },
                ],
            },
        };
        yield assistantMessage;

        this.messagesBySession.set(sessionId, [
            {role: 'user', content},
            assistantMessage,
        ]);

        this.emitQueryComplete({
            sessionId,
            modelUsage: {
                'neptune-controlled-model': {
                    inputTokens: Math.max(1, Math.ceil(content.length / 4)),
                    outputTokens: 64,
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
            result: finalText,
        };
    }

    private async* querySlowStream(sessionId: string, content: string): AsyncIterable<unknown> {
        yield {
            type: 'system',
            subtype: 'init',
            session_id: sessionId,
            model: 'neptune-controlled-model',
        };

        for (const chunk of ['Slow stream started. ', 'Still working. ', 'Almost done. ']) {
            await new Promise(resolve => setTimeout(resolve, 500));
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

        const finalText = `Slow stream finished for "${content}".`;
        yield {
            type: 'assistant',
            message: {
                content: [{type: 'text', text: finalText}],
            },
        };

        this.emitQueryComplete({
            sessionId,
            modelUsage: {
                'neptune-controlled-model': {
                    inputTokens: Math.max(1, Math.ceil(content.length / 4)),
                    outputTokens: 12,
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
            result: finalText,
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
