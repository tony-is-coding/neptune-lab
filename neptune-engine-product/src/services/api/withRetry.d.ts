import type Anthropic from '@anthropic-ai/sdk';
import { APIError } from '@anthropic-ai/sdk';
import type { QuerySource } from 'src/constants/querySource.js';
import type { SystemAPIErrorMessage } from 'src/types/message.js';
import type { ThinkingConfig } from '../../utils/thinking.js';
export declare const BASE_DELAY_MS = 500;
export interface RetryContext {
    maxTokensOverride?: number;
    model: string;
    thinkingConfig: ThinkingConfig;
    fastMode?: boolean;
}
interface RetryOptions {
    maxRetries?: number;
    model: string;
    fallbackModel?: string;
    thinkingConfig: ThinkingConfig;
    fastMode?: boolean;
    signal?: AbortSignal;
    querySource?: QuerySource;
    /**
     * Pre-seed the consecutive 529 counter. Used when this retry loop is a
     * non-streaming fallback after a streaming 529 — the streaming 529 should
     * count toward MAX_529_RETRIES so total 529s-before-fallback is consistent
     * regardless of which request mode hit the overload.
     */
    initialConsecutive529Errors?: number;
}
export declare class CannotRetryError extends Error {
    readonly originalError: unknown;
    readonly retryContext: RetryContext;
    constructor(originalError: unknown, retryContext: RetryContext);
}
export declare class FallbackTriggeredError extends Error {
    readonly originalModel: string;
    readonly fallbackModel: string;
    constructor(originalModel: string, fallbackModel: string);
}
export declare function withRetry<T>(getClient: () => Promise<Anthropic>, operation: (client: Anthropic, attempt: number, context: RetryContext) => Promise<T>, options: RetryOptions): AsyncGenerator<SystemAPIErrorMessage, T>;
export declare function getRetryDelay(attempt: number, retryAfterHeader?: string | null, maxDelayMs?: number): number;
export declare function parseMaxTokensContextOverflowError(error: APIError): {
    inputTokens: number;
    maxTokens: number;
    contextLimit: number;
} | undefined;
export declare function is529Error(error: unknown): boolean;
export declare function getDefaultMaxRetries(): number;
export {};
//# sourceMappingURL=withRetry.d.ts.map