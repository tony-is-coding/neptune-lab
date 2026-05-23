/**
 * MDM (Mobile Device Management) profile enforcement for Claude Code managed settings.
 *
 * Reads enterprise settings from OS-level MDM configuration:
 * - macOS: `com.anthropic.claudecode` preference domain
 *   (MDM profiles at /Library/Managed Preferences/ only — not user-writable ~/Library/Preferences/)
 * - Windows: `HKLM\SOFTWARE\Policies\ClaudeCode` (admin-only)
 *   and `HKCU\SOFTWARE\Policies\ClaudeCode` (user-writable, lowest priority)
 * - Linux: No MDM equivalent (uses /etc/claude-code/managed-settings.json instead)
 *
 * Policy settings use "first source wins" — the highest-priority source that exists
 * provides all policy settings. Priority (highest to lowest):
 *   remote → HKLM/plist → managed-settings.json → HKCU
 *
 * Architecture:
 *   constants.ts — shared constants and plist path builder (zero heavy imports)
 *   rawRead.ts   — subprocess I/O only (zero heavy imports, fires at main.tsx evaluation)
 *   settings.ts  — parsing, caching, first-source-wins logic (this file)
 */
import { type SettingsJson } from '../types.js';
import { type ValidationError } from '../validation.js';
type MdmResult = {
    settings: SettingsJson;
    errors: ValidationError[];
};
/**
 * Kick off async MDM/HKCU reads. Call this as early as possible in
 * startup so the subprocess runs in parallel with module loading.
 */
export declare function startMdmSettingsLoad(): void;
/**
 * Await the in-flight MDM load. Call this before the first settings read.
 * If startMdmSettingsLoad() was called early enough, this resolves immediately.
 */
export declare function ensureMdmSettingsLoaded(): Promise<void>;
/**
 * Read admin-controlled MDM settings from the session cache.
 *
 * Returns settings from admin-only sources:
 * - macOS: /Library/Managed Preferences/ (requires root)
 * - Windows: HKLM registry (requires admin)
 *
 * Does NOT include HKCU (user-writable) — use getHkcuSettings() for that.
 */
export declare function getMdmSettings(): MdmResult;
/**
 * Read HKCU registry settings (user-writable, lowest policy priority).
 * Only relevant on Windows — returns empty on other platforms.
 */
export declare function getHkcuSettings(): MdmResult;
/**
 * Clear the MDM and HKCU settings caches, forcing a fresh read on next load.
 */
export declare function clearMdmSettingsCache(): void;
/**
 * Update the session caches directly. Used by the change detector poll.
 */
export declare function setMdmSettingsCache(mdm: MdmResult, hkcu: MdmResult): void;
/**
 * Fire a fresh MDM subprocess read and parse the results.
 * Does NOT update the cache — caller decides whether to apply.
 */
export declare function refreshMdmSettings(): Promise<{
    mdm: MdmResult;
    hkcu: MdmResult;
}>;
/**
 * Parse JSON command output (plutil stdout or registry JSON value) into SettingsJson.
 * Filters invalid permission rules before schema validation so one bad rule
 * doesn't cause the entire MDM settings to be rejected.
 */
export declare function parseCommandOutputAsSettings(stdout: string, sourcePath: string): {
    settings: SettingsJson;
    errors: ValidationError[];
};
/**
 * Parse reg query stdout to extract a registry string value.
 * Matches both REG_SZ and REG_EXPAND_SZ, case-insensitive.
 *
 * Expected format:
 *     Settings    REG_SZ    {"json":"value"}
 */
export declare function parseRegQueryStdout(stdout: string, valueName?: string): string | null;
export {};
//# sourceMappingURL=settings.d.ts.map