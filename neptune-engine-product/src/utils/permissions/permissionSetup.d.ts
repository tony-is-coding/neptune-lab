import type { ToolPermissionContext } from '../../Tool.js';
import { type PermissionMode } from './PermissionMode.js';
import type { PermissionRule, PermissionRuleSource, PermissionRuleValue } from './PermissionRule.js';
/**
 * Checks if a Bash permission rule is dangerous for auto mode.
 * A rule is dangerous if it would auto-allow commands that execute arbitrary code,
 * bypassing the classifier's safety evaluation.
 *
 * Dangerous patterns:
 * 1. Tool-level allow (Bash with no ruleContent) - allows ALL commands
 * 2. Prefix rules for script interpreters (python:*, node:*, etc.)
 * 3. Wildcard rules matching interpreters (python*, node*, etc.)
 */
export declare function isDangerousBashPermission(toolName: string, ruleContent: string | undefined): boolean;
/**
 * Checks if a PowerShell permission rule is dangerous for auto mode.
 * A rule is dangerous if it would auto-allow commands that execute arbitrary
 * code (nested shells, Invoke-Expression, Start-Process, etc.), bypassing the
 * classifier's safety evaluation.
 *
 * PowerShell is case-insensitive, so rule content is lowercased before matching.
 */
export declare function isDangerousPowerShellPermission(toolName: string, ruleContent: string | undefined): boolean;
/**
 * Checks if an Agent (sub-agent) permission rule is dangerous for auto mode.
 * Any Agent allow rule would auto-approve sub-agent spawns before the auto mode classifier
 * can evaluate the sub-agent's prompt, defeating delegation attack prevention.
 */
export declare function isDangerousTaskPermission(toolName: string, _ruleContent: string | undefined): boolean;
export type DangerousPermissionInfo = {
    ruleValue: PermissionRuleValue;
    source: PermissionRuleSource;
    /** The permission rule formatted for display, e.g. "Bash(*)" or "Bash(python:*)" */
    ruleDisplay: string;
    /** The source formatted for display, e.g. a file path or "--allowed-tools" */
    sourceDisplay: string;
};
/**
 * Finds all dangerous permissions from rules loaded from disk and CLI arguments.
 * Returns structured info about each dangerous permission found.
 *
 * Checks Bash permissions (wildcard/interpreter patterns), PowerShell permissions
 * (wildcard/iex/Start-Process patterns), and Agent permissions (any allow rule
 * bypasses the classifier's sub-agent evaluation).
 */
export declare function findDangerousClassifierPermissions(rules: PermissionRule[], cliAllowedTools: string[]): DangerousPermissionInfo[];
/**
 * Checks if a Bash allow rule is overly broad (equivalent to YOLO mode).
 * Returns true for tool-level Bash allow rules with no content restriction,
 * which auto-allow every bash command.
 *
 * Matches: Bash, Bash(*), Bash() — all parse to { toolName: 'Bash' } with no ruleContent.
 */
export declare function isOverlyBroadBashAllowRule(ruleValue: PermissionRuleValue): boolean;
/**
 * PowerShell equivalent of isOverlyBroadBashAllowRule.
 *
 * Matches: PowerShell, PowerShell(*), PowerShell() — all parse to
 * { toolName: 'PowerShell' } with no ruleContent.
 */
export declare function isOverlyBroadPowerShellAllowRule(ruleValue: PermissionRuleValue): boolean;
/**
 * Finds all overly broad Bash allow rules from settings and CLI arguments.
 * An overly broad rule allows ALL bash commands (e.g., Bash or Bash(*)),
 * which is effectively equivalent to YOLO/bypass-permissions mode.
 */
export declare function findOverlyBroadBashPermissions(rules: PermissionRule[], cliAllowedTools: string[]): DangerousPermissionInfo[];
/**
 * PowerShell equivalent of findOverlyBroadBashPermissions.
 */
export declare function findOverlyBroadPowerShellPermissions(rules: PermissionRule[], cliAllowedTools: string[]): DangerousPermissionInfo[];
/**
 * Removes dangerous permissions from the in-memory context, and optionally
 * persists the removal to settings files on disk.
 */
