export type RelevantMemory = {
    path: string;
    mtimeMs: number;
};
/**
 * Find memory files relevant to a query by scanning memory file headers
 * and asking Sonnet to select the most relevant ones.
 *
 * Returns absolute file paths + mtime of the most relevant memories
 * (up to 5). Excludes MEMORY.md (already loaded in system prompt).
 * mtime is threaded through so callers can surface freshness to the
 * main model without a second stat.
 *
 * `alreadySurfaced` filters paths shown in prior turns before the
 * Sonnet call, so the selector spends its 5-slot budget on fresh
 * candidates instead of re-picking files the caller will discard.
 */
export declare function findRelevantMemories(query: string, memoryDir: string, signal: AbortSignal, recentTools?: readonly string[], alreadySurfaced?: ReadonlySet<string>): Promise<RelevantMemory[]>;
//# sourceMappingURL=findRelevantMemories.d.ts.map