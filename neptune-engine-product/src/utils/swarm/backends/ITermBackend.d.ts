import type { AgentColorName } from '@neptune/builtin-tools/tools/AgentTool/agentColorManager.js';
import type { CreatePaneResult, PaneBackend, PaneId } from './types.js';
/**
 * ITermBackend implements pane management using iTerm2's native split panes
 * via the it2 CLI tool.
 */
export declare class ITermBackend implements PaneBackend {
    readonly type: "iterm2";
    readonly displayName = "iTerm2";
    readonly supportsHideShow = false;
    /**
     * Checks if iTerm2 backend is available (in iTerm2 with it2 CLI installed).
     */
    isAvailable(): Promise<boolean>;
    /**
     * Checks if we're currently running inside iTerm2.
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
    sendCommandToPane(paneId: PaneId, command: string, _useExternalSession?: boolean): Promise<void>;
    /**
     * No-op for iTerm2 - tab colors would require escape sequences but we skip
     * them for performance (each it2 call is slow).
     */
    setPaneBorderColor(_paneId: PaneId, _color: AgentColorName, _useExternalSession?: boolean): Promise<void>;
    /**
     * No-op for iTerm2 - titles would require escape sequences but we skip
     * them for performance (each it2 call is slow).
     */
    setPaneTitle(_paneId: PaneId, _name: string, _color: AgentColorName, _useExternalSession?: boolean): Promise<void>;
    /**
     * No-op for iTerm2 - pane titles are shown in tabs automatically.
     */
    enablePaneBorderStatus(_windowTarget?: string, _useExternalSession?: boolean): Promise<void>;
    /**
     * No-op for iTerm2 - pane balancing is handled automatically.
     */
    rebalancePanes(_windowTarget: string, _hasLeader: boolean): Promise<void>;
    /**
     * Kills/closes a specific pane using the it2 CLI.
     * Also removes the pane from tracked session IDs so subsequent spawns
     * don't try to split from a dead session.
     */
    killPane(paneId: PaneId, _useExternalSession?: boolean): Promise<boolean>;
    /**
     * Stub for hiding a pane - not supported in iTerm2 backend.
     * iTerm2 doesn't have a direct equivalent to tmux's break-pane.
     */
    hidePane(_paneId: PaneId, _useExternalSession?: boolean): Promise<boolean>;
    /**
     * Stub for showing a hidden pane - not supported in iTerm2 backend.
     * iTerm2 doesn't have a direct equivalent to tmux's join-pane.
     */
    showPane(_paneId: PaneId, _targetWindowOrPane: string, _useExternalSession?: boolean): Promise<boolean>;
}
//# sourceMappingURL=ITermBackend.d.ts.map