/**
 * Plugin Zip Cache Module
 *
 * Manages plugins as ZIP archives in a mounted directory (e.g., Filestore).
 * When CLAUDE_CODE_PLUGIN_USE_ZIP_CACHE is enabled and CLAUDE_CODE_PLUGIN_CACHE_DIR
 * is set, plugins are stored as ZIPs in that directory and extracted to a
 * session-local temp directory at startup.
 *
 * Limitations:
 * - Only headless mode is supported
 * - All settings sources are used (same as normal plugin flow)
 * - Only github, git, and url marketplace sources are supported
 * - Only strict:true marketplace entries are supported
 * - Auto-update is non-blocking (background, does not affect current session)
 *
 * Directory structure of the zip cache:
 * /mnt/plugins-cache/
 *   ├── known_marketplaces.json
 *   ├── installed_plugins.json
 *   ├── marketplaces/
 *   │   ├── official-marketplace.json
 *   │   └── company-marketplace.json
 *   └── plugins/
 *       ├── official-marketplace/
 *       │   └── plugin-a/
 *       │       └── 1.0.0.zip
 *       └── company-marketplace/
 *           └── plugin-b/
 *               └── 2.1.3.zip
 */
import type { MarketplaceSource } from './schemas.js';
/**
 * Check if the plugin zip cache mode is enabled.
 */
export declare function isPluginZipCacheEnabled(): boolean;
/**
 * Get the path to the zip cache directory.
 * Requires CLAUDE_CODE_PLUGIN_CACHE_DIR to be set.
 * Returns undefined if zip cache is not enabled.
 */
export declare function getPluginZipCachePath(): string | undefined;
/**
 * Get the path to known_marketplaces.json in the zip cache.
 */
export declare function getZipCacheKnownMarketplacesPath(): string;
/**
 * Get the path to installed_plugins.json in the zip cache.
 */
export declare function getZipCacheInstalledPluginsPath(): string;
/**
 * Get the marketplaces directory within the zip cache.
 */
export declare function getZipCacheMarketplacesDir(): string;
/**
 * Get the plugins directory within the zip cache.
 */
export declare function getZipCachePluginsDir(): string;
/**
 * Get or create the session plugin cache directory.
 * This is a temp directory on local disk where plugins are extracted for the session.
 */
export declare function getSessionPluginCachePath(): Promise<string>;
/**
 * Clean up the session plugin cache directory.
 * Should be called when the session ends.
 */
export declare function cleanupSessionPluginCache(): Promise<void>;
/**
 * Reset the session plugin cache path (for testing).
 */
export declare function resetSessionPluginCache(): void;
/**
 * Write data to a file in the zip cache atomically.
 * Writes to a temp file in the same directory, then renames.
 */
export declare function atomicWriteToZipCache(targetPath: string, data: string | Uint8Array): Promise<void>;
/**
 * Create a ZIP archive from a directory.
 * Resolves symlinks to actual file contents (replaces symlinks with real data).
 * Stores Unix mode bits in external_attr so extractZipToDirectory can restore
 * +x — otherwise the round-trip (git clone → zip → extract) loses exec bits.
 *
 * @param sourceDir - Directory to zip
 * @returns ZIP file as Uint8Array
 */
export declare function createZipFromDirectory(sourceDir: string): Promise<Uint8Array>;
/**
 * Extract a ZIP file to a target directory.
 *
 * @param zipPath - Path to the ZIP file
 * @param targetDir - Directory to extract into
 */
export declare function extractZipToDirectory(zipPath: string, targetDir: string): Promise<void>;
/**
 * Convert a plugin directory to a ZIP in-place: zip → atomic write → delete dir.
 * Both call sites (cacheAndRegisterPlugin, copyPluginToVersionedCache) need the
 * same sequence; getting it wrong (non-atomic write, forgetting rm) corrupts cache.
 */
export declare function convertDirectoryToZipInPlace(dirPath: string, zipPath: string): Promise<void>;
/**
 * Get the relative path for a marketplace JSON file within the zip cache.
 * Format: marketplaces/{marketplace-name}.json
 */
export declare function getMarketplaceJsonRelativePath(marketplaceName: string): string;
/**
 * Check if a marketplace source type is supported by zip cache mode.
 *
 * Supported sources write to `join(cacheDir, name)` — syncMarketplacesToZipCache
 * reads marketplace.json from that installLocation, source-type-agnostic.
 * - github/git/url: clone to temp, rename into cacheDir
 * - settings: write synthetic marketplace.json directly to cacheDir (no fetch)
 *
 * Excluded: file/directory (installLocation is the user's path OUTSIDE cacheDir —
 * nonsensical in ephemeral containers), npm (node_modules bloat on Filestore mount).
 */
export declare function isMarketplaceSourceSupportedByZipCache(source: MarketplaceSource): boolean;
//# sourceMappingURL=zipCache.d.ts.map