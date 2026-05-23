import type { QuerySource } from '../../constants/querySource.js';
import type { ToolUseContext } from '../../Tool.js';
import type { Message } from '../../types/message.js';
import type { CacheSafeParams } from '../../utils/forkedAgent.js';
import { type CompactionResult } from './compact.js';
export declare function getEffectiveContextWindowSize(model: string): number;
export type AutoCompactTrackingState = {
    compacted: boolean;
    turnCounter: number;
    turnId: string;
    consecutiveFailures?: number;
};
export declare const AUTOCOMPACT_BUFFER_TOKENS = 13000;
export declare const WARNING_THRESHOLD_BUFFER_TOKENS = 20000;
export declare const ERROR_THRESHOLD_BUFFER_TOKENS = 20000;
export declare const MANUAL_COMPACT_BUFFER_TOKENS = 3000;
export declare function getAutoCompactThreshold(model: string): number;
export declare function calculateTokenWarningState(tokenUsage: number, model: string): {
    percentLeft: number;
    isAboveWarningThreshold: boolean;
    isAboveErrorThreshold: boolean;
    isAboveAutoCompactThreshold: boolean;
    isAtBlockingLimit: boolean;
};
export declare function isAutoCompactEnabled(): boolean;
export declare function shouldAutoCompact(messages: Message[], model: string, querySource?: QuerySource, snipTokensFreed?: number): Promise<boolean>;
export declare function autoCompactIfNeeded(messages: Message[], toolUseContext: ToolUseContext, cacheSafeParams: CacheSafeParams, querySource?: QuerySource, tracking?: AutoCompactTrackingState, snipTokensFreed?: number): Promise<{
    wasCompacted: boolean;
    compactionResult?: CompactionResult;
    consecutiveFailures?: number;
}>;
//# sourceMappingURL=autoCompact.d.ts.map