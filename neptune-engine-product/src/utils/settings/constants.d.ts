/**
 * All possible sources where settings can come from
 * Order matters - later sources override earlier ones
 */
export declare const SETTING_SOURCES: readonly ["userSettings", "projectSettings", "localSettings", "flagSettings", "policySettings"];
export type SettingSource = (typeof SETTING_SOURCES)[number];
export declare function getSettingSourceName(source: SettingSource): string;
/**
 * Get short display name for a setting source (capitalized, for context/skills UI)
 * @param source The setting source or 'plugin'/'built-in'
 * @returns Short capitalized display name like 'User', 'Project', 'Plugin'
 */
export declare function getSourceDisplayName(source: SettingSource | 'plugin' | 'built-in'): string;
/**
 * Get display name for a setting or permission rule source (lowercase, for inline use)
 * @param source The setting source or permission rule source
 * @returns Display name for the source in lowercase
 */
export declare function getSettingSourceDisplayNameLowercase(source: SettingSource | 'cliArg' | 'command' | 'session'): string;
/**
 * Get display name for a setting or permission rule source (capitalized, for UI labels)
 * @param source The setting source or permission rule source
 * @returns Display name for the source with first letter capitalized
 */
export declare function getSettingSourceDisplayNameCapitalized(source: SettingSource | 'cliArg' | 'command' | 'session'): string;
/**
 * Parse the --setting-sources CLI flag into SettingSource array
 * @param flag Comma-separated string like "user,project,local"
 * @returns Array of SettingSource values
 */
export declare function parseSettingSourcesFlag(flag: string): SettingSource[];
/**
 * Get enabled setting sources with policy/flag always included
 * @returns Array of enabled SettingSource values
 */
export declare function getEnabledSettingSources(): SettingSource[];
/**
 * Check if a specific source is enabled
 * @param source The source to check
 * @returns true if the source should be loaded
 */
export declare function isSettingSourceEnabled(source: SettingSource): boolean;
/**
 * Editable setting sources (excludes policySettings and flagSettings which are read-only)
 */
export type EditableSettingSource = Exclude<SettingSource, 'policySettings' | 'flagSettings'>;
/**
 * List of sources where permission rules can be saved, in display order.
 * Used by permission-rule and hook-save UIs to present source options.
 */
export declare const SOURCES: readonly ["localSettings", "projectSettings", "userSettings"];
/**
 * The JSON Schema URL for Claude Code settings
 * You can edit the contents at https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/claude-code-settings.json
 */
export declare const CLAUDE_CODE_SETTINGS_SCHEMA_URL = "https://json.schemastore.org/claude-code-settings.json";
//# sourceMappingURL=constants.d.ts.map