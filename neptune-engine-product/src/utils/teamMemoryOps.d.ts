import { isTeamMemFile } from '../memdir/teamMemPaths.js';
export { isTeamMemFile };
/**
 * Check if a search tool use targets team memory files by examining its path.
 */
export declare function isTeamMemorySearch(toolInput: unknown): boolean;
/**
 * Check if a Write or Edit tool use targets a team memory file.
 */
export declare function isTeamMemoryWriteOrEdit(toolName: string, toolInput: unknown): boolean;
/**
 * Append team memory summary parts to the parts array.
 * Encapsulates all team memory verb/string logic for getSearchReadSummaryText.
 */
export declare function appendTeamMemorySummaryParts(memoryCounts: {
    teamMemoryReadCount?: number;
    teamMemorySearchCount?: number;
    teamMemoryWriteCount?: number;
}, isActive: boolean, parts: string[]): void;
//# sourceMappingURL=teamMemoryOps.d.ts.map