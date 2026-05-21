import { type EditableSettingSource, type SettingSource } from './constants.js';
import { type SettingsJson } from './types.js';
import { type SettingsWithErrors, type ValidationError } from './validation.js';
/**
 * Load file-based managed settings: managed-settings.json + managed-settings.d/*.json.
 *
 * managed-settings.json is merged first (lowest precedence / base), then drop-in
 * files are sorted alphabetically and merged on top (higher precedence, later
 * files win). This matches the systemd/sudoers drop-in convention: the base
 * file provides defaults, drop-ins customize. Separate teams can ship
 * independent policy fragments (e.g. 10-otel.json, 20-security.json) without
 * coordinating edits to a single admin-owned file.
 *
 * Exported for testing.
 */
export declare function loadManagedFileSettings(): {
    settings: SettingsJson | null;
    errors: ValidationError[];
};
/**
 * Check which file-based managed settings sources are present.
 * Used by /status to show "(file)", "(drop-ins)", or "(file + drop-ins)".
 */
export declare function getManagedFileSettingsPresence(): {
    hasBase: boolean;
    hasDropIns: boolean;
};
/**
 * Parses a settings file into a structured format
 * @param path The path to the permissions file
 * @param source The source of the settings (optional, for error reporting)
 * @returns Parsed settings data and validation errors
 */
export declare function parseSettingsFile(path: string): {
    settings: SettingsJson | null;
    errors: ValidationError[];
};
/**
 * Get the absolute path to the associated file root for a given settings source
 * (e.g. for $PROJ_DIR/.claude/settings.json, returns $PROJ_DIR)
 * @param source The source of the settings
 * @returns The root path of the settings file
 */
export declare function getSettingsRootPathForSource(source: SettingSource): string;
export declare function getSettingsFilePathForSource(source: SettingSource): string | undefined;
export declare function getRelativeSettingsFilePathForSource(source: 'projectSettings' | 'localSettings'): string;
export declare function getSettingsForSource(source: SettingSource): SettingsJson | null;
/**
 * Get the origin of the highest-priority active policy settings source.
 * Uses "first source wins" — returns the first source that has content.
 * Priority: remote > plist/hklm > file (managed-settings.json) > hkcu
 */
export declare function getPolicySettingsOrigin(): 'remote' | 'plist' | 'hklm' | 'file' | 'hkcu' | null;
/**
 * Merges `settings` into the existing settings for `source` using lodash mergeWith.
 *
 * To delete a key from a record field (e.g. enabledPlugins, extraKnownMarketplaces),
 * set it to `undefined` — do NOT use `delete`. mergeWith only detects deletion when
 * the key is present with an explicit `undefined` value.
 */
export declare function updateSettingsForSource(source: EditableSettingSource, settings: SettingsJson): {
    error: Error | null;
};
/**
 * Custom merge function for lodash mergeWith when merging settings.
 * Arrays are concatenated and deduplicated; other values use default lodash merge behavior.
 * Exported for testing.
 */
export declare function settingsMergeCustomizer(objValue: unknown, srcValue: unknown): unknown;
/**
 * Get a list of setting keys from managed settings for logging purposes.
 * For certain nested settings (permissions, sandbox, hooks), expands to show
 * one level of nesting (e.g., "permissions.allow"). For other settings,
 * returns only the top-level key.
 *
 * @param settings The settings object to extract keys from
 * @returns Sorted array of key paths
 */
export declare function getManagedSettingsKeysForLogging(settings: SettingsJson): string[];
/**
 * Get merged settings from all sources in priority order
 * Settings are merged from lowest to highest priority:
 * userSettings -> projectSettings -> localSettings -> policySettings
 *
 * This function returns a snapshot of settings at the time of call.
 * For React components, prefer using useSettings() hook for reactive updates
 * when settings change on disk.
 *
 * Uses session-level caching to avoid repeated file I/O.
 * Cache is invalidated when settings files change via resetSettingsCache().
 *
 * @returns Merged settings from all available sources (always returns at least empty object)
 */
export declare function getInitialSettings(): SettingsJson;
/**
 * @deprecated Use getInitialSettings() instead. This alias exists for backwards compatibility.
 */
export declare const getSettings_DEPRECATED: typeof getInitialSettings;
export type SettingsWithSources = {
    effective: SettingsJson;
    /** Ordered low-to-high priority — later entries override earlier ones. */
    sources: Array<{
        source: SettingSource;
        settings: SettingsJson;
    }>;
};
/**
 * Get the effective merged settings alongside the raw per-source settings,
 * in merge-priority order. Only includes sources that are enabled and have
 * non-empty content.
 *
 * Always reads fresh from disk — resets the session cache so that `effective`
 * and `sources` are consistent even if the change detector hasn't fired yet.
 */
export declare function getSettingsWithSources(): SettingsWithSources;
/**
 * Get merged settings and validation errors from all sources
 * This function now uses session-level caching to avoid repeated file I/O.
 * Settings changes require Claude Code restart, so cache is valid for entire session.
 * @returns Merged settings and all validation errors encountered
 */
export declare function getSettingsWithErrors(): SettingsWithErrors;
/**
 * Check if any raw settings file contains a specific key, regardless of validation.
 * This is useful for detecting user intent even when settings validation fails.
 * For example, if a user set cleanupPeriodDays but has validation errors elsewhere,
 * we can detect they explicitly configured cleanup and skip cleanup rather than
 * falling back to defaults.
 */
/**
 * Returns true if any trusted settings source has accepted the bypass
 * permissions mode dialog. projectSettings is intentionally excluded —
 * a malicious project could otherwise auto-bypass the dialog (RCE risk).
 */
export declare function hasSkipDangerousModePermissionPrompt(): boolean;
/**
 * Returns true if any trusted settings source has accepted the auto
 * mode opt-in dialog. projectSettings is intentionally excluded —
 * a malicious project could otherwise auto-bypass the dialog (RCE risk).
 */
export declare function hasAutoModeOptIn(): boolean;
/**
 * Returns whether plan mode should use auto mode semantics. Default true
 * (opt-out). Returns false if any trusted source explicitly sets false.
 * projectSettings is excluded so a malicious project can't control this.
 */
export declare function getUseAutoModeDuringPlan(): boolean;
/**
 * Returns the merged autoMode config from trusted settings sources.
 * Only available when TRANSCRIPT_CLASSIFIER is active; returns undefined otherwise.
 * projectSettings is intentionally excluded — a malicious project could
 * otherwise inject classifier allow/deny rules (RCE risk).
 */
export declare function getAutoModeConfig(): {
    allow?: string[];
    soft_deny?: string[];
    environment?: string[];
} | undefined;
export declare function rawSettingsContainsKey(key: string): boolean;
//# sourceMappingURL=settings.d.ts.map