import type { AgentColorName } from '@neptune/builtin-tools/tools/AgentTool/agentColorManager.js';
import type { CreatePaneResult, PaneBackend, PaneId } from './types.js';
/**
 * TmuxBackend implements PaneBackend using tmux for pane management.
 *
 * When running INSIDE tmux (leader is in tmux):
 * - Splits the current window to add teammates alongside the leader
 * - Leader stays on left (30%), teammates on right (70%)
 *
 * When running OUTSIDE tmux (leader is in regular terminal):
 * - Creates a claude-swarm session with a swarm-view window
 * - All teammates are equally distributed (no leader pane)
 */
export declare class TmuxBackend implements PaneBackend {
    readonly type: "tmux";
    readonly displayName = "tmux";
    readonly supportsHideShow = true;
    /**
     * Checks if tmux is installed and available.
     * Delegates to detection.ts for consistent detection logic.
     */
    isAvailable(): Promise<boolean>;
    /**
     * Checks if we're currently running inside a tmux session.
     * Delegates to detection.ts for consistent detection logic.
     */
    isRunningInside(): Promise<boolean>;
    /**
     * Creates a new teammate pane in the swarm view.
     * Uses a lock to prevent race conditions when multiple teammates are spawned in parallel.
     */
    createTeammatePaneInSwarmView(name: string, color: AgentColorName): Promise<CreatePaneResult>;
    /**
     * Sends a command to a specific pane.
     */
    sendCommandToPane(paneId: PaneId, command: string, useExternalSession?: boolean): Promise<void>;
    /**
     * Sets the border color for a specific pane.
     */
    setPaneBorderColor(paneId: PaneId, color: AgentColorName, useExternalSession?: boolean): Promise<void>;
    /**
     * Sets the title for a pane (shown in pane border if pane-border-status is set).
     */
    setPaneTitle(paneId: PaneId, name: string, color: AgentColorName, useExternalSession?: boolean): Promise<void>;
    /**
     * Enables pane border status for a window (shows pane titles).
     */
    enablePaneBorderStatus(windowTarget?: string, useExternalSession?: boolean): Promise<void>;
    /**
     * Rebalances panes to achieve the desired layout.
     */
    rebalancePanes(windowTarget: string, hasLeader: boolean): Promise<void>;
    /**
     * Kills/closes a specific pane.
     */
    killPane(paneId: PaneId, useExternalSession?: boolean): Promise<boolean>;
    /**
     * Hides a pane by moving it to a detached hidden session.
     * Creates the hidden session if it doesn't exist, then uses break-pane to move the pane there.
     */
    hidePane(paneId: PaneId, useExternalSession?: boolean): Promise<boolean>;
    /**
     * Shows a previously hidden pane by joining it back into the target window.
     * Uses `tmux join-pane` to move the pane back, then reapplies main-vertical layout
     * with leader at 30%.
     */
    showPane(paneId: PaneId, targetWindowOrPane: string, useExternalSession?: boolean): Promise<boolean>;
    /**
     * Gets the leader's pane ID.
     * Uses the TMUX_PANE env var captured at module load to ensure we always
     * get the leader's original pane, even if the user has switched panes.
     */
    private getCurrentPaneId;
    /**
     * Gets the leader's window target (session:window format).
     * Uses the leader's pane ID to query for its window, ensuring we get the
     * correct window even if the user has switched to a different window.
     * Caches the result since the leader's window won't change.
     */
    private getCurrentWindowTarget;
    /**
     * Gets the number of panes in a window.
     */
    private getCurrentWindowPaneCount;
    /**
     * Checks if a tmux session exists in the swarm socket.
     */
    private hasSessionInSwarm;
    /**
     * Creates the swarm session with a single window for teammates when running outside tmux.
     */
    private createExternalSwarmSession;
    /**
     * Creates a teammate pane when running inside tmux (with leader).
     */
    private createTeammatePaneWithLeader;
    /**
     * Creates a teammate pane when running outside tmux (no leader in tmux).
     */
    private createTeammatePaneExternal;
    /**
     * Rebalances panes in a window with a leader.
     */
    private rebalancePanesWithLeader;
    /**
     * Rebalances panes in a window without a leader (tiled layout).
     */
    private rebalancePanesTiled;
}
//# sourceMappingURL=TmuxBackend.d.ts.map