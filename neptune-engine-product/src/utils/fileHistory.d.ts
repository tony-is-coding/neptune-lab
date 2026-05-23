import { type UUID } from 'crypto';
import type { Stats } from 'fs';
import type { LogOption } from 'src/types/logs.js';
type BackupFileName = string | null;
export type FileHistoryBackup = {
    backupFileName: BackupFileName;
    version: number;
    backupTime: Date;
};
export type FileHistorySnapshot = {
    messageId: UUID;
    trackedFileBackups: Record<string, FileHistoryBackup>;
    timestamp: Date;
};
export type FileHistoryState = {
    snapshots: FileHistorySnapshot[];
    trackedFiles: Set<string>;
    snapshotSequence: number;
};
export type DiffStats = {
    filesChanged?: string[];
    insertions: number;
    deletions: number;
} | undefined;
export declare function fileHistoryEnabled(): boolean;
/**
 * Tracks a file edit (and add) by creating a backup of its current contents (if necessary).
 *
 * This must be called before the file is actually added or edited, so we can save
 * its contents before the edit.
 */
export declare function fileHistoryTrackEdit(updateFileHistoryState: (updater: (prev: FileHistoryState) => FileHistoryState) => void, filePath: string, messageId: UUID): Promise<void>;
/**
 * Adds a snapshot in the file history and backs up any modified tracked files.
 */
export declare function fileHistoryMakeSnapshot(updateFileHistoryState: (updater: (prev: FileHistoryState) => FileHistoryState) => void, messageId: UUID): Promise<void>;
/**
 * Rewinds the file system to a previous snapshot.
 */
export declare function fileHistoryRewind(updateFileHistoryState: (updater: (prev: FileHistoryState) => FileHistoryState) => void, messageId: UUID): Promise<void>;
export declare function fileHistoryCanRestore(state: FileHistoryState, messageId: UUID): boolean;
/**
 * Computes diff stats for a file snapshot by counting the number of files that would be changed
 * if reverting to that snapshot.
 */
export declare function fileHistoryGetDiffStats(state: FileHistoryState, messageId: UUID): Promise<DiffStats>;
/**
 * Lightweight boolean-only check: would rewinding to this message change any
 * file on disk? Uses the same stat/content comparison as the non-dry-run path
 * of applySnapshot (checkOriginFileChanged) instead of computeDiffStatsForFile,
 * so it never calls diffLines. Early-exits on the first changed file. Use when
 * the caller only needs a yes/no answer; fileHistoryGetDiffStats remains for
 * callers that display insertions/deletions.
 */
export declare function fileHistoryHasAnyChanges(state: FileHistoryState, messageId: UUID): Promise<boolean>;
/**
 * Checks if the original file has been changed compared to the backup file.
 * Optionally reuses a pre-fetched stat for the original file (when the caller
 * already stat'd it to check existence, we avoid a second syscall).
 *
 * Exported for testing.
 */
export declare function checkOriginFileChanged(originalFile: string, backupFileName: string, originalStatsHint?: Stats): Promise<boolean>;
/**
 * Restores file history snapshot state for a given log option.
 */
export declare function fileHistoryRestoreStateFromLog(fileHistorySnapshots: FileHistorySnapshot[], onUpdateState: (newState: FileHistoryState) => void): void;
/**
 * Copy file history snapshots for a given log option.
 */
export declare function copyFileHistoryForResume(log: LogOption): Promise<void>;
export {};
//# sourceMappingURL=fileHistory.d.ts.map