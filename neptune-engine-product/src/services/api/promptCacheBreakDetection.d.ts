import type { BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import type { AgentId } from 'src/types/ids.js';
import type { Message } from 'src/types/message.js';
import type { QuerySource } from '../../constants/querySource.js';
export declare const CACHE_TTL_1HOUR_MS: number;
/** Extended tracking snapshot — everything that could affect the server-side
 *  cache key that we can observe from the client. All fields are optional so
 *  the call site can add incrementally; undefined fields compare as stable. */
export type PromptStateSnapshot = {
    system: TextBlockParam[];
    toolSchemas: BetaToolUnion[];
    querySource: QuerySource;
    model: string;
    agentId?: AgentId;
    fastMode?: boolean;
    globalCacheStrategy?: string;
    betas?: readonly string[];
    autoModeActive?: boolean;
    isUsingOverage?: boolean;
    cachedMCEnabled?: boolean;
    effortValue?: string | number;
    extraBodyParams?: unknown;
};
/**
 * Phase 1 (pre-call): Record the current prompt/tool state and detect what changed.
 * Does NOT fire events — just stores pending changes for phase 2 to use.
 */
export declare function recordPromptState(snapshot: PromptStateSnapshot): void;
/**
 * Phase 2 (post-call): Check the API response's cache tokens to determine
 * if a cache break actually occurred. If it did, use the pending changes
 * from phase 1 to explain why.
 */
export declare function checkResponseForCacheBreak(querySource: QuerySource, cacheReadTokens: number, cacheCreationTokens: number, messages: Message[], agentId?: AgentId, requestId?: string | null): Promise<void>;
/**
 * Call when cached microcompact sends cache_edits deletions.
 * The next API response will have lower cache read tokens — that's
 * expected, not a cache break.
 */
export declare function notifyCacheDeletion(querySource: QuerySource, agentId?: AgentId): void;
/**
 * Call after compaction to reset the cache read baseline.
 * Compaction legitimately reduces message count, so cache read tokens
 * will naturally drop on the next call — that's not a break.
 */
export declare function notifyCompaction(querySource: QuerySource, agentId?: AgentId): void;
export declare function cleanupAgentTracking(agentId: AgentId): void;
export declare function resetPromptCacheBreakDetection(): void;
//# sourceMappingURL=promptCacheBreakDetection.d.ts.map