export declare function removeDangerousPermissions(context: ToolPermissionContext, dangerousPermissions: DangerousPermissionInfo[]): ToolPermissionContext;
/**
 * Prepares a ToolPermissionContext for auto mode by stripping
 * dangerous permissions that would bypass the classifier.
 * Returns the cleaned context (with mode unchanged — caller sets the mode).
 */
export declare function stripDangerousPermissionsForAutoMode(context: ToolPermissionContext): ToolPermissionContext;
/**
 * Restores dangerous allow rules previously stashed by
 * stripDangerousPermissionsForAutoMode. Called when leaving auto mode so that
 * the user's Bash(python:*), Agent(*), etc. rules work again in default mode.
 * Clears the stash so a second exit is a no-op.
 */
export declare function restoreDangerousPermissions(context: ToolPermissionContext): ToolPermissionContext;
/**
 * Handles all state transitions when switching permission modes.
 * Centralises side-effects so that every activation path (CLI Shift+Tab,
 * SDK control messages, etc.) behaves identically.
 *
 * Currently handles:
 * - Plan mode enter/exit attachments (via handlePlanModeTransition)
 * - Auto mode activation: setAutoModeActive, stripDangerousPermissionsForAutoMode
 *
 * Returns the (possibly modified) context. Caller is responsible for setting
 * the mode on the returned context.
 *
 * @param fromMode The current permission mode
 * @param toMode The target permission mode
 * @param context The current tool permission context
 */
export declare function transitionPermissionMode(fromMode: string, toMode: string, context: ToolPermissionContext): ToolPermissionContext;
/**
 * Parse base tools specification from CLI
 * Handles both preset names (default, none) and custom tool lists
 */
export declare function parseBaseToolsFromCLI(baseTools: string[]): string[];
/**
 * Safely convert CLI flags to a PermissionMode
 */
export declare function initialPermissionModeFromCLI({ permissionModeCli, dangerouslySkipPermissions, }: {
    permissionModeCli: string | undefined;
    dangerouslySkipPermissions: boolean | undefined;
}): {
    mode: PermissionMode;
    notification?: string;
};
export declare function parseToolListFromCLI(tools: string[]): string[];
export declare function initializeToolPermissionContext({ allowedToolsCli, disallowedToolsCli, baseToolsCli, permissionMode, allowDangerouslySkipPermissions, addDirs, }: {
    allowedToolsCli: string[];
    disallowedToolsCli: string[];
    baseToolsCli?: string[];
    permissionMode: PermissionMode;
    allowDangerouslySkipPermissions: boolean;
    addDirs: string[];
}): Promise<{
    toolPermissionContext: ToolPermissionContext;
    warnings: string[];
    dangerousPermissions: DangerousPermissionInfo[];
    overlyBroadBashPermissions: DangerousPermissionInfo[];
}>;
export type AutoModeGateCheckResult = {
    updateContext: (ctx: ToolPermissionContext) => ToolPermissionContext;
    notification?: string;
};
export type AutoModeUnavailableReason = 'settings' | 'circuit-breaker' | 'model';
export declare function getAutoModeUnavailableNotification(reason: AutoModeUnavailableReason): string;
/**
 * Async check of auto mode availability.
 *
 * Returns a transform function (not a pre-computed context) that callers
 * apply inside setAppState(prev => ...) against the CURRENT context. This
 * prevents the async GrowthBook await from clobbering mid-turn mode changes
 * (e.g., user shift-tabs to acceptEdits while this check is in flight).
 *
 * The transform re-checks mode/prePlanMode against the fresh ctx to avoid
 * kicking the user out of a mode they've already left during the await.
 */
export declare function verifyAutoModeGateAccess(currentContext: ToolPermissionContext, fastMode?: boolean): Promise<AutoModeGateCheckResult>;
/**
 * Core logic to check if bypassPermissions should be disabled based on Statsig gate
 */
export declare function shouldDisableBypassPermissions(): Promise<boolean>;
/**
 * Checks if auto mode can be entered: circuit breaker is not active and settings
 * have not disabled it. Synchronous.
 */
