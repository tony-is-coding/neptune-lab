/**
 * TracingEventProcessor — SDK 事件流的 Tracing 处理器
 *
 * 职责单一：消费 SDK 事件流，自动维护 turn/round 状态机，向 Langfuse 上报嵌套层级链路。
 * ThreadManager 只需调用 processor.process(event) 即可。
 *
 * 层级结构：
 * Trace: query
 * └── Turn Span (整个 agentic loop)
 *     ├── Round 1 (一次 LLM 推理循环)
 *     │   ├── reasoning (思考过程)
 *     │   ├── generation: llm-call (LLM API 调用)
 *     │   └── tool: WebSearch (工具执行)
 *     ├── Round 2
 *     │   ├── reasoning
 *     │   ├── generation: llm-call
 *     │   └── tool: Read
 *     └── Round 3
 *         ├── reasoning
 *         └── generation: llm-call (最终回答)
 *
 * 状态机：
 * 1. 构造时 → 创建 trace + 开始 turn span
 * 2. 收到 stream_event → 开始 round（如果还没开始）+ 累积内容
 * 3. 收到 assistant → 记录 reasoning + generation + tools → 结束 round
 * 4. 下一个 stream_event → 开始新 round
 * 5. end() → 结束 turn + 结束 trace
 */

import {LangfuseTracingProvider} from './langfuse-tracing-provider.js';
import {createLogger} from '../../utils/logger.js';

const log = createLogger('tracing-processor');

/**
 * Processor 配置
 */
export interface TracingProcessorConfig {
    provider: LangfuseTracingProvider;
    model: string;
    threadId: string;
    userId: string;
    tenantId: string;
    agentId: string;
    requestId?: string;
    sdkSessionId?: string;
    userInput: string;
    systemPrompt?: string;
}

/**
 * TracingEventProcessor
 */
export class TracingEventProcessor {
    private provider: LangfuseTracingProvider;
    private model: string;
    private userInput: string;
    private systemPrompt: string;
    private config: TracingProcessorConfig;
    private baseMetadata: Record<string, unknown>;

    // Turn/Round 状态
    private roundIndex = 0;
    private roundActive = false;
    private currentTurnText = '';
    private currentTurnThinking = '';
    private currentTurnThinkingStartTime = 0;
    private currentTurnToolUses: Array<{ name: string; input: unknown }> = [];
    private currentRoundStartTime: number;

    // TTFT (Time To First Token)
    private firstTokenTime: number | null = null;
    private currentRoundFirstTokenTime: number | null = null;

    // Usage captured from stream events (message_start / message_delta)
    private capturedUsage: Record<string, unknown> = {};

    // API 调用边界追踪（message_start → message_stop 为一次 API 调用）
    private apiCallActive = false;
    private apiCallBlocks: unknown[] = [];

    // Tool 状态（兼容独立 tool_use/tool_result 事件）
    private pendingToolCalls = new Map<string, { name: string; input: unknown; startTime: number }>();

    // Messages 上下文（严格遵循 user/assistant 交替格式）
    private messagesContext: Array<{ role: string; content: unknown }> = [];

    // 输出收集
    private _assistantOutput = '';

    constructor(config: TracingProcessorConfig) {
        this.provider = config.provider;
        this.model = config.model;
        this.userInput = config.userInput;
        this.systemPrompt = config.systemPrompt || '';
        this.config = config;
        this.baseMetadata = {
            requestId: config.requestId,
            threadId: config.threadId,
            agentId: config.agentId,
            tenantId: config.tenantId,
            userId: config.userId,
            sdkSessionId: config.sdkSessionId,
            model: config.model,
        };
        this.currentRoundStartTime = performance.now();

        this.provider.setObservationMetadata(this.baseMetadata);

        // 初始化 trace
        this.provider.setTraceContext({
            name: 'query',
            sessionId: config.threadId,
            userId: config.userId,
            input: config.userInput,
            metadata: this.baseMetadata,
        });

        // 开始 turn span
        this.provider.startTurn('turn', {
            agentId: config.agentId,
            model: config.model,
        });

        // 初始化 messages 上下文
        this.messagesContext.push({role: 'user', content: config.userInput});
    }

