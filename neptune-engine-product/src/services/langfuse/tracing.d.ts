import type { LangfuseSpan } from '@langfuse/tracing';
export type { LangfuseSpan };
export declare function createTrace(params: {
    sessionId: string;
    model: string;
    provider: string;
    input?: unknown;
    name?: string;
    querySource?: string;
    username?: string;
}): LangfuseSpan | null;
export declare function recordLLMObservation(rootSpan: LangfuseSpan | null, params: {
    model: string;
    provider: string;
    input: unknown;
    output: unknown;
    usage: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
    };
    startTime?: Date;
    endTime?: Date;
    completionStartTime?: Date;
}): void;
export declare function recordToolObservation(rootSpan: LangfuseSpan | null, params: {
    toolName: string;
    toolUseId: string;
    input: unknown;
    output: string;
    startTime?: Date;
    isError?: boolean;
    parentBatchSpan?: LangfuseSpan | null;
}): void;
/**
 * Create a span that wraps a batch of concurrent tool calls.
 * Returns the batch span (to be passed as parentBatchSpan to recordToolObservation)
 * and must be ended with endToolBatchSpan() after all tools complete.
 */
export declare function createToolBatchSpan(rootSpan: LangfuseSpan | null, params: {
    toolNames: string[];
    batchIndex: number;
}): LangfuseSpan | null;
export declare function endToolBatchSpan(batchSpan: LangfuseSpan | null): void;
export declare function createSubagentTrace(params: {
    sessionId: string;
    agentType: string;
    agentId: string;
    model: string;
    provider: string;
    input?: unknown;
    username?: string;
}): LangfuseSpan | null;
export declare function endTrace(rootSpan: LangfuseSpan | null, output?: unknown, status?: 'interrupted' | 'error'): void;
//# sourceMappingURL=tracing.d.ts.map