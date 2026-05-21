import type { LspServerConfig, ScopedLspServerConfig } from '../../services/lsp/types.js';
import type { LoadedPlugin, PluginError } from '../../types/plugin.js';
import { type PluginOptionValues } from './pluginOptionsStorage.js';
/**
 * Load LSP server configurations from a plugin.
 * Checks for:
 * 1. .lsp.json file in plugin directory
 * 2. manifest.lspServers field
 *
 * @param plugin - The loaded plugin
 * @param errors - Array to collect any errors encountered
 * @returns Record of server name to config, or undefined if no servers
 */
export declare function loadPluginLspServers(plugin: LoadedPlugin, errors?: PluginError[]): Promise<Record<string, LspServerConfig> | undefined>;
/**
 * Resolve environment variables for plugin LSP servers.
 * Handles ${CLAUDE_PLUGIN_ROOT}, ${user_config.X}, and general ${VAR}
 * substitution. Tracks missing environment variables for error reporting.
 */
export declare function resolvePluginLspEnvironment(config: LspServerConfig, plugin: {
    path: string;
    source: string;
}, userConfig?: PluginOptionValues, _errors?: PluginError[]): LspServerConfig;
/**
 * Add plugin scope to LSP server configs
 * This adds a prefix to server names to avoid conflicts between plugins
 */
export declare function addPluginScopeToLspServers(servers: Record<string, LspServerConfig>, pluginName: string): Record<string, ScopedLspServerConfig>;
/**
 * Get LSP servers from a specific plugin with environment variable resolution and scoping
 * This function is called when the LSP servers need to be activated and ensures they have
 * the proper environment variables and scope applied
 */
export declare function getPluginLspServers(plugin: LoadedPlugin, errors?: PluginError[]): Promise<Record<string, ScopedLspServerConfig> | undefined>;
/**
 * Extract all LSP servers from loaded plugins
 */
export declare function extractLspServersFromPlugins(plugins: LoadedPlugin[], errors?: PluginError[]): Promise<Record<string, ScopedLspServerConfig>>;
//# sourceMappingURL=lspPluginIntegration.d.ts.map