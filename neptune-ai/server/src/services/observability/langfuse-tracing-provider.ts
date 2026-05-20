/**
 * LangfuseTracingProvider — ITracingProvider 的 Langfuse 实现
 *
 * 层级结构：
 * Trace (一次 dispatch)
 * └── Turn Span (整个 agentic loop)
 *     ├── Round Span (一次 LLM 推理循环)
 *     │   ├── Reasoning Span (思考过程)
 *     │   ├── Generation (LLM API 调用)
 *     │   └── Tool Span (工具执行)
 *     ├── Round Span
 *     │   ├── Reasoning Span
 *     │   ├── Generation
 *     │   └── Tool Span
 *     └── ...
 */

import type {Langfuse as LangfuseClient} from 'langfuse';
import type {ITracingProvider} from 'claude-code-best/engine';
import {SpanStatus, type Span} from 'claude-code-best/engine';

/**
 * Langfuse Span 适配器 — 实现 Engine 的 Span 接口
 */
class LangfuseSpanAdapter implements Span {
    readonly name: string;
    readonly attributes: Record<string, unknown>;
    private langfuseSpan: any;

    constructor(name: string, attributes: Record<string, unknown>, langfuseSpan: any) {
        this.name = name;
        this.attributes = attributes;
        this.langfuseSpan = langfuseSpan;
    }

    setStatus(status: SpanStatus): Span {
        if (this.langfuseSpan) {
            this.langfuseSpan.update({
                level: status === SpanStatus.ERROR ? 'ERROR' : 'DEFAULT',
            });
        }
        return this;
    }

    addEvent(name: string, attributes?: Record<string, unknown>): Span {
        if (this.langfuseSpan) {
            this.langfuseSpan.event({name, metadata: attributes});
        }
        return this;
    }

    end(): void {
        if (this.langfuseSpan) {
            this.langfuseSpan.end();
        }
    }
}

/**
 * Trace 上下文参数
 */
export interface TraceContextParams {
    name: string;
    sessionId: string;
    userId?: string;
    input?: unknown;
    metadata?: Record<string, unknown>;
}

/**
 * Generation 参数
 */
export interface GenerationParams {
    name: string;
    model: string;
    input: unknown;
    output: unknown;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number;
        cacheCreationInputTokens?: number;
    };
    latencyMs: number;
    metadata?: Record<string, unknown>;
    modelParameters?: Record<string, unknown>;
    completionStartTime?: Date;
    version?: string;
    environment?: string;
}

/**
 * LangfuseTracingProvider — 支持嵌套层级的 Tracing
 */
export class LangfuseTracingProvider implements ITracingProvider {
    private langfuse: LangfuseClient;
    private currentTrace: any = null;
    private currentTurnSpan: any = null;
    private currentRoundSpan: any = null;
    private lastGeneration: any = null;
    private observationMetadata: Record<string, unknown> = {};

    constructor(langfuse: LangfuseClient) {
        this.langfuse = langfuse;
    }

    /**
     * 设置当前请求的统一观测上下文。
     *
     * 同一个 dispatch 内的 trace/span/generation/tool 必须携带同一组关联键，
     * 否则 Langfuse 上只能看到碎片化 observation，无法稳定回溯一次用户请求。
     */
    setObservationMetadata(metadata: Record<string, unknown>): void {
        this.observationMetadata = {...metadata};
    }

