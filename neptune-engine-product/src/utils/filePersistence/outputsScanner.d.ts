/**
 * Outputs directory scanner for file persistence
 *
 * This module provides utilities to:
 * - Detect the session type from environment variables
 * - Capture turn start timestamp
 * - Find modified files by comparing file mtimes against turn start time
 */
import type { EnvironmentKind } from '../teleport/environments.js';
import type { TurnStartTime } from './types.js';
/** Shared debug logger for file persistence modules */
export declare function logDebug(message: string): void;
/**
 * Get the environment kind from CLAUDE_CODE_ENVIRONMENT_KIND.
 * Returns null if not set or not a recognized value.
 */
export declare function getEnvironmentKind(): EnvironmentKind | null;
/**
 * Find files that have been modified since the turn started.
 * Returns paths of files with mtime >= turnStartTime.
 *
 * Uses recursive directory listing and parallelized stat calls for efficiency.
 *
 * @param turnStartTime - The timestamp when the turn started
 * @param outputsDir - The directory to scan for modified files
 */
export declare function findModifiedFiles(turnStartTime: TurnStartTime, outputsDir: string): Promise<string[]>;
//# sourceMappingURL=outputsScanner.d.ts.map