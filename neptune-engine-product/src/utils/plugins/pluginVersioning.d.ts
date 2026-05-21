/**
 * Plugin Version Calculation Module
 *
 * Handles version calculation for plugins from various sources.
 * Versions are used for versioned cache paths and update detection.
 *
 * Version sources (in order of preference):
 * 1. Explicit version from plugin.json
 * 2. Git commit SHA (for git/github sources)
 * 3. Fallback timestamp for local sources
 */
import type { PluginManifest, PluginSource } from './schemas.js';
/**
 * Calculate the version for a plugin based on its source.
 *
 * Version sources (in order of priority):
 * 1. plugin.json version field (highest priority)
 * 2. Provided version (typically from marketplace entry)
 * 3. Git commit SHA from install path
 * 4. 'unknown' as last resort
 *
 * @param pluginId - Plugin identifier (e.g., "plugin@marketplace")
 * @param source - Plugin source configuration (used for git-subdir path hashing)
 * @param manifest - Optional plugin manifest with version field
 * @param installPath - Optional path to installed plugin (for git SHA extraction)
 * @param providedVersion - Optional version from marketplace entry or caller
 * @param gitCommitSha - Optional pre-resolved git SHA (for sources like
 *   git-subdir where the clone is discarded and the install path has no .git)
 * @returns Version string (semver, short SHA, or 'unknown')
 */
export declare function calculatePluginVersion(pluginId: string, source: PluginSource, manifest?: PluginManifest, installPath?: string, providedVersion?: string, gitCommitSha?: string): Promise<string>;
/**
 * Get the git commit SHA for a directory.
 *
 * @param dirPath - Path to directory (should be a git repository)
 * @returns Full commit SHA or null if not a git repo
 */
export declare function getGitCommitSha(dirPath: string): Promise<string | null>;
/**
 * Extract version from a versioned cache path.
 *
 * Given a path like `~/.claude/plugins/cache/marketplace/plugin/1.0.0`,
 * extracts and returns `1.0.0`.
 *
 * @param installPath - Full path to plugin installation
 * @returns Version string from path, or null if not a versioned path
 */
export declare function getVersionFromPath(installPath: string): string | null;
/**
 * Check if a path is a versioned plugin path.
 *
 * @param path - Path to check
 * @returns True if path follows versioned structure
 */
export declare function isVersionedPath(path: string): boolean;
//# sourceMappingURL=pluginVersioning.d.ts.map