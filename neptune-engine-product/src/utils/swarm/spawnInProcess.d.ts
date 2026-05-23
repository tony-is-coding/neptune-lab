/**
 * In-process teammate spawning
 *
 * Creates and registers an in-process teammate task. Unlike process-based
 * teammates (tmux/iTerm2), in-process teammates run in the same Node.js
 * process using AsyncLocalStorage for context isolation.
 *
 * The actual agent execution loop is handled by InProcessTeammateTask
 * component (Task #14). This module handles:
 * 1. Creating TeammateContext
 * 2. Creating linked AbortController
 * 3. Registering InProcessTeammateTaskState in AppState
 * 4. Returning spawn result for backend
 */
import type { AppState } from '../../state/AppState.js';
import { createTeammateContext } from '../teammateContext.js';
type SetAppStateFn = (updater: (prev: AppState) => AppState) => void;
/**
 * Minimal context required for spawning an in-process teammate.
 * This is a subset of ToolUseContext - only what spawnInProcessTeammate actually uses.
 */
export type SpawnContext = {
    setAppState: SetAppStateFn;
    toolUseId?: string;
};
/**
 * Configuration for spawning an in-process teammate.
 */
export type InProcessSpawnConfig = {
    /** Display name for the teammate, e.g., "researcher" */
    name: string;
    /** Team this teammate belongs to */
    teamName: string;
    /** Initial prompt/task for the teammate */
    prompt: string;
    /** Optional UI color for the teammate */
    color?: string;
    /** Whether teammate must enter plan mode before implementing */
    planModeRequired: boolean;
    /** Optional model override for this teammate */
    model?: string;
};
/**
 * Result from spawning an in-process teammate.
 */
export type InProcessSpawnOutput = {
    /** Whether spawn was successful */
    success: boolean;
    /** Full agent ID (format: "name@team") */
    agentId: string;
    /** Task ID for tracking in AppState */
    taskId?: string;
    /** AbortController for this teammate (linked to parent) */
    abortController?: AbortController;
    /** Teammate context for AsyncLocalStorage */
    teammateContext?: ReturnType<typeof createTeammateContext>;
    /** Error message if spawn failed */
    error?: string;
};
/**
 * Spawns an in-process teammate.
 *
 * Creates the teammate's context, registers the task in AppState, and returns
 * the spawn result. The actual agent execution is driven by the
 * InProcessTeammateTask component which uses runWithTeammateContext() to
 * execute the agent loop with proper identity isolation.
 *
 * @param config - Spawn configuration
 * @param context - Context with setAppState for registering task
 * @returns Spawn result with teammate info
 */
export declare function spawnInProcessTeammate(config: InProcessSpawnConfig, context: SpawnContext): Promise<InProcessSpawnOutput>;
/**
 * Kills an in-process teammate by aborting its controller.
 *
 * Note: This is the implementation called by InProcessBackend.kill().
 *
 * @param taskId - Task ID of the teammate to kill
 * @param setAppState - AppState setter
 * @returns true if killed successfully
 */
export declare function killInProcessTeammate(taskId: string, setAppState: SetAppStateFn): boolean;
export {};
//# sourceMappingURL=spawnInProcess.d.ts.map