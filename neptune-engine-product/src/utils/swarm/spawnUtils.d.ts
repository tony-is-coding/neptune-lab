/**
 * Shared utilities for spawning teammates across different backends.
 */
import type { PermissionMode } from '../permissions/PermissionMode.js';
/**
 * Gets the command to use for spawning teammate processes.
 * Uses TEAMMATE_COMMAND_ENV_VAR if set, otherwise falls back to the
 * current process executable path.
 */
export declare function getTeammateCommand(): string;
/**
 * Builds CLI flags to propagate from the current session to spawned teammates.
 * This ensures teammates inherit important settings like permission mode,
 * model selection, and plugin configuration from their parent.
 *
 * @param options.planModeRequired - If true, don't inherit bypass permissions (plan mode takes precedence)
 * @param options.permissionMode - Permission mode to propagate
 */
export declare function buildInheritedCliFlags(options?: {
    planModeRequired?: boolean;
    permissionMode?: PermissionMode;
}): string;
/**
 * Builds the `env KEY=VALUE ...` string for teammate spawn commands.
 * Always includes CLAUDECODE=1 and CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1,
 * plus any provider/config env vars that are set in the current process.
 */
export declare function buildInheritedEnvVars(): string;
//# sourceMappingURL=spawnUtils.d.ts.map