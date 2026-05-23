import type { EditableSettingSource } from '../settings/constants.js';
import { type PluginScope } from './schemas.js';
/**
 * Extended scope type that includes 'flag' for session-only plugins.
 * 'flag' scope is NOT persisted to installed_plugins.json.
 */
export type ExtendedPluginScope = PluginScope | 'flag';
/**
 * Scopes that are persisted to installed_plugins.json.
 * Excludes 'flag' which is session-only.
 */
export type PersistablePluginScope = Exclude<ExtendedPluginScope, 'flag'>;
/**
 * Map from SettingSource to plugin scope.
 * Note: flagSettings maps to 'flag' which is session-only and not persisted.
 */
export declare const SETTING_SOURCE_TO_SCOPE: {
    readonly policySettings: "managed";
    readonly userSettings: "user";
    readonly projectSettings: "project";
    readonly localSettings: "local";
    readonly flagSettings: "flag";
};
/**
 * Parsed plugin identifier with name and optional marketplace
 */
export type ParsedPluginIdentifier = {
    name: string;
    marketplace?: string;
};
/**
 * Parse a plugin identifier string into name and marketplace components
 * @param plugin The plugin identifier (name or name@marketplace)
 * @returns Parsed plugin name and optional marketplace
 *
 * Note: Only the first '@' is used as separator. If the input contains multiple '@' symbols
 * (e.g., "plugin@market@place"), everything after the second '@' is ignored.
 * This is intentional as marketplace names should not contain '@'.
 */
export declare function parsePluginIdentifier(plugin: string): ParsedPluginIdentifier;
/**
 * Build a plugin ID from name and marketplace
 * @param name The plugin name
 * @param marketplace Optional marketplace name
 * @returns Plugin ID in format "name" or "name@marketplace"
 */
export declare function buildPluginId(name: string, marketplace?: string): string;
/**
 * Check if a marketplace name is an official (Anthropic-controlled) marketplace.
 * Used for telemetry redaction — official plugin identifiers are safe to log to
 * general-access additional_metadata; third-party identifiers go only to the
 * PII-tagged _PROTO_* BQ columns.
 */
export declare function isOfficialMarketplaceName(marketplace: string | undefined): boolean;
/**
 * Convert a plugin scope to its corresponding editable setting source
 * @param scope The plugin installation scope
 * @returns The corresponding setting source for reading/writing settings
 * @throws Error if scope is 'managed' (cannot install plugins to managed scope)
 */
export declare function scopeToSettingSource(scope: PluginScope): EditableSettingSource;
/**
 * Convert an editable setting source to its corresponding plugin scope.
 * Derived from SETTING_SOURCE_TO_SCOPE to maintain a single source of truth.
 * @param source The setting source
 * @returns The corresponding plugin scope
 */
export declare function settingSourceToScope(source: EditableSettingSource): Exclude<PluginScope, 'managed'>;
//# sourceMappingURL=pluginIdentifier.d.ts.map