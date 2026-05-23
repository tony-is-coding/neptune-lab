/**
 * Portable session storage utilities.
 *
 * Pure Node.js — no internal dependencies on logging, experiments, or feature
 * flags. Shared between the CLI (src/utils/sessionStorage.ts) and the VS Code
 * extension (packages/claude-vscode/src/common-host/sessionStorage.ts).
 */
import type { UUID } from 'crypto';
/** Size of the head/tail buffer for lite metadata reads. */
export declare const LITE_READ_BUF_SIZE = 65536;
export declare function validateUuid(maybeUuid: unknown): UUID | null;
/**
 * Unescape a JSON string value extracted as raw text.
 * Only allocates a new string when escape sequences are present.
 */
export declare function unescapeJsonString(raw: string): string;
/**
 * Extracts a simple JSON string field value from raw text without full parsing.
 * Looks for `"key":"value"` or `"key": "value"` patterns.
 * Returns the first match, or undefined if not found.
 */
export declare function extractJsonStringField(text: string, key: string): string | undefined;
/**
 * Like extractJsonStringField but finds the LAST occurrence.
 * Useful for fields that are appended (customTitle, tag, etc.).
 */
export declare function extractLastJsonStringField(text: string, key: string): string | undefined;
/**
 * Extracts the first meaningful user prompt from a JSONL head chunk.
 *
 * Skips tool_result messages, isMeta, isCompactSummary, command-name messages,
 * and auto-generated patterns (session hooks, tick, IDE metadata, etc.).
 * Truncates to 200 chars.
 */
export declare function extractFirstPromptFromHead(head: string): string;
/**
 * Reads the first and last LITE_READ_BUF_SIZE bytes of a file.
 *
 * For small files where head covers tail, `tail === head`.
 * Accepts a shared Buffer to avoid per-file allocation overhead.
 * Returns `{ head: '', tail: '' }` on any error.
 */
export declare function readHeadAndTail(filePath: string, fileSize: number, buf: Buffer): Promise<{
    head: string;
    tail: string;
}>;
export type LiteSessionFile = {
    mtime: number;
    size: number;
    head: string;
    tail: string;
};
/**
 * Opens a single session file, stats it, and reads head + tail in one fd.
 * Allocates its own buffer — safe for concurrent use with Promise.all.
 * Returns null on any error.
 */
export declare function readSessionLite(filePath: string): Promise<LiteSessionFile | null>;
/**
 * Maximum length for a single filesystem path component (directory or file name).
 * Most filesystems (ext4, APFS, NTFS) limit individual components to 255 bytes.
 * We use 200 to leave room for the hash suffix and separator.
 */
export declare const MAX_SANITIZED_LENGTH = 200;
/**
 * Makes a string safe for use as a directory or file name.
 * Replaces all non-alphanumeric characters with hyphens.
 * This ensures compatibility across all platforms, including Windows
 * where characters like colons are reserved.
 *
 * For deeply nested paths that would exceed filesystem limits (255 bytes),
 * truncates and appends a hash suffix for uniqueness.
 *
 * @param name - The string to make safe (e.g., '/Users/foo/my-project' or 'plugin:name:server')
 * @returns A safe name (e.g., '-Users-foo-my-project' or 'plugin-name-server')
 */
export declare function sanitizePath(name: string): string;
export declare function getProjectsDir(): string;
export declare function getProjectDir(projectDir: string): string;
/**
 * Resolves a directory path to its canonical form using realpath + NFC
 * normalization. Falls back to NFC-only if realpath fails (e.g., the
 * directory doesn't exist yet). Ensures symlinked paths (e.g.,
 * /tmp → /private/tmp on macOS) resolve to the same project directory.
 */
export declare function canonicalizePath(dir: string): Promise<string>;
/**
 * Finds the project directory for a given path, tolerating hash mismatches
 * for long paths (>200 chars). The CLI uses Bun.hash while the SDK under
 * Node.js uses simpleHash — for paths that exceed MAX_SANITIZED_LENGTH,
 * these produce different directory suffixes. This function falls back to
 * prefix-based scanning when the exact match doesn't exist.
 */
export declare function findProjectDir(projectPath: string): Promise<string | undefined>;
/**
 * Resolve a sessionId to its on-disk JSONL file path.
 *
 * When `dir` is provided: canonicalize it, look in that project's directory
 * (with findProjectDir fallback for Bun/Node hash mismatches), then fall back
 * to sibling git worktrees. `projectPath` in the result is the canonical
 * user-facing directory the file was found under.
 *
 * When `dir` is omitted: scan all project directories under ~/.claude/projects/.
 * `projectPath` is undefined in this case (no meaningful project path to report).
 *
 * Existence is checked by stat (operate-then-catch-ENOENT, no existsSync).
 * Zero-byte files are treated as not-found so callers continue searching past
 * a truncated copy to find a valid one in a sibling directory.
 *
 * `fileSize` is returned so callers (loadSessionBuffer) don't need to re-stat.
 *
 * Shared by getSessionInfoImpl and getSessionMessagesImpl — the caller
 * invokes its own reader (readSessionLite / loadSessionBuffer) on the
 * resolved path.
 */
export declare function resolveSessionFilePath(sessionId: string, dir?: string): Promise<{
    filePath: string;
    projectPath: string | undefined;
    fileSize: number;
} | undefined>;
/**
 * File size below which precompact filtering is skipped.
 * Large sessions (>5 MB) almost always have compact boundaries — they got big
 * because of many turns triggering auto-compact.
 */
export declare const SKIP_PRECOMPACT_THRESHOLD: number;
export declare function readTranscriptForLoad(filePath: string, fileSize: number): Promise<{
    boundaryStartOffset: number;
    postBoundaryBuf: Buffer;
    hasPreservedSegment: boolean;
}>;
//# sourceMappingURL=sessionStoragePortable.d.ts.map