export declare function isAutoModeGateEnabled(): boolean;
/**
 * Returns the reason auto mode is currently unavailable, or null if available.
 * Synchronous — uses state populated by verifyAutoModeGateAccess.
 */
export declare function getAutoModeUnavailableReason(): AutoModeUnavailableReason | null;
/**
 * The `enabled` field in the tengu_auto_mode_config GrowthBook JSON config.
 * Controls auto mode availability in UI surfaces (CLI, IDE, Desktop).
 * - 'enabled': auto mode is available in the shift-tab carousel (or equivalent)
 * - 'disabled': auto mode is fully unavailable — circuit breaker for incident response
 * - 'opt-in': auto mode is available only if the user has explicitly opted in
 *   (via --enable-auto-mode in CLI, or a settings toggle in IDE/Desktop)
 */
export type AutoModeEnabledState = 'enabled' | 'disabled' | 'opt-in';
/**
 * Reads the `enabled` field from tengu_auto_mode_config (cached, may be stale).
 * Defaults to 'disabled' if GrowthBook is unavailable or the field is unset.
 * Other surfaces (IDE, Desktop) should call this to decide whether to surface
 * auto mode in their mode pickers.
 */
export declare function getAutoModeEnabledState(): AutoModeEnabledState;
/**
 * Like getAutoModeEnabledState but returns undefined when no cached value
 * exists (cold start, before GrowthBook init). Used by the sync
 * circuit-breaker check in initialPermissionModeFromCLI, which must not
 * conflate "not yet fetched" with "fetched and disabled" — the former
 * defers to verifyAutoModeGateAccess, the latter blocks immediately.
 */
export declare function getAutoModeEnabledStateIfCached(): AutoModeEnabledState | undefined;
/**
 * Returns true if the user has opted in to auto mode via any trusted mechanism:
 * - CLI flag (--enable-auto-mode / --permission-mode auto) — session-scoped
 *   availability request; the startup dialog in showSetupScreens enforces
 *   persistent consent before the REPL renders.
 * - skipAutoPermissionPrompt setting (persistent; set by accepting the opt-in
 *   dialog or by IDE/Desktop settings toggle)
 */
export declare function hasAutoModeOptInAnySource(): boolean;
/**
 * Checks if bypassPermissions mode is currently disabled by Statsig gate or settings.
 * This is a synchronous version that uses cached Statsig values.
 */
export declare function isBypassPermissionsModeDisabled(): boolean;
/**
 * Creates an updated context with bypassPermissions disabled
 */
export declare function createDisabledBypassPermissionsContext(currentContext: ToolPermissionContext): ToolPermissionContext;
/**
 * Asynchronously checks if the bypassPermissions mode should be disabled based on Statsig gate
 * and returns an updated toolPermissionContext if needed
 */
export declare function checkAndDisableBypassPermissions(currentContext: ToolPermissionContext): Promise<void>;
export declare function isDefaultPermissionModeAuto(): boolean;
/**
 * Whether plan mode should use auto mode semantics (classifier runs during
 * plan). True when the user has opted in to auto mode and the gate is enabled.
 * Evaluated at permission-check time so it's reactive to config changes.
 */
export declare function shouldPlanUseAutoMode(): boolean;
/**
 * Centralized plan-mode entry. Stashes the current mode as prePlanMode so
 * ExitPlanMode can restore it. When the user has opted in to auto mode,
 * auto semantics stay active during plan mode.
 */
export declare function prepareContextForPlanMode(context: ToolPermissionContext): ToolPermissionContext;
/**
 * Reconciles auto-mode state during plan mode after a settings change.
 * Compares desired state (shouldPlanUseAutoMode) against actual state
 * (isAutoModeActive) and activates/deactivates auto accordingly. No-op when
 * not in plan mode. Called from applySettingsChange so that toggling
 * useAutoModeDuringPlan mid-plan takes effect immediately.
 */
export declare function transitionPlanAutoMode(context: ToolPermissionContext): ToolPermissionContext;
//# sourceMappingURL=permissionSetup.d.ts.map