    /**
     * 处理单个 SDK 事件
     */
    process(event: unknown): void {
        const e = event as Record<string, unknown>;
        const eventType = e.type as string;

        switch (eventType) {
            case 'system':
                this.handleSystem(e);
                break;
            case 'stream_event':
                this.handleStreamEvent(e);
                break;
            case 'assistant':
                this.handleAssistant(e);
                break;
            case 'tool_use':
                this.handleToolUse(e);
                break;
            case 'tool_result':
                this.handleToolResult(e);
                break;
            case 'result':
                this.handleResult(e);
                break;
        }
    }

    /**
     * 结束 trace
     */
    end(usage?: {
        modelUsage?: Record<string, {
            inputTokens: number;
            outputTokens: number;
            cacheReadInputTokens: number;
            cacheCreationInputTokens: number;
            costUSD: number;
        }>;
    }, durationMs?: number): void {
        // 结束可能未关闭的 round
        if (this.roundActive) {
            this.provider.endRound();
            this.roundActive = false;
        }

        // 结束 turn
        this.provider.endTurn();

        // 回填 usage 到最后一个 generation
        if (usage?.modelUsage) {
            const firstModel = Object.values(usage.modelUsage)[0];
            if (firstModel) {
                this.provider.updateLastGenerationUsage({
                    input: firstModel.inputTokens,
                    output: firstModel.outputTokens,
                    inputCached: firstModel.cacheReadInputTokens,
                    cacheCreation: firstModel.cacheCreationInputTokens,
                });
            }

            // 更新 trace metadata
            const totalUsage: Record<string, unknown> = {};
            for (const [model, mu] of Object.entries(usage.modelUsage)) {
                totalUsage[model] = {
                    inputTokens: mu.inputTokens,
                    outputTokens: mu.outputTokens,
                    cacheReadInputTokens: mu.cacheReadInputTokens,
                    cacheCreationInputTokens: mu.cacheCreationInputTokens,
                    costUSD: mu.costUSD,
                };
            }
            this.provider.updateTraceMetadata({
                totalRounds: this.roundIndex,
                totalUsage,
                durationMs,
                timeToFirstToken: this.firstTokenTime
                    ? Math.round(this.firstTokenTime - this.currentRoundStartTime)
                    : undefined,
            });
        }

        this.provider.endTrace(this._assistantOutput || undefined);
    }

    /**
     * 错误时结束 trace
     */
    endWithError(): void {
        if (this.roundActive) {
            this.provider.endRound();
        }
        this.provider.endTurn();
        this.provider.endTrace();
    }

    /**
     * 获取收集到的 assistant 输出文本
     */
    get assistantOutput(): string {
        return this._assistantOutput;
    }

    // ===== 内部方法 =====

    /**
     * 确保 round 已开始
     */
    private ensureRoundStarted(): void {
        if (!this.roundActive) {
            this.roundIndex++;
            this.currentRoundStartTime = performance.now();
            this.provider.startRound(`round-${this.roundIndex}`, {
                roundIndex: this.roundIndex,
            });
            this.roundActive = true;
        }
    }

    private handleSystem(event: Record<string, unknown>): void {
        // system 事件不需要特殊处理（完整 prompt 通过 setFullSystemPrompt 注入）
    }

    /**
     * 外部注入完整 system prompt（Engine 内部组装后回调）
     */
    setFullSystemPrompt(prompt: string): void {
        if (prompt && prompt.length > this.systemPrompt.length) {
            this.systemPrompt = prompt;
        }
    }

