/**
 * Manages plugin installation metadata stored in installed_plugins.json
 *
 * This module separates plugin installation state (global) from enabled/disabled
 * state (per-repository). The installed_plugins.json file tracks:
 * - Which plugins are installed globally
 * - Installation metadata (version, timestamps, paths)
 *
 * The enabled/disabled state remains in .claude/settings.json for per-repo control.
 *
 * Rationale: Installation is global (a plugin is either on disk or not), while
 * enabled/disabled state is per-repository (different projects may want different
 * plugins active).
 */
import { type InstalledPlugin, type InstalledPluginsFileV2, type PluginInstallationEntry, type PluginScope } from './schemas.js';
export type PersistableScope = Exclude<PluginScope, never>;
/**
 * Get the path to the installed_plugins.json file
 */
export declare function getInstalledPluginsFilePath(): string;
/**
 * Get the path to the legacy installed_plugins_v2.json file.
 * Used only during migration to consolidate into single file.
 */
export declare function getInstalledPluginsV2FilePath(): string;
/**
 * Clear the installed plugins cache
 * Call this when the file is modified to force a reload
 *
 * Note: This also clears the in-memory session state (inMemoryInstalledPlugins).
 * In most cases, this is only called during initialization or testing.
 * For background updates, use updateInstallationPathOnDisk() which preserves
 * the in-memory state.
 */
export declare function clearInstalledPluginsCache(): void;
/**
 * Migrate to single plugin file format.
 *
 * This consolidates the V1/V2 dual-file system into a single file:
 * 1. If installed_plugins_v2.json exists: copy to installed_plugins.json (version=2), delete V2 file
 * 2. If only installed_plugins.json exists with version=1: convert to version=2 in-place
 * 3. Clean up legacy non-versioned cache directories
 *
 * This migration runs once per session at startup.
 */
export declare function migrateToSinglePluginFile(): void;
/**
 * Reset migration state (for testing)
 */
export declare function resetMigrationState(): void;
/**
 * Load installed plugins in V2 format.
 *
 * Reads from installed_plugins.json. If file has version=1,
 * converts to V2 format in memory.
 *
 * @returns V2 format data with array-per-plugin structure
 */
export declare function loadInstalledPluginsV2(): InstalledPluginsFileV2;
/**
 * Add or update a plugin installation entry at a specific scope.
 * Used for V2 format where each plugin has an array of installations.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @param scope - Installation scope (managed/user/project/local)
 * @param installPath - Path to versioned plugin directory
 * @param metadata - Additional installation metadata
 * @param projectPath - Project path (required for project/local scopes)
 */
export declare function addPluginInstallation(pluginId: string, scope: PersistableScope, installPath: string, metadata: Partial<PluginInstallationEntry>, projectPath?: string): void;
/**
 * Remove a plugin installation entry from a specific scope.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @param scope - Installation scope to remove
 * @param projectPath - Project path (for project/local scopes)
 */
export declare function removePluginInstallation(pluginId: string, scope: PersistableScope, projectPath?: string): void;
/**
 * Get the in-memory installed plugins (session state).
 * This snapshot is loaded at startup and used for the entire session.
 * It is NOT updated by background operations.
 *
 * @returns V2 format data representing the session's view of installed plugins
 */
export declare function getInMemoryInstalledPlugins(): InstalledPluginsFileV2;
/**
 * Load installed plugins directly from disk, bypassing all caches.
 * Used by background updater to check for changes without affecting
 * the running session's view.
 *
 * @returns V2 format data read fresh from disk
 */
export declare function loadInstalledPluginsFromDisk(): InstalledPluginsFileV2;
/**
 * Update a plugin's install path on disk only, without modifying in-memory state.
 * Used by background updater to record new version on disk while session
 * continues using the old version.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @param scope - Installation scope
 * @param projectPath - Project path (for project/local scopes)
 * @param newPath - New install path (to new version directory)
 * @param newVersion - New version string
 */
export declare function updateInstallationPathOnDisk(pluginId: string, scope: PersistableScope, projectPath: string | undefined, newPath: string, newVersion: string, gitCommitSha?: string): void;
/**
 * Check if there are pending updates (disk differs from memory).
 * This happens when background updater has downloaded new versions.
 *
 * @returns true if any plugin has a different install path on disk vs memory
 */
export declare function hasPendingUpdates(): boolean;
/**
 * Get the count of pending updates (installations where disk differs from memory).
 *
 * @returns Number of installations with pending updates
 */
export declare function getPendingUpdateCount(): number;
/**
 * Get details about pending updates for display.
 *
 * @returns Array of objects with pluginId, scope, oldVersion, newVersion
 */
export declare function getPendingUpdatesDetails(): Array<{
    pluginId: string;
    scope: string;
    oldVersion: string;
    newVersion: string;
}>;
/**
 * Reset the in-memory session state.
 * This should only be called at startup or for testing.
 */
