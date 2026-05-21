import type { Message } from '../../types/message.js';
import type { ToolUseContext } from '../../Tool.js';
import type { QuerySource } from '../../constants/querySource.js';
export interface ContextCollapseHealth {
    totalSpawns: number;
    totalErrors: number;
    lastError: string | null;
    emptySpawnWarningEmitted: boolean;
    totalEmptySpawns: number;
}
export interface ContextCollapseStats {
    collapsedSpans: number;
    collapsedMessages: number;
    stagedSpans: number;
    health: ContextCollapseHealth;
}
export interface CollapseResult {
    messages: Message[];
}
export interface DrainResult {
    committed: number;
    messages: Message[];
}
export declare const getStats: () => ContextCollapseStats;
export declare const isContextCollapseEnabled: () => boolean;
export declare const subscribe: (callback: () => void) => () => void;
export declare const applyCollapsesIfNeeded: (messages: Message[], toolUseContext: ToolUseContext, querySource: QuerySource) => Promise<CollapseResult>;
export declare const isWithheldPromptTooLong: (message: Message, isPromptTooLongMessage: (msg: Message) => boolean, querySource: QuerySource) => boolean;
export declare const recoverFromOverflow: (messages: Message[], querySource: QuerySource) => DrainResult;
export declare const resetContextCollapse: () => void;
export declare const initContextCollapse: () => void;
//# sourceMappingURL=index.d.ts.map