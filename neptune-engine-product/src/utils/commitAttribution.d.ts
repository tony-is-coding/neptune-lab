import { type UUID } from 'crypto';
import type { AttributionSnapshotMessage, FileAttributionState } from '../types/logs.js';
import { type ModelName } from './model/model.js';
/**
 * Get the repo root for attribution operations.
 * Uses getCwd() which respects agent worktree overrides (AsyncLocalStorage),
 * then resolves to git root to handle `cd subdir` case.
 * Falls back to getOriginalCwd() if git root can't be determined.
 */
export declare function getAttributionRepoRoot(): string;
/**
 * Synchronously return the cached repo classification.
 * Returns null if the async check hasn't run yet.
 */
export declare function getRepoClassCached(): 'internal' | 'external' | 'none' | null;
/**
 * Synchronously return the cached result of isInternalModelRepo().
 * Returns false if the check hasn't run yet (safe default: don't leak).
 */
export declare function isInternalModelRepoCached(): boolean;
/**
 * Check if the current repo is in the allowlist for internal model names.
 * Memoized - only checks once per process.
 */
export declare const isInternalModelRepo: () => Promise<boolean>;
/**
 * Sanitize a surface key to use public model names.
 * Converts internal model variants to their public equivalents.
 */
export declare function sanitizeSurfaceKey(surfaceKey: string): string;
/**
 * Sanitize a model name to its public equivalent.
 * Maps internal variants to their public names based on model family.
 */
export declare function sanitizeModelName(shortName: string): string;
/**
 * Attribution state for tracking Claude's contributions to files.
 */
export type AttributionState = {
    fileStates: Map<string, FileAttributionState>;
    sessionBaselines: Map<string, {
        contentHash: string;
        mtime: number;
    }>;
    surface: string;
    startingHeadSha: string | null;
    promptCount: number;
    promptCountAtLastCommit: number;
    permissionPromptCount: number;
    permissionPromptCountAtLastCommit: number;
    escapeCount: number;
    escapeCountAtLastCommit: number;
};
/**
 * Summary of Claude's contribution for a commit.
 */
export type AttributionSummary = {
    claudePercent: number;
    claudeChars: number;
    humanChars: number;
    surfaces: string[];
};
/**
 * Per-file attribution details for git notes.
 */
export type FileAttribution = {
    claudeChars: number;
    humanChars: number;
    percent: number;
    surface: string;
};
/**
 * Full attribution data for git notes JSON.
 */
export type AttributionData = {
    version: 1;
    summary: AttributionSummary;
    files: Record<string, FileAttribution>;
    surfaceBreakdown: Record<string, {
        claudeChars: number;
        percent: number;
    }>;
    excludedGenerated: string[];
    sessions: string[];
};
/**
 * Get the current client surface from environment.
 */
export declare function getClientSurface(): string;
/**
 * Build a surface key that includes the model name.
 * Format: "surface/model" (e.g., "cli/claude-sonnet")
 */
export declare function buildSurfaceKey(surface: string, model: ModelName): string;
/**
 * Compute SHA-256 hash of content.
 */
export declare function computeContentHash(content: string): string;
/**
 * Normalize file path to relative path from cwd for consistent tracking.
 * Resolves symlinks to handle /tmp vs /private/tmp on macOS.
 */
export declare function normalizeFilePath(filePath: string): string;
/**
 * Expand a relative path to absolute path.
 */
export declare function expandFilePath(filePath: string): string;
/**
 * Create an empty attribution state for a new session.
 */
export declare function createEmptyAttributionState(): AttributionState;
/**
 * Get a file's modification time (mtimeMs), falling back to Date.now() if
 * the file doesn't exist. This is async so it can be precomputed before
 * entering a sync setAppState callback.
 */
export declare function getFileMtime(filePath: string): Promise<number>;
/**
 * Track a file modification by Claude.
 * Called after Edit/Write tool completes.
 */
export declare function trackFileModification(state: AttributionState, filePath: string, oldContent: string, newContent: string, _userModified: boolean, mtime?: number): AttributionState;
/**
 * Track a file creation by Claude (e.g., via bash command).
 * Used when Claude creates a new file through a non-tracked mechanism.
 */
export declare function trackFileCreation(state: AttributionState, filePath: string, content: string, mtime?: number): AttributionState;
/**
 * Track a file deletion by Claude (e.g., via bash rm command).
 * Used when Claude deletes a file through a non-tracked mechanism.
 */
export declare function trackFileDeletion(state: AttributionState, filePath: string, oldContent: string): AttributionState;
/**
 * Track multiple file changes in bulk, mutating a single Map copy.
 * This avoids the O(n²) cost of copying the Map per file when processing
 * large git diffs (e.g., jj operations that touch hundreds of thousands of files).
 */
export declare function trackBulkFileChanges(state: AttributionState, changes: ReadonlyArray<{
    path: string;
    type: 'modified' | 'created' | 'deleted';
    oldContent: string;
    newContent: string;
    mtime?: number;
}>): AttributionState;
/**
 * Calculate final attribution for staged files.
 * Compares session baseline to committed state.
 */
export declare function calculateCommitAttribution(states: AttributionState[], stagedFiles: string[]): Promise<AttributionData>;
/**
 * Get the size of changes for a file from git diff.
 * Returns the number of characters added/removed (absolute difference).
 * For new files, returns the total file size.
 * For deleted files, returns the size of the deleted content.
 */
export declare function getGitDiffSize(filePath: string): Promise<number>;
/**
 * Check if a file was deleted in the staged changes.
 */
export declare function isFileDeleted(filePath: string): Promise<boolean>;
/**
 * Get staged files from git.
 */
export declare function getStagedFiles(): Promise<string[]>;
/**
 * Check if we're in a transient git state (rebase, merge, cherry-pick).
 */
export declare function isGitTransientState(): Promise<boolean>;
/**
 * Convert attribution state to snapshot message for persistence.
 */
export declare function stateToSnapshotMessage(state: AttributionState, messageId: UUID): AttributionSnapshotMessage;
/**
 * Restore attribution state from snapshot messages.
 */
export declare function restoreAttributionStateFromSnapshots(snapshots: AttributionSnapshotMessage[]): AttributionState;
/**
 * Restore attribution state from log snapshots on session resume.
 */
export declare function attributionRestoreStateFromLog(attributionSnapshots: AttributionSnapshotMessage[], onUpdateState: (newState: AttributionState) => void): void;
/**
 * Increment promptCount and save an attribution snapshot.
 * Used to persist the prompt count across compaction.
 *
 * @param attribution - Current attribution state
 * @param saveSnapshot - Function to save the snapshot (allows async handling by caller)
 * @returns New attribution state with incremented promptCount
 */
export declare function incrementPromptCount(attribution: AttributionState, saveSnapshot: (snapshot: AttributionSnapshotMessage) => void): AttributionState;
//# sourceMappingURL=commitAttribution.d.ts.map