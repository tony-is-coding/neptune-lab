import type { AgentColorName } from '@neptune/builtin-tools/tools/AgentTool/agentColorManager.js';
/**
 * Assigns a unique color to a teammate from the available palette.
 * Colors are assigned in round-robin order.
 */
export declare function assignTeammateColor(teammateId: string): AgentColorName;
/**
 * Gets the assigned color for a teammate, if any.
 */
export declare function getTeammateColor(teammateId: string): AgentColorName | undefined;
/**
 * Clears all teammate color assignments.
 * Called during team cleanup to reset state for potential new teams.
 */
export declare function clearTeammateColors(): void;
/**
 * Checks if we're currently running inside a tmux session.
 * Uses the detection module directly for this check.
 */
export declare function isInsideTmux(): Promise<boolean>;
/**
 * Creates a new teammate pane in the swarm view.
 * Automatically selects the appropriate backend (tmux or iTerm2) based on environment.
 *
 * When running INSIDE tmux:
 * - Uses TmuxBackend to split the current window
 * - Leader stays on left (30%), teammates on right (70%)
 *
 * When running in iTerm2 (not in tmux) with it2 CLI:
 * - Uses ITermBackend for native iTerm2 split panes
 *
 * When running OUTSIDE tmux/iTerm2:
 * - Falls back to TmuxBackend with external claude-swarm session
 */
export declare function createTeammatePaneInSwarmView(teammateName: string, teammateColor: AgentColorName): Promise<{
    paneId: string;
    isFirstTeammate: boolean;
}>;
/**
 * Enables pane border status for a window (shows pane titles).
 * Delegates to the detected backend.
 */
export declare function enablePaneBorderStatus(windowTarget?: string, useSwarmSocket?: boolean): Promise<void>;
/**
 * Sends a command to a specific pane.
 * Delegates to the detected backend.
 */
export declare function sendCommandToPane(paneId: string, command: string, useSwarmSocket?: boolean): Promise<void>;
//# sourceMappingURL=teammateLayoutManager.d.ts.map