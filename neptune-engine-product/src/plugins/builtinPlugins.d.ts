/**
 * Built-in Plugin Registry
 *
 * Manages built-in plugins that ship with the CLI and can be enabled/disabled
 * by users via the /plugin UI.
 *
 * Built-in plugins differ from bundled skills (src/skills/bundled/) in that:
 * - They appear in the /plugin UI under a "Built-in" section
 * - Users can enable/disable them (persisted to user settings)
 * - They can provide multiple components (skills, hooks, MCP servers)
 *
 * Plugin IDs use the format `{name}@builtin` to distinguish them from
 * marketplace plugins (`{name}@{marketplace}`).
 */
import type { Command } from '../commands.js';
import type { BuiltinPluginDefinition, LoadedPlugin } from '../types/plugin.js';
export declare const BUILTIN_MARKETPLACE_NAME = "builtin";
/**
 * Register a built-in plugin. Call this from initBuiltinPlugins() at startup.
 */
export declare function registerBuiltinPlugin(definition: BuiltinPluginDefinition): void;
/**
 * Check if a plugin ID represents a built-in plugin (ends with @builtin).
 */
export declare function isBuiltinPluginId(pluginId: string): boolean;
/**
 * Get a specific built-in plugin definition by name.
 * Useful for the /plugin UI to show the skills/hooks/MCP list without
 * a marketplace lookup.
 */
export declare function getBuiltinPluginDefinition(name: string): BuiltinPluginDefinition | undefined;
/**
 * Get all registered built-in plugins as LoadedPlugin objects, split into
 * enabled/disabled based on user settings (with defaultEnabled as fallback).
 * Plugins whose isAvailable() returns false are omitted entirely.
 */
export declare function getBuiltinPlugins(): {
    enabled: LoadedPlugin[];
    disabled: LoadedPlugin[];
};
/**
 * Get skills from enabled built-in plugins as Command objects.
 * Skills from disabled plugins are not returned.
 */
export declare function getBuiltinPluginSkillCommands(): Command[];
/**
 * Clear built-in plugins registry (for testing).
 */
export declare function clearBuiltinPlugins(): void;
//# sourceMappingURL=builtinPlugins.d.ts.map