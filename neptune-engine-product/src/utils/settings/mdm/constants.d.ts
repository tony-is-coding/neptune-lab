/**
 * Shared constants and path builders for MDM settings modules.
 *
 * This module has ZERO heavy imports (only `os`) — safe to use from mdmRawRead.ts.
 * Both mdmRawRead.ts and mdmSettings.ts import from here to avoid duplication.
 */
/** macOS preference domain for Claude Code MDM profiles. */
export declare const MACOS_PREFERENCE_DOMAIN = "com.anthropic.claudecode";
/**
 * Windows registry key paths for Claude Code MDM policies.
 *
 * These keys live under SOFTWARE\Policies which is on the WOW64 shared key
 * list — both 32-bit and 64-bit processes see the same values without
 * redirection. Do not move these to SOFTWARE\ClaudeCode, as SOFTWARE is
 * redirected and 32-bit processes would silently read from WOW6432Node.
 * See: https://learn.microsoft.com/en-us/windows/win32/winprog64/shared-registry-keys
 */
export declare const WINDOWS_REGISTRY_KEY_PATH_HKLM = "HKLM\\SOFTWARE\\Policies\\ClaudeCode";
export declare const WINDOWS_REGISTRY_KEY_PATH_HKCU = "HKCU\\SOFTWARE\\Policies\\ClaudeCode";
/** Windows registry value name containing the JSON settings blob. */
export declare const WINDOWS_REGISTRY_VALUE_NAME = "Settings";
/** Path to macOS plutil binary. */
export declare const PLUTIL_PATH = "/usr/bin/plutil";
/** Arguments for plutil to convert plist to JSON on stdout (append plist path). */
export declare const PLUTIL_ARGS_PREFIX: readonly ["-convert", "json", "-o", "-", "--"];
/** Subprocess timeout in milliseconds. */
export declare const MDM_SUBPROCESS_TIMEOUT_MS = 5000;
/**
 * Build the list of macOS plist paths in priority order (highest first).
 * Evaluates `process.env.USER_TYPE` at call time so ant-only paths are
 * included only when appropriate.
 */
export declare function getMacOSPlistPaths(): Array<{
    path: string;
    label: string;
}>;
//# sourceMappingURL=constants.d.ts.map