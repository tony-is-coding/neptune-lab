import { z } from 'zod/v4';
import type { PermissionMode } from '../permissions/PermissionMode.js';
import { type BackendType } from './backends/types.js';
export declare const inputSchema: () => z.ZodObject<{
    operation: z.ZodEnum<{
        cleanup: "cleanup";
        spawnTeam: "spawnTeam";
    }>;
    agent_type: z.ZodOptional<z.ZodString>;
    team_name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type SpawnTeamOutput = {
    team_name: string;
    team_file_path: string;
    lead_agent_id: string;
};
export type CleanupOutput = {
    success: boolean;
    message: string;
    team_name?: string;
};
export type TeamAllowedPath = {
    path: string;
    toolName: string;
    addedBy: string;
    addedAt: number;
};
export type TeamFile = {
    name: string;
    description?: string;
    createdAt: number;
    leadAgentId: string;
    leadSessionId?: string;
    hiddenPaneIds?: string[];
    teamAllowedPaths?: TeamAllowedPath[];
    members: Array<{
        agentId: string;
        name: string;
        agentType?: string;
        model?: string;
        prompt?: string;
        color?: string;
        planModeRequired?: boolean;
        joinedAt: number;
        tmuxPaneId: string;
        cwd: string;
        worktreePath?: string;
        sessionId?: string;
        subscriptions: string[];
        backendType?: BackendType;
        isActive?: boolean;
        mode?: PermissionMode;
    }>;
};
export type Input = z.infer<ReturnType<typeof inputSchema>>;
export type Output = SpawnTeamOutput;
/**
 * Sanitizes a name for use in tmux window names, worktree paths, and file paths.
 * Replaces all non-alphanumeric characters with hyphens and lowercases.
 */
export declare function sanitizeName(name: string): string;
/**
 * Sanitizes an agent name for use in deterministic agent IDs.
 * Replaces @ with - to prevent ambiguity in the agentName@teamName format.
 */
export declare function sanitizeAgentName(name: string): string;
/**
 * Gets the path to a team's directory
 */
export declare function getTeamDir(teamName: string): string;
/**
 * Gets the path to a team's config.json file
 */
export declare function getTeamFilePath(teamName: string): string;
/**
 * Reads a team file by name (sync — for sync contexts like React render paths)
 * @internal Exported for team discovery UI
 */
export declare function readTeamFile(teamName: string): TeamFile | null;
/**
 * Reads a team file by name (async — for tool handlers and other async contexts)
 */
export declare function readTeamFileAsync(teamName: string): Promise<TeamFile | null>;
/**
 * Writes a team file (async — for tool handlers)
 */
export declare function writeTeamFileAsync(teamName: string, teamFile: TeamFile): Promise<void>;
/**
 * Removes a teammate from the team file by agent ID or name.
 * Used by the leader when processing shutdown approvals.
 */
export declare function removeTeammateFromTeamFile(teamName: string, identifier: {
    agentId?: string;
    name?: string;
}): boolean;
/**
 * Adds a pane ID to the hidden panes list in the team file.
 * @param teamName - The name of the team
 * @param paneId - The pane ID to hide
 * @returns true if the pane was added to hidden list, false if team doesn't exist
 */
export declare function addHiddenPaneId(teamName: string, paneId: string): boolean;
/**
 * Removes a pane ID from the hidden panes list in the team file.
 * @param teamName - The name of the team
 * @param paneId - The pane ID to show (remove from hidden list)
 * @returns true if the pane was removed from hidden list, false if team doesn't exist
 */
export declare function removeHiddenPaneId(teamName: string, paneId: string): boolean;
/**
 * Removes a teammate from the team config file by pane ID.
 * Also removes from hiddenPaneIds if present.
 * @param teamName - The name of the team
 * @param tmuxPaneId - The pane ID of the teammate to remove
 * @returns true if the member was removed, false if team or member doesn't exist
 */
export declare function removeMemberFromTeam(teamName: string, tmuxPaneId: string): boolean;
/**
 * Removes a teammate from a team's member list by agent ID.
 * Use this for in-process teammates which all share the same tmuxPaneId.
 * @param teamName - The name of the team
 * @param agentId - The agent ID of the teammate to remove (e.g., "researcher@my-team")
 * @returns true if the member was removed, false if team or member doesn't exist
 */
export declare function removeMemberByAgentId(teamName: string, agentId: string): boolean;
/**
 * Sets a team member's permission mode.
 * Called when the team leader changes a teammate's mode via the TeamsDialog.
 * @param teamName - The name of the team
 * @param memberName - The name of the member to update
 * @param mode - The new permission mode
 */
export declare function setMemberMode(teamName: string, memberName: string, mode: PermissionMode): boolean;
/**
 * Sync the current teammate's mode to config.json so team lead sees it.
 * No-op if not running as a teammate.
 * @param mode - The permission mode to sync
 * @param teamNameOverride - Optional team name override (uses env var if not provided)
 */
export declare function syncTeammateMode(mode: PermissionMode, teamNameOverride?: string): void;
/**
 * Sets multiple team members' permission modes in a single atomic operation.
 * Avoids race conditions when updating multiple teammates at once.
 * @param teamName - The name of the team
 * @param modeUpdates - Array of {memberName, mode} to update
 */
export declare function setMultipleMemberModes(teamName: string, modeUpdates: Array<{
    memberName: string;
    mode: PermissionMode;
}>): boolean;
/**
 * Sets a team member's active status.
 * Called when a teammate becomes idle (isActive=false) or starts a new turn (isActive=true).
 * @param teamName - The name of the team
 * @param memberName - The name of the member to update
 * @param isActive - Whether the member is active (true) or idle (false)
 */
export declare function setMemberActive(teamName: string, memberName: string, isActive: boolean): Promise<void>;
/**
 * Mark a team as created this session so it gets cleaned up on exit.
 * Call this right after the initial writeTeamFile. TeamDelete should
 * call unregisterTeamForSessionCleanup to prevent double-cleanup.
 * Backing Set lives in bootstrap/state.ts so resetStateForTests()
 * clears it between tests (avoids the PR #17615 cross-shard leak class).
 */
export declare function registerTeamForSessionCleanup(teamName: string): void;
/**
 * Remove a team from session cleanup tracking (e.g., after explicit
 * TeamDelete — already cleaned, don't try again on shutdown).
 */
export declare function unregisterTeamForSessionCleanup(teamName: string): void;
/**
 * Clean up all teams created this session that weren't explicitly deleted.
 * Registered with gracefulShutdown from init.ts.
 */
export declare function cleanupSessionTeams(): Promise<void>;
/**
 * Cleans up team and task directories for a given team name.
 * Also cleans up git worktrees created for teammates.
 * Called when a swarm session is terminated.
 */
export declare function cleanupTeamDirectories(teamName: string): Promise<void>;
//# sourceMappingURL=teamHelpers.d.ts.map