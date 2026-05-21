import { type McpServerConfig, type ScopedMcpServerConfig } from '../../services/mcp/types.js';
import type { LoadedPlugin, PluginError } from '../../types/plugin.js';
import { type UserConfigSchema, type UserConfigValues } from './mcpbHandler.js';
/**
 * Load MCP servers from a plugin's manifest
 * This function loads MCP server configurations from various sources within the plugin
 * including manifest entries, .mcp.json files, and .mcpb files
 */
export declare function loadPluginMcpServers(plugin: LoadedPlugin, errors?: PluginError[]): Promise<Record<string, McpServerConfig> | undefined>;
/**
 * A channel entry from a plugin's manifest whose userConfig has not yet been
 * filled in (required fields are missing from saved settings).
 */
export type UnconfiguredChannel = {
    server: string;
    displayName: string;
    configSchema: UserConfigSchema;
};
/**
 * Find channel entries in a plugin's manifest whose required userConfig
 * fields are not yet saved. Pure function — no React, no prompting.
 * ManagePlugins.tsx calls this after a plugin is enabled to decide whether
 * to show the config dialog.
 *
 * Entries without a `userConfig` schema are skipped (nothing to prompt for).
 * Entries whose saved config already satisfies `validateUserConfig` are
 * skipped. The `configSchema` in the return value is structurally a
 * `UserConfigSchema` because the Zod schema in schemas.ts matches
 * `McpbUserConfigurationOption` field-for-field.
 */
export declare function getUnconfiguredChannels(plugin: LoadedPlugin): UnconfiguredChannel[];
/**
 * Add plugin scope to MCP server configs
 * This adds a prefix to server names to avoid conflicts between plugins
 */
export declare function addPluginScopeToServers(servers: Record<string, McpServerConfig>, pluginName: string, pluginSource: string): Record<string, ScopedMcpServerConfig>;
/**
 * Extract all MCP servers from loaded plugins
 * NOTE: Resolves environment variables for all servers before returning
 */
export declare function extractMcpServersFromPlugins(plugins: LoadedPlugin[], errors?: PluginError[]): Promise<Record<string, ScopedMcpServerConfig>>;
/**
 * Resolve environment variables for plugin MCP servers
 * Handles ${CLAUDE_PLUGIN_ROOT}, ${user_config.X}, and general ${VAR} substitution
 * Tracks missing environment variables for error reporting
 */
export declare function resolvePluginMcpEnvironment(config: McpServerConfig, plugin: {
    path: string;
    source: string;
}, userConfig?: UserConfigValues, errors?: PluginError[], pluginName?: string, serverName?: string): McpServerConfig;
/**
 * Get MCP servers from a specific plugin with environment variable resolution and scoping
 * This function is called when the MCP servers need to be activated and ensures they have
 * the proper environment variables and scope applied
 */
export declare function getPluginMcpServers(plugin: LoadedPlugin, errors?: PluginError[]): Promise<Record<string, ScopedMcpServerConfig> | undefined>;
//# sourceMappingURL=mcpPluginIntegration.d.ts.map