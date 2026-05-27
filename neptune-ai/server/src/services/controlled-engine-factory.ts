import {randomUUID} from 'crypto';
import type {EngineFactory, QueryableEngine, QueryUsageResult} from './thread-manager.js';
import {createLogger} from '../utils/logger.js';

const log = createLogger('controlled-engine-factory');

type QueryCompleteHandler = (payload: QueryUsageResult) => void;

class ControlledEngine implements QueryableEngine {
    private handlers = new Map<string, QueryCompleteHandler[]>();
    private messagesBySession = new Map<string, unknown[]>();

    async* query(sessionId: string, content: string): AsyncIterable<unknown> {
        if (content.startsWith('[closing-check]')) {
            yield* this.queryClosingCheck(sessionId, content);
            return;
        }

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

    /**
     * 关账受控检查场景
     *
     * 触发约定：prompt 必须以 `[closing-check]` 开头，紧跟可选键值对：
     *   `dataset=<datasetName>`：mock 数据集名（v1 支持 general-ledger-basic）
     *   `codes=<code1,code2,...>`：要执行的 checklist 规则代码列表
     *
     * 例：`[closing-check] dataset=general-ledger-basic codes=unposted_vouchers,period_status,voucher_sequence`
     *
     * SSE 流契约：
     *   - 每个 code 产生一对 `tool_use` (`LedgerCheck`) + `tool_result`
     *   - tool_result.output 包含 `{code, status: 'passed'|'failed', findings?: [...]}`
     *   - 上层 closing-workbench 监听 SSE 流后据此写 Finding / 更新 checklistItem.status
     *
     * 当前 v1 数据集语义（general-ledger-basic）：
     *   - unposted_vouchers: failed → 1 个 blocking finding（3 张未过账凭证，金额 12,800.00 元）
     *   - period_status: passed
     *   - voucher_sequence: passed
     *   - 其他未知 code: passed（无副作用）
     *
     * 设计原则：本方法**只生成 SSE 流**，不直接写 DB；DB 写入是上层职责，
     * 这样保证 ControlledEngine 与生产 ClaudeCodeEngine 的事实写入路径一致。
     */
    private async* queryClosingCheck(sessionId: string, content: string): AsyncIterable<unknown> {
        const params = parseClosingCheckPrompt(content);
        const dataset = params.dataset || 'general-ledger-basic';
        const codes = params.codes.length > 0
            ? params.codes
            : ['unposted_vouchers', 'period_status', 'voucher_sequence'];

        yield {
            type: 'system',
            subtype: 'init',
            session_id: sessionId,
            model: 'neptune-controlled-model',
        };

        yield {
            type: 'stream_event',
            event: {
                type: 'content_block_delta',
                delta: {
                    type: 'thinking_delta',
                    thinking: `开始按 ${dataset} 数据集执行 ${codes.length} 项关账检查。`,
                },
            },
        };

        const assistantBlocks: unknown[] = [];
        const summaries: string[] = [];

        for (const code of codes) {
            const toolUseId = `controlled-tool-${randomUUID()}`;
            const result = closingCheckResultFor(dataset, code);

            yield {
                type: 'tool_use',
                id: toolUseId,
                name: 'LedgerCheck',
                input: {code, dataset},
            };
            assistantBlocks.push({
                type: 'tool_use',
                id: toolUseId,
                name: 'LedgerCheck',
                input: {code, dataset},
            });

            yield {
                type: 'tool_result',
                toolUseId,
                output: result,
            };
            summaries.push(`${code}: ${result.status}${result.findings.length > 0 ? `（${result.findings.length} 项异常）` : ''}`);
        }

        const finalText = [
            `关账检查（dataset=${dataset}）执行完成。`,
            ...summaries.map(s => `- ${s}`),
        ].join('\n');

        for (const chunk of finalText.split(/(?<=。|\n)/)) {
            if (!chunk) continue;
            yield {
                type: 'stream_event',
                event: {
                    type: 'content_block_delta',
                    delta: {type: 'text_delta', text: chunk},
                },
            };
        }

        const assistantMessage = {
            type: 'assistant',
            message: {
                content: [
                    {type: 'text', text: finalText},
                    ...assistantBlocks,
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
                    outputTokens: Math.max(8, codes.length * 8),
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


// ===== 关账受控检查场景：纯函数 helper =====

interface ClosingCheckPromptParams {
    dataset: string;
    codes: string[];
}

/**
 * 解析 `[closing-check] dataset=... codes=a,b,c` 形式 prompt 的参数。
 *
 * 容错原则：未识别的键忽略；缺失键返回空串/空数组让上层走默认值。
 */
export function parseClosingCheckPrompt(content: string): ClosingCheckPromptParams {
    const tail = content.slice('[closing-check]'.length).trim();
    const tokens = tail.split(/\s+/).filter(Boolean);
    const params: ClosingCheckPromptParams = {dataset: '', codes: []};

    for (const token of tokens) {
        const eqIdx = token.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = token.slice(0, eqIdx);
        const value = token.slice(eqIdx + 1);
        if (key === 'dataset') params.dataset = value;
        else if (key === 'codes') params.codes = value.split(',').map(s => s.trim()).filter(Boolean);
    }

    return params;
}

interface ClosingCheckFinding {
    title: string;
    summary: string;
    severity: 'blocking' | 'warning' | 'info';
    impactedCount: number;
    amountCents?: number;
}

interface ClosingCheckResult {
    code: string;
    status: 'passed' | 'failed';
    findings: ClosingCheckFinding[];
    sourceUri: string;
    sourceHash: string;
}

/**
 * 给定 dataset + checklist code，返回 mock 的检查结果。
 *
 * v1 仅支持 `general-ledger-basic`。其他 dataset / 未知 code 默认返回 passed 空 finding。
 * 每个 result 自带 sourceUri/sourceHash，便于上层写 EvidenceArtifact。
 */
export function closingCheckResultFor(dataset: string, code: string): ClosingCheckResult {
    const sourceUri = `mock://erp/${dataset}/${code}`;
    const sourceHash = `sha256-mock-${dataset}-${code}`;

    if (dataset !== 'general-ledger-basic') {
        return {code, status: 'passed', findings: [], sourceUri, sourceHash};
    }

    if (code === 'unposted_vouchers') {
        return {
            code,
            status: 'failed',
            findings: [{
                title: '存在未过账凭证',
                summary: '总账检查发现 3 张未过账凭证，可能阻塞本期关账。',
                severity: 'blocking',
                impactedCount: 3,
                amountCents: 1280000,
            }],
            sourceUri,
            sourceHash,
        };
    }

    // period_status / voucher_sequence / 其他已知 code → passed
    return {code, status: 'passed', findings: [], sourceUri, sourceHash};
}

/**
 * 关账受控检查的 prompt 构建器。供上层（closing-workbench）调用。
 *
 * 这是 ControlledEngine ↔ closing-workbench 之间的契约入口：
 * 上层应当**仅**通过此函数构造 prompt，避免格式漂移。
 */
export function buildClosingCheckPrompt(params: {
    dataset: string;
    codes: string[];
}): string {
    return `[closing-check] dataset=${params.dataset} codes=${params.codes.join(',')}`;
}
