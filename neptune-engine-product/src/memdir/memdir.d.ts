export declare const ENTRYPOINT_NAME = "MEMORY.md";
export declare const MAX_ENTRYPOINT_LINES = 200;
export declare const MAX_ENTRYPOINT_BYTES = 25000;
export type EntrypointTruncation = {
    content: string;
    lineCount: number;
    byteCount: number;
    wasLineTruncated: boolean;
    wasByteTruncated: boolean;
};
/**
 * Truncate MEMORY.md content to the line AND byte caps, appending a warning
 * that names which cap fired. Line-truncates first (natural boundary), then
 * byte-truncates at the last newline before the cap so we don't cut mid-line.
 *
 * Shared by buildMemoryPrompt and claudemd getMemoryFiles (previously
 * duplicated the line-only logic).
 */
export declare function truncateEntrypointContent(raw: string): EntrypointTruncation;
/**
 * Shared guidance text appended to each memory directory prompt line.
 * Shipped because Claude was burning turns on `ls`/`mkdir -p` before writing.
 * Harness guarantees the directory exists via ensureMemoryDirExists().
 */
export declare const DIR_EXISTS_GUIDANCE = "This directory already exists \u2014 write to it directly with the Write tool (do not run mkdir or check for its existence).";
export declare const DIRS_EXIST_GUIDANCE = "Both directories already exist \u2014 write to them directly with the Write tool (do not run mkdir or check for their existence).";
/**
 * Ensure a memory directory exists. Idempotent — called from loadMemoryPrompt
 * (once per session via systemPromptSection cache) so the model can always
 * write without checking existence first. FsOperations.mkdir is recursive
 * by default and already swallows EEXIST, so the full parent chain
 * (~/.claude/projects/<slug>/memory/) is created in one call with no
 * try/catch needed for the happy path.
 */
export declare function ensureMemoryDirExists(memoryDir: string): Promise<void>;
/**
 * Build the typed-memory behavioral instructions (without MEMORY.md content).
 * Constrains memories to a closed four-type taxonomy (user / feedback / project /
 * reference) — content that is derivable from the current project state (code
 * patterns, architecture, git history) is explicitly excluded.
 *
 * Individual-only variant: no `## Memory scope` section, no <scope> tags
 * in type blocks, and team/private qualifiers stripped from examples.
 *
 * Used by both buildMemoryPrompt (agent memory, includes content) and
 * loadMemoryPrompt (system prompt, content injected via user context instead).
 */
export declare function buildMemoryLines(displayName: string, memoryDir: string, extraGuidelines?: string[], skipIndex?: boolean): string[];
/**
 * Build the typed-memory prompt with MEMORY.md content included.
 * Used by agent memory (which has no getClaudeMds() equivalent).
 */
export declare function buildMemoryPrompt(params: {
    displayName: string;
    memoryDir: string;
    extraGuidelines?: string[];
}): string;
/**
 * Build the "Searching past context" section if the feature gate is enabled.
 */
export declare function buildSearchingPastContextSection(autoMemDir: string): string[];
/**
 * Load the unified memory prompt for inclusion in the system prompt.
 * Dispatches based on which memory systems are enabled:
 *   - auto + team: combined prompt (both directories)
 *   - auto only: memory lines (single directory)
 * Team memory requires auto memory (enforced by isTeamMemoryEnabled), so
 * there is no team-only branch.
 *
 * Returns null when auto memory is disabled.
 */
export declare function loadMemoryPrompt(): Promise<string | null>;
//# sourceMappingURL=memdir.d.ts.map