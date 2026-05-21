/**
 * Teammate utilities for agent swarm coordination
 *
 * These helpers identify whether this Claude Code instance is running as a
 * spawned teammate in a swarm. Teammates receive their identity via CLI
 * arguments (--agent-id, --team-name, etc.) which are stored in dynamicTeamContext.
 *
 * For in-process teammates (running in the same process), AsyncLocalStorage
 * provides isolated context per teammate, preventing concurrent overwrites.
 *
 * Priority order for identity resolution:
 * 1. AsyncLocalStorage (in-process teammates) - via teammateContext.ts
 * 2. dynamicTeamContext (tmux teammates via CLI args)
 */
export { createTeammateContext, getTeammateContext, isInProcessTeammate, runWithTeammateContext, type TeammateContext, } from './teammateContext.js';
import type { AppState } from '../state/AppState.js';
/**
 * Returns the parent session ID for this teammate.
 * For in-process teammates, this is the team lead's session ID.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux teammates).
 */
export declare function getParentSessionId(): string | undefined;
/**
 * Dynamic team context for runtime team joining.
 * When set, these values take precedence over environment variables.
 */
declare let dynamicTeamContext: {
    agentId: string;
    agentName: string;
    teamName: string;
    color?: string;
    planModeRequired: boolean;
    parentSessionId?: string;
} | null;
/**
 * Set the dynamic team context (called when joining a team at runtime)
 */
export declare function setDynamicTeamContext(context: {
    agentId: string;
    agentName: string;
    teamName: string;
    color?: string;
    planModeRequired: boolean;
    parentSessionId?: string;
} | null): void;
/**
 * Clear the dynamic team context (called when leaving a team)
 */
export declare function clearDynamicTeamContext(): void;
/**
 * Get the current dynamic team context (for inspection/debugging)
 */
export declare function getDynamicTeamContext(): typeof dynamicTeamContext;
/**
 * Returns the agent ID if this session is running as a teammate in a swarm,
 * or undefined if running as a standalone session.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux via CLI args).
 */
export declare function getAgentId(): string | undefined;
/**
 * Returns the agent name if this session is running as a teammate in a swarm.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux via CLI args).
 */
export declare function getAgentName(): string | undefined;
/**
 * Returns the team name if this session is part of a team.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux via CLI args) > passed teamContext.
 * Pass teamContext from AppState to support leaders who don't have dynamicTeamContext set.
 *
 * @param teamContext - Optional team context from AppState (for leaders)
 */
export declare function getTeamName(teamContext?: {
    teamName: string;
}): string | undefined;
/**
 * Returns true if this session is running as a teammate in a swarm.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux via CLI args).
 * For tmux teammates, requires BOTH an agent ID AND a team name.
 */
export declare function isTeammate(): boolean;
/**
 * Returns the teammate's assigned color,
 * or undefined if not running as a teammate or no color assigned.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux teammates).
 */
export declare function getTeammateColor(): string | undefined;
/**
 * Returns true if this teammate session requires plan mode before implementation.
 * When enabled, the teammate must enter plan mode and get approval before writing code.
 * Priority: AsyncLocalStorage > dynamicTeamContext > env var.
 */
export declare function isPlanModeRequired(): boolean;
/**
 * Check if this session is a team lead.
 *
 * A session is considered a team lead if:
 * 1. A team context exists with a leadAgentId, AND
 * 2. Either:
 *    - Our CLAUDE_CODE_AGENT_ID matches the leadAgentId, OR
 *    - We have no CLAUDE_CODE_AGENT_ID set (backwards compat: the original
 *      session that created the team before agent IDs were standardized)
 *
 * @param teamContext - The team context from AppState, if any
 * @returns true if this session is the team lead
 */
export declare function isTeamLead(teamContext: {
    leadAgentId: string;
} | undefined): boolean;
/**
 * Checks if there are any active in-process teammates running.
 * Used by headless/print mode to determine if we should wait for teammates
 * before exiting.
 */
export declare function hasActiveInProcessTeammates(appState: AppState): boolean;
/**
 * Checks if there are in-process teammates still actively working on tasks.
 * Returns true if any teammate is running but NOT idle (still processing).
 * Used to determine if we should wait before sending shutdown prompts.
 */
export declare function hasWorkingInProcessTeammates(appState: AppState): boolean;
/**
 * Returns a promise that resolves when all working in-process teammates become idle.
 * Registers callbacks on each working teammate's task - they call these when idle.
 * Returns immediately if no teammates are working.
 */
export declare function waitForTeammatesToBecomeIdle(setAppState: (f: (prev: AppState) => AppState) => void, appState: AppState): Promise<void>;
//# sourceMappingURL=teammate.d.ts.map