/**
 * Shared helper functions for plugin installation
 *
 * This module contains common utilities used across the plugin installation
 * system to reduce code duplication and improve maintainability.
 */
import { type ResolutionResult } from './dependencyResolver.js';
import { type PluginMarketplaceEntry, type PluginScope } from './schemas.js';
/**
 * Plugin installation metadata for installed_plugins.json
 */
export type PluginInstallationInfo = {
    pluginId: string;
    installPath: string;
    version?: string;
};
/**
 * Get current ISO timestamp
 */
export declare function getCurrentTimestamp(): string;
/**
 * Validate that a resolved path stays within a base directory.
 * Prevents path traversal attacks where malicious paths like './../../../etc/passwd'
 * could escape the expected directory.
 *
 * @param basePath - The base directory that the resolved path must stay within
 * @param relativePath - The relative path to validate
 * @returns The validated absolute path
 * @throws Error if the path would escape the base directory
 */
export declare function validatePathWithinBase(basePath: string, relativePath: string): string;
/**
 * Cache a plugin (local or external) and add it to installed_plugins.json
 *
 * This function combines the common pattern of:
 * 1. Caching a plugin to ~/.claude/plugins/cache/
 * 2. Adding it to the installed plugins registry
 *
 * Both local plugins (with string source like "./path") and external plugins
 * (with object source like {source: "github", ...}) are cached to the same
 * location to ensure consistent behavior.
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @param entry - Plugin marketplace entry
 * @param scope - Installation scope (user, project, local, or managed). Defaults to 'user'.
 *                'managed' scope is used for plugins installed automatically from managed settings.
 * @param projectPath - Project path (required for project/local scopes)
 * @param localSourcePath - For local plugins, the resolved absolute path to the source directory
 * @returns The installation path
 */
export declare function cacheAndRegisterPlugin(pluginId: string, entry: PluginMarketplaceEntry, scope?: PluginScope, projectPath?: string, localSourcePath?: string): Promise<string>;
/**
 * Register a plugin installation without caching
 *
 * Used for local plugins that are already on disk and don't need remote caching.
 * External plugins should use cacheAndRegisterPlugin() instead.
 *
 * @param info - Plugin installation information
 * @param scope - Installation scope (user, project, local, or managed). Defaults to 'user'.
 *                'managed' scope is used for plugins registered from managed settings.
 * @param projectPath - Project path (required for project/local scopes)
 */
export declare function registerPluginInstallation(info: PluginInstallationInfo, scope?: PluginScope, projectPath?: string): void;
/**
 * Parse plugin ID into components
 *
 * @param pluginId - Plugin ID in "plugin@marketplace" format
 * @returns Parsed components or null if invalid
 */
export declare function parsePluginId(pluginId: string): {
    name: string;
    marketplace: string;
} | null;
/**
 * Structured result from the install core. Wrappers format messages and
 * handle analytics/error-catching around this.
 */
export type InstallCoreResult = {
    ok: true;
    closure: string[];
    depNote: string;
} | {
    ok: false;
    reason: 'local-source-no-location';
    pluginName: string;
} | {
    ok: false;
    reason: 'settings-write-failed';
    message: string;
} | {
    ok: false;
    reason: 'resolution-failed';
    resolution: ResolutionResult & {
        ok: false;
    };
} | {
    ok: false;
    reason: 'blocked-by-policy';
    pluginName: string;
} | {
    ok: false;
    reason: 'dependency-blocked-by-policy';
    pluginName: string;
    blockedDependency: string;
};
/**
 * Format a failed ResolutionResult into a user-facing message. Unified on
 * the richer CLI messages (the "Is the X marketplace added?" hint is useful
 * for UI users too).
 */
export declare function formatResolutionError(r: ResolutionResult & {
    ok: false;
}): string;
/**
 * Core plugin install logic, shared by the CLI path (`installPluginOp`) and
 * the interactive UI path (`installPluginFromMarketplace`). Given a
 * pre-resolved marketplace entry, this:
 *
 *   1. Guards against local-source plugins without a marketplace install
 *      location (would silently no-op otherwise).
 *   2. Resolves the transitive dependency closure (when PLUGIN_DEPENDENCIES
 *      is on; trivial single-plugin closure otherwise).
 *   3. Writes the entire closure to enabledPlugins in one settings update.
 *   4. Caches each closure member (downloads/copies sources as needed).
 *   5. Clears memoization caches.
 *
 * Returns a structured result. Message formatting, analytics, and top-level
 * error wrapping stay in the caller-specific wrappers.
 *
 * @param marketplaceInstallLocation Pass this if the caller already has it
 *   (from a prior marketplace search) to avoid a redundant lookup.
 */
export declare function installResolvedPlugin({ pluginId, entry, scope, marketplaceInstallLocation, }: {
    pluginId: string;
    entry: PluginMarketplaceEntry;
    scope: 'user' | 'project' | 'local';
    marketplaceInstallLocation?: string;
}): Promise<InstallCoreResult>;
/**
 * Result of a plugin installation operation
 */
export type InstallPluginResult = {
    success: true;
    message: string;
} | {
    success: false;
    error: string;
};
/**
 * Parameters for installing a plugin from marketplace
 */
export type InstallPluginParams = {
    pluginId: string;
    entry: PluginMarketplaceEntry;
    marketplaceName: string;
    scope?: 'user' | 'project' | 'local';
    trigger?: 'hint' | 'user';
};
/**
 * Install a single plugin from a marketplace with the specified scope.
 * Interactive-UI wrapper around `installResolvedPlugin` — adds try/catch,
 * analytics, and UI-style message formatting.
 */
export declare function installPluginFromMarketplace({ pluginId, entry, marketplaceName, scope, trigger, }: InstallPluginParams): Promise<InstallPluginResult>;
//# sourceMappingURL=pluginInstallationHelpers.d.ts.map