    private handleStreamEvent(event: Record<string, unknown>): void {
        const innerEvent = event.event as Record<string, unknown> | undefined;
        if (!innerEvent) return;

        const innerType = innerEvent.type as string;

        // 捕获 message_start（含 model）和 message_delta（含 usage）
        if (innerType === 'message_start') {
            const message = innerEvent.message as Record<string, unknown> | undefined;
            if (message?.usage) {
                // message_start 标志新一轮 API 调用开始
                this.capturedUsage = {...(message.usage as Record<string, unknown>)};
                this.apiCallActive = true;
                this.apiCallBlocks = [];
                log.info('LLM call started (message_start)', {
                    round: this.roundIndex + 1,
                    model: (message.model as string) || this.model,
                    inputTokens: this.capturedUsage.input_tokens,
                    cacheRead: this.capturedUsage.cache_read_input_tokens,
                });
            }
        } else if (innerType === 'message_delta') {
            const usage = innerEvent.usage as Record<string, unknown> | undefined;
            if (usage) {
                this.capturedUsage = {...this.capturedUsage, ...usage};
                const outputTokens = (usage.output_tokens ?? 0) as number;
                log.info('LLM call usage (message_delta)', {
                    round: this.roundIndex,
                    outputTokens,
                    inputTokens: this.capturedUsage.input_tokens,
                });
                // 回填到已记录的 generation
                if (outputTokens > 0) {
                    this.provider.updateLastGenerationUsage({
                        input: (this.capturedUsage.input_tokens ?? 0) as number,
                        output: outputTokens,
                        inputCached: (this.capturedUsage.cache_read_input_tokens as number) || undefined,
                        cacheCreation: (this.capturedUsage.cache_creation_input_tokens as number) || undefined,
                    });
                }
            }
        } else if (innerType === 'message_stop') {
            // API 调用结束 — 将累积的 blocks 合并为一个 assistant message
            if (this.apiCallActive && this.apiCallBlocks.length > 0) {
                this.messagesContext.push({role: 'assistant', content: this.apiCallBlocks});
            }
            this.apiCallActive = false;
            this.apiCallBlocks = [];
        }

        if (innerType === 'content_block_delta') {
            const delta = innerEvent.delta as Record<string, unknown> | undefined;
            if (!delta) return;

            if (delta.type === 'text_delta' && delta.text) {
                this.ensureRoundStarted();
                // 记录 TTFT
                if (!this.firstTokenTime) {
                    this.firstTokenTime = performance.now();
                }
                if (!this.currentRoundFirstTokenTime) {
                    this.currentRoundFirstTokenTime = performance.now();
                }
                this._assistantOutput += delta.text as string;
                this.currentTurnText += delta.text as string;
            } else if (delta.type === 'thinking_delta' && delta.thinking) {
                this.ensureRoundStarted();
                if (!this.currentTurnThinkingStartTime) {
                    this.currentTurnThinkingStartTime = performance.now();
                }
                this.currentTurnThinking += delta.thinking as string;
            }
        } else if (innerType === 'content_block_start') {
            const contentBlock = innerEvent.content_block as Record<string, unknown> | undefined;
            if (contentBlock?.type === 'thinking') {
                this.ensureRoundStarted();
                if (!this.currentTurnThinkingStartTime) {
                    this.currentTurnThinkingStartTime = performance.now();
                }
                if (contentBlock.thinking) {
                    this.currentTurnThinking += contentBlock.thinking as string;
                }
            }
        }
    }

