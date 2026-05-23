import type { LspServerConfig } from '../services/lsp/types.js';
import type { McpServerConfig } from '../services/mcp/types.js';
import type { BundledSkillDefinition } from '../skills/bundledSkills.js';
import type { CommandMetadata, PluginAuthor, PluginManifest } from '../utils/plugins/schemas.js';
import type { HooksSettings } from '../utils/settings/types.js';
export type { PluginAuthor, PluginManifest, CommandMetadata };
/**
 * Definition for a built-in plugin that ships with the CLI.
 * Built-in plugins appear in the /plugin UI and can be enabled/disabled by
 * users (persisted to user settings).
 */
export type BuiltinPluginDefinition = {
    /** Plugin name (used in `{name}@builtin` identifier) */
    name: string;
    /** Description shown in the /plugin UI */
    description: string;
    /** Optional version string */
    version?: string;
    /** Skills provided by this plugin */
    skills?: BundledSkillDefinition[];
    /** Hooks provided by this plugin */
    hooks?: HooksSettings;
    /** MCP servers provided by this plugin */
    mcpServers?: Record<string, McpServerConfig>;
    /** Whether this plugin is available (e.g. based on system capabilities). Unavailable plugins are hidden entirely. */
    isAvailable?: () => boolean;
    /** Default enabled state before the user sets a preference (defaults to true) */
    defaultEnabled?: boolean;
};
export type PluginRepository = {
    url: string;
    branch: string;
    lastUpdated?: string;
    commitSha?: string;
};
export type PluginConfig = {
    repositories: Record<string, PluginRepository>;
};
export type LoadedPlugin = {
    name: string;
    manifest: PluginManifest;
    path: string;
    source: string;
    repository: string;
    enabled?: boolean;
    isBuiltin?: boolean;
    sha?: string;
    commandsPath?: string;
    commandsPaths?: string[];
    commandsMetadata?: Record<string, CommandMetadata>;
    agentsPath?: string;
    agentsPaths?: string[];
    skillsPath?: string;
    skillsPaths?: string[];
    outputStylesPath?: string;
    outputStylesPaths?: string[];
    hooksConfig?: HooksSettings;
    mcpServers?: Record<string, McpServerConfig>;
    lspServers?: Record<string, LspServerConfig>;
    settings?: Record<string, unknown>;
};
export type PluginComponent = 'commands' | 'agents' | 'skills' | 'hooks' | 'output-styles';
/**
 * Discriminated union of plugin error types.
 * Each error type has specific contextual data for better debugging and user guidance.
 *
 * This replaces the previous string-based error matching approach with type-safe
 * error handling that can't break when error messages change.
 *
 * IMPLEMENTATION STATUS:
 * Currently used in production (2 types):
 * - generic-error: Used for various plugin loading failures
 * - plugin-not-found: Used when plugin not found in marketplace
 *
 * Planned for future use (10 types - see TODOs in pluginLoader.ts):
 * - path-not-found, git-auth-failed, git-timeout, network-error
 * - manifest-parse-error, manifest-validation-error
 * - marketplace-not-found, marketplace-load-failed
 * - mcp-config-invalid, hook-load-failed, component-load-failed
 *
 * These unused types support UI formatting and provide a clear roadmap for
 * improving error specificity. They can be incrementally implemented as
 * error creation sites are refactored.
 */
export type PluginError = {
    type: 'path-not-found';
    source: string;
    plugin?: string;
    path: string;
    component: PluginComponent;
} | {
    type: 'git-auth-failed';
    source: string;
    plugin?: string;
    gitUrl: string;
    authType: 'ssh' | 'https';
} | {
    type: 'git-timeout';
    source: string;
    plugin?: string;
    gitUrl: string;
    operation: 'clone' | 'pull';
} | {
    type: 'network-error';
    source: string;
    plugin?: string;
    url: string;
    details?: string;
} | {
    type: 'manifest-parse-error';
    source: string;
    plugin?: string;
    manifestPath: string;
    parseError: string;
} | {
    type: 'manifest-validation-error';
    source: string;
    plugin?: string;
    manifestPath: string;
    validationErrors: string[];
} | {
    type: 'plugin-not-found';
    source: string;
    pluginId: string;
    marketplace: string;
} | {
    type: 'marketplace-not-found';
    source: string;
    marketplace: string;
    availableMarketplaces: string[];
} | {
    type: 'marketplace-load-failed';
    source: string;
    marketplace: string;
    reason: string;
} | {
    type: 'mcp-config-invalid';
    source: string;
    plugin: string;
    serverName: string;
    validationError: string;
} | {
    type: 'mcp-server-suppressed-duplicate';
    source: string;
    plugin: string;
    serverName: string;
    duplicateOf: string;
} | {
    type: 'lsp-config-invalid';
    source: string;
    plugin: string;
    serverName: string;
    validationError: string;
} | {
    type: 'hook-load-failed';
    source: string;
    plugin: string;
    hookPath: string;
    reason: string;
} | {
    type: 'component-load-failed';
    source: string;
    plugin: string;
    component: PluginComponent;
    path: string;
    reason: string;
} | {
    type: 'mcpb-download-failed';
    source: string;
    plugin: string;
    url: string;
    reason: string;
} | {
    type: 'mcpb-extract-failed';
    source: string;
    plugin: string;
    mcpbPath: string;
    reason: string;
} | {
    type: 'mcpb-invalid-manifest';
    source: string;
    plugin: string;
    mcpbPath: string;
    validationError: string;
} | {
    type: 'lsp-config-invalid';
    source: string;
    plugin: string;
    serverName: string;
    validationError: string;
} | {
    type: 'lsp-server-start-failed';
    source: string;
    plugin: string;
    serverName: string;
    reason: string;
} | {
    type: 'lsp-server-crashed';
    source: string;
    plugin: string;
    serverName: string;
    exitCode: number | null;
    signal?: string;
} | {
    type: 'lsp-request-timeout';
    source: string;
    plugin: string;
    serverName: string;
    method: string;
    timeoutMs: number;
} | {
    type: 'lsp-request-failed';
    source: string;
    plugin: string;
    serverName: string;
    method: string;
    error: string;
} | {
    type: 'marketplace-blocked-by-policy';
    source: string;
    plugin?: string;
    marketplace: string;
    blockedByBlocklist?: boolean;
    allowedSources: string[];
} | {
    type: 'dependency-unsatisfied';
    source: string;
    plugin: string;
    dependency: string;
    reason: 'not-enabled' | 'not-found';
} | {
    type: 'plugin-cache-miss';
    source: string;
    plugin: string;
    installPath: string;
} | {
    type: 'generic-error';
    source: string;
    plugin?: string;
    error: string;
};
export type PluginLoadResult = {
    enabled: LoadedPlugin[];
    disabled: LoadedPlugin[];
    errors: PluginError[];
};
/**
 * Helper function to get a display message from any PluginError
 * Useful for logging and simple error displays
 */
export declare function getPluginErrorMessage(error: PluginError): string;
//# sourceMappingURL=plugin.d.ts.map