import type { McpbManifestAny as McpbManifest } from '@anthropic-ai/mcpb';
type McpbUserConfigurationOption = any;
import type { McpServerConfig } from '../../services/mcp/types.js';
/**
 * User configuration values for MCPB
 */
export type UserConfigValues = Record<string, string | number | boolean | string[]>;
/**
 * User configuration schema from DXT manifest
 */
export type UserConfigSchema = Record<string, McpbUserConfigurationOption>;
/**
 * Result of loading an MCPB file (success case)
 */
export type McpbLoadResult = {
    manifest: McpbManifest;
    mcpConfig: McpServerConfig;
    extractedPath: string;
    contentHash: string;
};
/**
 * Result when MCPB needs user configuration
 */
export type McpbNeedsConfigResult = {
    status: 'needs-config';
    manifest: McpbManifest;
    extractedPath: string;
    contentHash: string;
    configSchema: UserConfigSchema;
    existingConfig: UserConfigValues;
    validationErrors: string[];
};
/**
 * Metadata stored for each cached MCPB
 */
export type McpbCacheMetadata = {
    source: string;
    contentHash: string;
    extractedPath: string;
    cachedAt: string;
    lastChecked: string;
};
/**
 * Progress callback for download and extraction operations
 */
export type ProgressCallback = (status: string) => void;
/**
 * Check if a source string is an MCPB file reference
 */
export declare function isMcpbSource(source: string): boolean;
/**
 * Load user configuration for an MCP server, merging non-sensitive values
 * (from settings.json) with sensitive values (from secureStorage keychain).
 * secureStorage wins on collision — schema determines destination so
 * collision shouldn't happen, but if a user hand-edits settings.json we
 * trust the more secure source.
 *
 * Returns null only if NEITHER source has anything — callers skip
 * ${user_config.X} substitution in that case.
 *
 * @param pluginId - Plugin identifier in "plugin@marketplace" format
 * @param serverName - MCP server name from DXT manifest
 */
export declare function loadMcpServerUserConfig(pluginId: string, serverName: string): UserConfigValues | null;
/**
 * Save user configuration for an MCP server, splitting by `schema[key].sensitive`.
 * Mirrors savePluginOptions (pluginOptionsStorage.ts:90) for top-level options:
 *   - `sensitive: true` → secureStorage (keychain on macOS, .credentials.json 0600 elsewhere)
 *   - everything else   → settings.json pluginConfigs[pluginId].mcpServers[serverName]
 *
 * Without this split, per-channel `sensitive: true` was a false sense of
 * security — the dialog masked the input but the save went to plaintext
 * settings.json anyway. H1 #3617646 (Telegram/Discord bot tokens in
 * world-readable .env) surfaced this as the gap to close.
 *
 * Writes are skipped if nothing in that category is present.
 *
 * @param pluginId - Plugin identifier in "plugin@marketplace" format
 * @param serverName - MCP server name from DXT manifest
 * @param config - User configuration values
 * @param schema - The userConfig schema for this server (manifest.user_config
 *   or channels[].userConfig) — drives the sensitive/non-sensitive split
 */
export declare function saveMcpServerUserConfig(pluginId: string, serverName: string, config: UserConfigValues, schema: UserConfigSchema): void;
/**
 * Validate user configuration values against DXT user_config schema
 */
export declare function validateUserConfig(values: UserConfigValues, schema: UserConfigSchema): {
    valid: boolean;
    errors: string[];
};
/**
 * Check if an MCPB source has changed and needs re-extraction
 */
export declare function checkMcpbChanged(source: string, pluginPath: string): Promise<boolean>;
/**
 * Load and extract an MCPB file, with caching and user configuration support
 *
 * @param source - MCPB file path or URL
 * @param pluginPath - Plugin directory path
 * @param pluginId - Plugin identifier in "plugin@marketplace" format (for config storage)
 * @param onProgress - Progress callback
 * @param providedUserConfig - User configuration values (for initial setup or reconfiguration)
 * @returns Success with MCP config, or needs-config status with schema
 */
export declare function loadMcpbFile(source: string, pluginPath: string, pluginId: string, onProgress?: ProgressCallback, providedUserConfig?: UserConfigValues, forceConfigDialog?: boolean): Promise<McpbLoadResult | McpbNeedsConfigResult>;
export {};
//# sourceMappingURL=mcpbHandler.d.ts.map