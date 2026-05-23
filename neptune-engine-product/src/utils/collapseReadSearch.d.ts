import { type Tools } from '../Tool.js';
import type { CollapsedReadSearchGroup, CollapsibleMessage, RenderableMessage } from '../types/message.js';
/**
 * Result of checking if a tool use is a search or read operation.
 */
export type SearchOrReadResult = {
    isCollapsible: boolean;
    isSearch: boolean;
    isRead: boolean;
    isList: boolean;
    isREPL: boolean;
    /** True if this is a Write/Edit targeting a memory file */
    isMemoryWrite: boolean;
    /**
     * True for meta-operations that should be absorbed into a collapse group
     * without incrementing any count (Snip, ToolSearch). They remain visible
     * in verbose mode via the groupMessages iteration.
     */
    isAbsorbedSilently: boolean;
    /** MCP server name when this is an MCP tool */
    mcpServerName?: string;
    /** Bash command that is NOT a search/read (under fullscreen mode) */
    isBash?: boolean;
};
/**
 * Checks if a tool is a search/read operation using the tool's isSearchOrReadCommand method.
 * Also treats Write/Edit of memory files as collapsible.
 * Returns detailed information about whether it's a search or read operation.
 */
export declare function getToolSearchOrReadInfo(toolName: string, toolInput: unknown, tools: Tools): SearchOrReadResult;
/**
 * Check if a tool_use content block is a search/read operation.
 * Returns { isSearch, isRead, isREPL } if it's a collapsible search/read, null otherwise.
 */
export declare function getSearchOrReadFromContent(content: {
    type: string;
    name?: string;
    input?: unknown;
} | undefined, tools: Tools): {
    isSearch: boolean;
    isRead: boolean;
    isList: boolean;
    isREPL: boolean;
    isMemoryWrite: boolean;
    isAbsorbedSilently: boolean;
    mcpServerName?: string;
    isBash?: boolean;
} | null;
/**
 * Get all tool use IDs from a collapsed read/search group.
 */
export declare function getToolUseIdsFromCollapsedGroup(message: CollapsedReadSearchGroup): string[];
/**
 * Check if any tool in a collapsed group is in progress.
 */
export declare function hasAnyToolInProgress(message: CollapsedReadSearchGroup, inProgressToolUseIDs: Set<string>): boolean;
/**
 * Get the underlying NormalizedMessage for display (timestamp/model).
 * Handles nested GroupedToolUseMessage within collapsed groups.
 * Returns a NormalizedAssistantMessage or NormalizedUserMessage (never GroupedToolUseMessage).
 */
export declare function getDisplayMessageFromCollapsed(message: CollapsedReadSearchGroup): Exclude<CollapsibleMessage, {
    type: 'grouped_tool_use';
}>;
/**
 * Collapse consecutive Read/Search operations into summary groups.
 *
 * Rules:
 * - Groups consecutive search/read tool uses (Grep, Glob, Read, and Bash search/read commands)
 * - Includes their corresponding tool results in the group
 * - Breaks groups when assistant text appears
 */
export declare function collapseReadSearchGroups(messages: RenderableMessage[], tools: Tools): RenderableMessage[];
/**
 * Generate a summary text for search/read/REPL counts.
 * @param searchCount Number of search operations
 * @param readCount Number of read operations
 * @param isActive Whether the group is still in progress (use present tense) or completed (use past tense)
 * @param replCount Number of REPL executions (optional)
 * @param memoryCounts Optional memory file operation counts
 * @returns Summary text like "Searching for 3 patterns, reading 2 files, REPL'd 5 times…"
 */
export declare function getSearchReadSummaryText(searchCount: number, readCount: number, isActive: boolean, replCount?: number, memoryCounts?: {
    memorySearchCount: number;
    memoryReadCount: number;
    memoryWriteCount: number;
    teamMemorySearchCount?: number;
    teamMemoryReadCount?: number;
    teamMemoryWriteCount?: number;
}, listCount?: number): string;
/**
 * Summarize a list of recent tool activities into a compact description.
 * Rolls up trailing consecutive search/read operations using pre-computed
 * isSearch/isRead classifications from recording time. Falls back to the
 * last activity's description for non-collapsible tool uses.
 */
export declare function summarizeRecentActivities(activities: readonly {
    activityDescription?: string;
    isSearch?: boolean;
    isRead?: boolean;
}[]): string | undefined;
//# sourceMappingURL=collapseReadSearch.d.ts.map