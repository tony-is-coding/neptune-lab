export {};
export type CachedMCState = {
    registeredTools: Set<string>;
    toolOrder: string[];
    deletedRefs: Set<string>;
    pinnedEdits: PinnedCacheEdits[];
    toolsSentToAPI: boolean;
};
export type CacheEditsBlock = {
    type: 'cache_edits';
    edits: Array<{
        type: string;
        tool_use_id: string;
    }>;
};
export type PinnedCacheEdits = {
    userMessageIndex: number;
    block: CacheEditsBlock;
};
export declare const isCachedMicrocompactEnabled: () => boolean;
export declare const isModelSupportedForCacheEditing: (model: string) => boolean;
export declare const getCachedMCConfig: () => {
    triggerThreshold: number;
    keepRecent: number;
};
export declare const createCachedMCState: () => CachedMCState;
export declare const markToolsSentToAPI: (state: CachedMCState) => void;
export declare const resetCachedMCState: (state: CachedMCState) => void;
export declare const registerToolResult: (state: CachedMCState, toolId: string) => void;
export declare const registerToolMessage: (state: CachedMCState, groupIds: string[]) => void;
export declare const getToolResultsToDelete: (state: CachedMCState) => string[];
export declare const createCacheEditsBlock: (state: CachedMCState, toolIds: string[]) => CacheEditsBlock | null;
//# sourceMappingURL=cachedMicrocompact.d.ts.map