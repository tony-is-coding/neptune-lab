export declare function clearAllPluginCaches(): void;
export declare function clearAllCaches(): void;
/**
 * Mark a plugin version as orphaned.
 * Called when a plugin is uninstalled or updated to a new version.
 */
export declare function markPluginVersionOrphaned(versionPath: string): Promise<void>;
/**
 * Clean up orphaned plugin versions that have been orphaned for more than 7 days.
 *
 * Pass 1: Remove .orphaned_at from installed versions (clears stale markers)
 * Pass 2: For each cached version not in installed_plugins.json:
 *   - If no .orphaned_at exists: create it (handles old CC versions, manual edits)
 *   - If .orphaned_at exists and > 7 days old: delete the version
 */
export declare function cleanupOrphanedPluginVersionsInBackground(): Promise<void>;
//# sourceMappingURL=cacheUtils.d.ts.map