    private handleAssistant(event: Record<string, unknown>): void {
        // 确保 round 已开始（edge case：assistant 事件直接到达）
        this.ensureRoundStarted();

        const msg = event.message as Record<string, unknown> | undefined;
        if (msg?.content && Array.isArray(msg.content)) {
            for (const block of msg.content) {
                if (block.type === 'text' && block.text) {
                    if (!this.currentTurnText) {
                        this.currentTurnText = block.text;
                        this._assistantOutput = block.text;
                    }
                }
                if (block.type === 'tool_use') {
                    this.currentTurnToolUses.push({name: block.name, input: block.input});
                }
            }
        }

        // 从 assistant event 的 message.usage 中补充 token 信息
        if (msg?.usage) {
            const msgUsage = msg.usage as Record<string, unknown>;
            this.capturedUsage = {...this.capturedUsage, ...msgUsage};
        }

        const roundDuration = Math.round(performance.now() - this.currentRoundStartTime);

        // 1. Reasoning span（嵌套在 round 下）
        if (this.currentTurnThinking) {
            const thinkingDuration = this.currentTurnThinkingStartTime
                ? Math.round(performance.now() - this.currentTurnThinkingStartTime)
                : roundDuration;
            this.provider.thinkingSpan({
                content: this.currentTurnThinking,
                turnIndex: this.roundIndex,
                durationMs: thinkingDuration,
            });
        }

        // 2. Generation（嵌套在 round 下）
        const inputTokens = (this.capturedUsage.input_tokens ?? 0) as number;
        const outputTokens = (this.capturedUsage.output_tokens ?? 0) as number;
        const cacheRead = (this.capturedUsage.cache_read_input_tokens ?? 0) as number;
        const cacheCreation = (this.capturedUsage.cache_creation_input_tokens ?? 0) as number;

        log.debug('LLM generation recorded', {
            round: this.roundIndex,
            inputTokens,
            outputTokens,
            cacheRead,
            cacheCreation,
            hasThinking: !!this.currentTurnThinking,
            hasText: !!this.currentTurnText,
            toolCalls: this.currentTurnToolUses.map(t => t.name),
        });

        this.provider.generation({
            name: `llm-turn-${this.roundIndex}`,
            model: this.model,
            input: this.formatGenerationInput(),
            output: this.formatGenerationOutput(),
            usage: {
                inputTokens,
                outputTokens,
                cacheReadInputTokens: cacheRead || undefined,
                cacheCreationInputTokens: cacheCreation || undefined,
            },
            latencyMs: roundDuration,
            metadata: {
                roundIndex: this.roundIndex,
                hasThinking: !!this.currentTurnThinking,
                toolCalls: this.currentTurnToolUses.map(t => t.name),
            },
            modelParameters: {max_tokens: 32000},
            completionStartTime: this.currentRoundFirstTokenTime
                ? new Date(Date.now() - Math.round(performance.now() - this.currentRoundFirstTokenTime))
                : undefined,
            version: '0.1.0',
            environment: process.env.NODE_ENV || 'development',
        });

        // 3. Tool spans（嵌套在 round 下）
        for (const tu of this.currentTurnToolUses) {
            this.provider.toolSpan({
                name: tu.name,
                input: tu.input,
                output: '(result in next round context)',
                durationMs: 0,
                status: 'ok',
            });
        }

        // 累积 content blocks 到当前 API 调用（message_stop 时合并为一个 assistant message）
        if (this.apiCallActive) {
            if (this.currentTurnThinking) {
                this.apiCallBlocks.push({
                    type: 'thinking',
                    thinking: this.currentTurnThinking.substring(0, 2000),
                });
            }
            if (this.currentTurnText) {
                this.apiCallBlocks.push({type: 'text', text: this.currentTurnText});
            }
            for (const tu of this.currentTurnToolUses) {
                this.apiCallBlocks.push({type: 'tool_use', name: tu.name, input: tu.input});
            }
        } else {
            // Fallback: 如果没有 apiCallActive（不应该发生），直接 push
            const assistantBlocks: unknown[] = [];
            if (this.currentTurnThinking) {
                assistantBlocks.push({type: 'thinking', thinking: this.currentTurnThinking.substring(0, 2000)});
            }
            if (this.currentTurnText) {
                assistantBlocks.push({type: 'text', text: this.currentTurnText});
            }
            for (const tu of this.currentTurnToolUses) {
                assistantBlocks.push({type: 'tool_use', name: tu.name, input: tu.input});
            }
            if (assistantBlocks.length === 0) {
                assistantBlocks.push({type: 'text', text: '(no output)'});
            }
            this.messagesContext.push({role: 'assistant', content: assistantBlocks});
        }

        // 结束当前 round
        this.provider.endRound();
        this.roundActive = false;

        // 重置 round 状态（capturedUsage 不在这里重置，由 message_start 自然重置）
        this.currentTurnText = '';
        this.currentTurnThinking = '';
        this.currentTurnThinkingStartTime = 0;
        this.currentTurnToolUses = [];
        this.currentRoundFirstTokenTime = null;
    }

    private handleToolUse(event: Record<string, unknown>): void {
        const toolId = String(event.id || '');
        const toolName = String(event.name || '');
        const toolInput = event.input || {};
        this.pendingToolCalls.set(toolId, {
            name: toolName,
            input: toolInput,
            startTime: performance.now(),
        });
    }