export declare function resetInMemoryState(): void;
/**
 * Initialize the versioned plugins system.
 * This triggers V1→V2 migration and initializes the in-memory session state.
 *
 * This should be called early during startup in all modes (REPL and headless).
 *
 * @returns Promise that resolves when initialization is complete
 */
export declare function initializeVersionedPlugins(): Promise<void>;
/**
 * Remove all plugin entries belonging to a specific marketplace from installed_plugins.json.
 *
 * Loads V2 data once, finds all plugin IDs matching the `@{marketplaceName}` suffix,
 * collects their install paths, removes the entries, and saves once.
 *
 * @param marketplaceName - The marketplace name (matched against `@{name}` suffix)
 * @returns orphanedPaths (for markPluginVersionOrphaned) and removedPluginIds
 *   (for deletePluginOptions) from the removed entries
 */
export declare function removeAllPluginsForMarketplace(marketplaceName: string): {
    orphanedPaths: string[];
    removedPluginIds: string[];
};
/**
 * Predicate: is this installation relevant to the current project context?
 *
 * V2 installed_plugins.json may contain project-scoped entries from OTHER
 * projects (a single user-level file tracks all scopes). Callers asking
 * "is this plugin installed" almost always mean "installed in a way that's
 * active here" — not "installed anywhere on this machine". See #29608:
 * DiscoverPlugins.tsx was hiding plugins that were only installed in an
 * unrelated project.
 *
 * - user/managed scopes: always relevant (global)
 * - project/local scopes: only if projectPath matches the current project
 *
 * getOriginalCwd() (not getCwd()) because "current project" is where Claude
 * Code was launched from, not wherever the working directory has drifted to.
 */
export declare function isInstallationRelevantToCurrentProject(inst: PluginInstallationEntry): boolean;
/**
 * Check if a plugin is installed in a way relevant to the current project.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @returns True if the plugin has a user/managed-scoped installation, OR a
 *   project/local-scoped installation whose projectPath matches the current
 *   project. Returns false for plugins only installed in other projects.
 */
export declare function isPluginInstalled(pluginId: string): boolean;
/**
 * True only if the plugin has a USER or MANAGED scope installation.
 *
 * Use this in UI flows that decide whether to offer installation at all.
 * A user/managed-scope install means the plugin is available everywhere —
 * there's nothing the user can add. A project/local-scope install means the
 * user might still want to install at user scope to make it global.
 *
 * gh-29997 / gh-29240 / gh-29392: the browse UI was blocking on
 * isPluginInstalled() which returns true for project-scope installs,
 * preventing users from adding a user-scope entry for the same plugin.
 * The backend (installPluginOp → addInstalledPlugin) already supports
 * multiple scope entries per plugin — only the UI gate was wrong.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 */
export declare function isPluginGloballyInstalled(pluginId: string): boolean;
/**
 * Add or update a plugin's installation metadata
 *
 * Implements double-write: updates both V1 and V2 files.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @param metadata - Installation metadata
 * @param scope - Installation scope (defaults to 'user' for backward compatibility)
 * @param projectPath - Project path (for project/local scopes)
 */
export declare function addInstalledPlugin(pluginId: string, metadata: InstalledPlugin, scope?: PersistableScope, projectPath?: string): void;
/**
 * Remove a plugin from the installed plugins registry
 * This should be called when a plugin is uninstalled.
 *
 * Note: This function only updates the registry file. To fully uninstall,
 * call deletePluginCache() afterward to remove the physical files.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @returns The removed plugin metadata, or undefined if it wasn't installed
 */
export declare function removeInstalledPlugin(pluginId: string): InstalledPlugin | undefined;
/**
 * Delete a plugin's cache directory
 * This physically removes the plugin files from disk
 *
 * @param installPath - Absolute path to the plugin's cache directory
 */
/**
 * Export getGitCommitSha for use by pluginInstallationHelpers
 */
export { getGitCommitSha };
export declare function deletePluginCache(installPath: string): void;
/**
 * Get the git commit SHA from a git repository directory
 * Returns undefined if not a git repo or if operation fails
 */
declare function getGitCommitSha(dirPath: string): Promise<string | undefined>;
/**
 * Sync installed_plugins.json with enabledPlugins from settings
 *
 * Checks the schema version and only updates if:
 * - File doesn't exist (version 0 → current)
 * - Schema version is outdated (old version → current)
 * - New plugins appear in enabledPlugins
 *
 * This version-based approach makes it easy to add new fields in the future:
 * 1. Increment CURRENT_SCHEMA_VERSION
 * 2. Add migration logic for the new version
 * 3. File is automatically updated on next startup
 *
 * For each plugin in enabledPlugins that's not in installed_plugins.json:
 * - Queries marketplace to get actual install path
 * - Extracts version from manifest if available
 * - Captures git commit SHA for git-based plugins
 *
 * Being present in enabledPlugins (whether true or false) indicates the plugin
 * has been installed. The enabled/disabled state remains in settings.json.
 */
export declare function migrateFromEnabledPlugins(): Promise<void>;
//# sourceMappingURL=installedPluginsManager.d.ts.map