    private mergeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
        return {...this.observationMetadata, ...(metadata ?? {})};
    }

    /**
     * 设置当前 trace 上下文（dispatch 入口调用）
     */
    setTraceContext(params: TraceContextParams): void {
        this.currentTrace = this.langfuse.trace({
            name: params.name,
            sessionId: params.sessionId,
            userId: params.userId,
            input: params.input,
            metadata: this.mergeMetadata(params.metadata),
        });
    }

    // ===== 层级管理 =====

    /**
     * 开始 Turn span（整个 agentic loop）
     */
    startTurn(name: string, metadata?: Record<string, unknown>): void {
        if (!this.currentTrace) return;
        this.currentTurnSpan = this.currentTrace.span({
            name,
            metadata: this.mergeMetadata(metadata),
        });
    }

    /**
     * 结束 Turn span
     */
    endTurn(): void {
        if (this.currentTurnSpan) {
            this.currentTurnSpan.end();
            this.currentTurnSpan = null;
        }
    }

    /**
     * 开始 Round span（一次 LLM 推理循环）
     */
    startRound(name: string, metadata?: Record<string, unknown>): void {
        const parent = this.currentTurnSpan ?? this.currentTrace;
        if (!parent) return;
        this.currentRoundSpan = parent.span({
            name,
            metadata: this.mergeMetadata(metadata),
        });
    }

    /**
     * 结束 Round span
     */
    endRound(): void {
        if (this.currentRoundSpan) {
            this.currentRoundSpan.end();
            this.currentRoundSpan = null;
        }
    }

    // ===== ITracingProvider 接口实现 =====

    startSpan(name: string, attributes?: Record<string, unknown>): Span {
        const parent = this.currentRoundSpan ?? this.currentTurnSpan ?? this.currentTrace;
        const langfuseSpan = parent
            ? parent.span({name, metadata: this.mergeMetadata(attributes)})
            : null;
        return new LangfuseSpanAdapter(name, this.mergeMetadata(attributes), langfuseSpan);
    }

    runInSpan<T>(
        name: string,
        fn: (span: Span) => T,
        attributes?: Record<string, unknown>,
    ): T {
        const span = this.startSpan(name, attributes);
        try {
            const result = fn(span);
            span.setStatus(SpanStatus.OK);
            return result;
        } catch (error) {
            span.setStatus(SpanStatus.ERROR);
            throw error;
        } finally {
            span.end();
        }
    }

    // ===== Observation 记录方法 =====

    /**
     * 记录 LLM generation — 挂在 currentRoundSpan 下
     * 保存引用用于后续 usage 回填
     */
    generation(params: GenerationParams): void {
        const parent = this.currentRoundSpan ?? this.currentTurnSpan ?? this.currentTrace;
        if (!parent) return;

        const usageObj: Record<string, number> = {
            input: params.usage.inputTokens,
            output: params.usage.outputTokens,
        };
        if (params.usage.cacheReadInputTokens) {
            usageObj.inputCached = params.usage.cacheReadInputTokens;
        }
        if (params.usage.cacheCreationInputTokens) {
            usageObj.cacheCreation = params.usage.cacheCreationInputTokens;
        }

        this.lastGeneration = parent.generation({
            name: params.name,
            model: params.model,
            input: params.input,
            output: params.output,
            usage: usageObj,
            metadata: this.mergeMetadata(params.metadata),
            modelParameters: params.modelParameters,
            completionStartTime: params.completionStartTime ?? new Date(Date.now() - params.latencyMs),
            version: params.version,
            environment: params.environment,
        });
    }

    /**
     * 回填 usage 到最后一个 generation（query:complete 后调用）
     */
    updateLastGenerationUsage(usage: {
        input: number;
        output: number;
        inputCached?: number;
        cacheCreation?: number;
    }): void {
        if (!this.lastGeneration) return;
        const usageObj: Record<string, number> = {
            input: usage.input,
            output: usage.output,
        };
        if (usage.inputCached) usageObj.inputCached = usage.inputCached;
        if (usage.cacheCreation) usageObj.cacheCreation = usage.cacheCreation;
        this.lastGeneration.update({usage: usageObj});
    }

    /**
     * 记录 tool 执行 span — 挂在 currentRoundSpan 下
     */
    toolSpan(params: {
        name: string;
        input: unknown;
        output: unknown;
        durationMs: number;
        status?: 'ok' | 'error';
    }): void {
        const parent = this.currentRoundSpan ?? this.currentTurnSpan ?? this.currentTrace;
        if (!parent) return;

        const span = parent.span({
            name: `tool: ${params.name}`,
            input: params.input,
            output: params.output,
            metadata: this.mergeMetadata({toolName: params.name}),
        });
        span.update({
            level: params.status === 'error' ? 'ERROR' : 'DEFAULT',
            endTime: new Date(),
            startTime: new Date(Date.now() - params.durationMs),
        });
        span.end();
    }

    /**
     * 记录 reasoning/thinking span — 挂在 currentRoundSpan 下
     */
    thinkingSpan(params: {
        content: string;
        turnIndex: number;
        durationMs: number;
    }): void {
        const parent = this.currentRoundSpan ?? this.currentTurnSpan ?? this.currentTrace;
        if (!parent) return;

        const span = parent.span({
            name: `reasoning-${params.turnIndex}`,
            input: {type: 'thinking'},
            output: params.content.substring(0, 3000),
            metadata: this.mergeMetadata({type: 'reasoning', turnIndex: params.turnIndex}),
        });
        span.update({
            endTime: new Date(),
            startTime: new Date(Date.now() - params.durationMs),
        });
        span.end();
    }

    /**
     * 更新 trace 的 metadata（如 usage/cost 汇总）
     */
    updateTraceMetadata(metadata: Record<string, unknown>): void {
        if (!this.currentTrace) return;
        this.currentTrace.update({metadata: this.mergeMetadata(metadata)});
    }

    /**
     * 结束当前 trace，附带输出，并立即 flush
     */
    endTrace(output?: unknown): void {
        if (this.currentTrace) {
            if (output !== undefined) {
                this.currentTrace.update({output});
            }
            this.currentTrace = null;
            this.currentTurnSpan = null;
            this.currentRoundSpan = null;
            this.lastGeneration = null;
            this.observationMetadata = {};
            this.langfuse.flushAsync();
        }
    }

    dispose(): void {
        this.langfuse.shutdownAsync();
    }
}