    private handleToolResult(event: Record<string, unknown>): void {
        const toolUseId = String(event.toolUseId || event.tool_use_id || '');
        const toolOutput = event.content ?? event.output ?? '';
        const isError = Boolean(event.isError);
        const pending = this.pendingToolCalls.get(toolUseId);

        if (pending) {
            this.ensureRoundStarted();
            const toolDuration = Math.round(performance.now() - pending.startTime);
            this.provider.toolSpan({
                name: pending.name,
                input: pending.input,
                output: typeof toolOutput === 'string' ? toolOutput.substring(0, 2000) : toolOutput,
                durationMs: toolDuration,
                status: isError ? 'error' : 'ok',
            });
            this.pendingToolCalls.delete(toolUseId);
        }

        // 累积 tool_result 到 messages 上下文
        const outputStr = typeof toolOutput === 'string'
            ? toolOutput.substring(0, 1000)
            : JSON.stringify(toolOutput).substring(0, 1000);
        this.messagesContext.push({
            role: 'user',
            content: [{type: 'tool_result', tool_use_id: toolUseId, content: outputStr}],
        });
    }

    private handleResult(event: Record<string, unknown>): void {
        // result 事件可能包含 usage 信息
        const usage = event.usage as Record<string, unknown> | undefined;
        if (usage) {
            const inputTokens = (usage.inputTokens ?? usage.input_tokens ?? 0) as number;
            const outputTokens = (usage.outputTokens ?? usage.output_tokens ?? 0) as number;
            const cacheRead = (usage.cacheReadInputTokens ?? usage.cache_read_input_tokens ?? 0) as number;
            const cacheCreation = (usage.cacheCreationInputTokens ?? usage.cache_creation_input_tokens ?? 0) as number;

            if (inputTokens > 0 || outputTokens > 0) {
                this.provider.updateLastGenerationUsage({
                    input: inputTokens,
                    output: outputTokens,
                    inputCached: cacheRead || undefined,
                    cacheCreation: cacheCreation || undefined,
                });
            }
        }
    }

    // ===== 格式化方法 =====

    /**
     * 格式化 Generation Input — 完整的 LLM call messages 格式
     *
     * 展示标准的 messages 数组结构：
     * - system: 完整 system prompt
     * - user: 用户输入
     * - assistant: 历史回复
     * - user (tool_result): 工具执行结果
     */
    private formatGenerationInput(): unknown {
        const messages: Array<{ role: string; content: unknown }> = [];

        // 1. System prompt
        if (this.systemPrompt) {
            messages.push({
                role: 'system',
                content: this.systemPrompt,
            });
        }

        // 2. 完整的对话历史 messages
        for (const m of this.messagesContext) {
            messages.push(m);
        }

        return messages;
    }

    /**
     * 格式化 Generation Output — 完整的 assistant response
     *
     * 包含：thinking + text + tool_use blocks
     */
    private formatGenerationOutput(): unknown {
        const contentBlocks: unknown[] = [];

        // 1. Thinking/Reasoning
        if (this.currentTurnThinking) {
            contentBlocks.push({
                type: 'thinking',
                thinking: this.currentTurnThinking.length > 5000
                    ? this.currentTurnThinking.substring(0, 5000) + '\n... [truncated]'
                    : this.currentTurnThinking,
            });
        }

        // 2. Text response
        if (this.currentTurnText) {
            contentBlocks.push({
                type: 'text',
                text: this.currentTurnText,
            });
        }

        // 3. Tool use calls
        for (const tu of this.currentTurnToolUses) {
            contentBlocks.push({
                type: 'tool_use',
                name: tu.name,
                input: tu.input,
            });
        }

        // 如果只有一个 text block，直接返回文本（Langfuse 显示更友好）
        if (contentBlocks.length === 1 && (contentBlocks[0] as any).type === 'text') {
            return (contentBlocks[0] as any).text;
        }

        return contentBlocks.length > 0 ? contentBlocks : '(no output)';
    }
}
