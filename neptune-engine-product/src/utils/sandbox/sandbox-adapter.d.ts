/**
 * Adapter layer that wraps @anthropic-ai/sandbox-runtime with Claude CLI-specific integrations.
 * This file provides the bridge between the external sandbox-runtime package and Claude CLI's
 * settings system, tool integration, and additional features.
 */
import type { FsReadRestrictionConfig, FsWriteRestrictionConfig, IgnoreViolationsConfig, NetworkHostPattern, NetworkRestrictionConfig, SandboxAskCallback, SandboxDependencyCheck, SandboxRuntimeConfig, SandboxViolationEvent } from '@anthropic-ai/sandbox-runtime';
import { SandboxRuntimeConfigSchema, SandboxViolationStore } from '@anthropic-ai/sandbox-runtime';
import { type SettingSource } from '../settings/constants.js';
import type { SettingsJson } from '../settings/types.js';
/**
 * Resolve Claude Code-specific path patterns for sandbox-runtime.
 *
 * Claude Code uses special path prefixes in permission rules:
 * - `//path` → absolute from filesystem root (becomes `/path`)
 * - `/path` → relative to settings file directory (becomes `$SETTINGS_DIR/path`)
 * - `~/path` → passed through (sandbox-runtime handles this)
 * - `./path` or `path` → passed through (sandbox-runtime handles this)
 *
 * This function only handles CC-specific conventions (`//` and `/`).
 * Standard path patterns like `~/` and relative paths are passed through
 * for sandbox-runtime's normalizePathForSandbox to handle.
 *
 * @param pattern The path pattern from a permission rule
 * @param source The settings source this pattern came from (needed to resolve `/path` patterns)
 */
export declare function resolvePathPatternForSandbox(pattern: string, source: SettingSource): string;
/**
 * Resolve paths from sandbox.filesystem.* settings (allowWrite, denyWrite, etc).
 *
 * Unlike permission rules (Edit/Read), these settings use standard path semantics:
 * - `/path` → absolute path (as written, NOT settings-relative)
 * - `~/path` → expanded to home directory
 * - `./path` or `path` → relative to settings file directory
 * - `//path` → absolute (legacy permission-rule syntax, accepted for compat)
 *
 * Fix for #30067: resolvePathPatternForSandbox treats `/Users/foo/.cargo` as
 * settings-relative (permission-rule convention). Users reasonably expect
 * absolute paths in sandbox.filesystem.allowWrite to work as-is.
 *
 * Also expands `~` here rather than relying on sandbox-runtime, because
 * sandbox-runtime's getFsWriteConfig() does not call normalizePathForSandbox
 * on allowWrite paths (it only strips trailing glob suffixes).
 */
export declare function resolveSandboxFilesystemPath(pattern: string, source: SettingSource): string;
/**
 * Check if only managed sandbox domains should be used.
 * This is true when policySettings has sandbox.network.allowManagedDomainsOnly: true
 */
export declare function shouldAllowManagedSandboxDomainsOnly(): boolean;
/**
 * Convert Claude Code settings format to SandboxRuntimeConfig format
 * (Function exported for testing)
 *
 * @param settings Merged settings (used for sandbox config like network, ripgrep, etc.)
 */
export declare function convertToSandboxRuntimeConfig(settings: SettingsJson): SandboxRuntimeConfig;
/**
 * Add a command to the excluded commands list (commands that should not be sandboxed)
 * This is a Claude CLI-specific function that updates local settings.
 */
export declare function addToExcludedCommands(command: string, permissionUpdates?: Array<{
    type: string;
    rules: Array<{
        toolName: string;
        ruleContent?: string;
    }>;
}>): string;
export interface ISandboxManager {
    initialize(sandboxAskCallback?: SandboxAskCallback): Promise<void>;
    isSupportedPlatform(): boolean;
    isPlatformInEnabledList(): boolean;
    getSandboxUnavailableReason(): string | undefined;
    isSandboxingEnabled(): boolean;
    isSandboxEnabledInSettings(): boolean;
    checkDependencies(): SandboxDependencyCheck;
    isAutoAllowBashIfSandboxedEnabled(): boolean;
    areUnsandboxedCommandsAllowed(): boolean;
    isSandboxRequired(): boolean;
    areSandboxSettingsLockedByPolicy(): boolean;
    setSandboxSettings(options: {
        enabled?: boolean;
        autoAllowBashIfSandboxed?: boolean;
        allowUnsandboxedCommands?: boolean;
    }): Promise<void>;
    getFsReadConfig(): FsReadRestrictionConfig;
    getFsWriteConfig(): FsWriteRestrictionConfig;
    getNetworkRestrictionConfig(): NetworkRestrictionConfig;
    getAllowUnixSockets(): string[] | undefined;
    getAllowLocalBinding(): boolean | undefined;
    getIgnoreViolations(): IgnoreViolationsConfig | undefined;
    getEnableWeakerNestedSandbox(): boolean | undefined;
    getExcludedCommands(): string[];
    getProxyPort(): number | undefined;
    getSocksProxyPort(): number | undefined;
    getLinuxHttpSocketPath(): string | undefined;
    getLinuxSocksSocketPath(): string | undefined;
    waitForNetworkInitialization(): Promise<boolean>;
    wrapWithSandbox(command: string, binShell?: string, customConfig?: Partial<SandboxRuntimeConfig>, abortSignal?: AbortSignal): Promise<string>;
    cleanupAfterCommand(): void;
    getSandboxViolationStore(): SandboxViolationStore;
    annotateStderrWithSandboxFailures(command: string, stderr: string): string;
    getLinuxGlobPatternWarnings(): string[];
    refreshConfig(): void;
    reset(): Promise<void>;
}
/**
 * Claude CLI sandbox manager - wraps sandbox-runtime with Claude-specific features
 */
export declare const SandboxManager: ISandboxManager;
export type { SandboxAskCallback, SandboxDependencyCheck, FsReadRestrictionConfig, FsWriteRestrictionConfig, NetworkRestrictionConfig, NetworkHostPattern, SandboxViolationEvent, SandboxRuntimeConfig, IgnoreViolationsConfig, };
export { SandboxViolationStore, SandboxRuntimeConfigSchema };
//# sourceMappingURL=sandbox-adapter.d.ts.map