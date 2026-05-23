import type { ToolUseContext } from '../../../Tool.js';
import type { BackendType, PaneBackend, TeammateExecutor, TeammateMessage, TeammateSpawnConfig, TeammateSpawnResult } from './types.js';
/**
 * PaneBackendExecutor adapts a PaneBackend to the TeammateExecutor interface.
 *
 * This allows pane-based backends (tmux, iTerm2) to be used through the same
 * TeammateExecutor abstraction as InProcessBackend, making getTeammateExecutor()
 * return a meaningful executor regardless of execution mode.
 *
 * The adapter handles:
 * - spawn(): Creates a pane and sends the Claude CLI command to it
 * - sendMessage(): Writes to the teammate's file-based mailbox
 * - terminate(): Sends a shutdown request via mailbox
 * - kill(): Kills the pane via the backend
 * - isActive(): Checks if the pane is still running
 */
export declare class PaneBackendExecutor implements TeammateExecutor {
    readonly type: BackendType;
    private backend;
    private context;
    /**
     * Track spawned teammates by agentId -> paneId mapping.
     * This allows us to find the pane for operations like kill/terminate.
     */
    private spawnedTeammates;
    private cleanupRegistered;
    constructor(backend: PaneBackend);
    /**
     * Sets the ToolUseContext for this executor.
     * Must be called before spawn() to provide access to AppState and permissions.
     */
    setContext(context: ToolUseContext): void;
    /**
     * Checks if the underlying pane backend is available.
     */
    isAvailable(): Promise<boolean>;
    /**
     * Spawns a teammate in a new pane.
     *
     * Creates a pane via the backend, builds the CLI command with teammate
     * identity flags, and sends it to the pane.
     */
    spawn(config: TeammateSpawnConfig): Promise<TeammateSpawnResult>;
    /**
     * Sends a message to a pane-based teammate via file-based mailbox.
     *
     * All teammates (pane and in-process) use the same mailbox mechanism.
     */
    sendMessage(agentId: string, message: TeammateMessage): Promise<void>;
    /**
     * Gracefully terminates a pane-based teammate.
     *
     * For pane-based teammates, we send a shutdown request via mailbox and
     * let the teammate process handle exit gracefully.
     */
    terminate(agentId: string, reason?: string): Promise<boolean>;
    /**
     * Force kills a pane-based teammate by killing its pane.
     */
    kill(agentId: string): Promise<boolean>;
    /**
     * Checks if a pane-based teammate is still active.
     *
     * For pane-based teammates, we check if the pane still exists.
     * This is a best-effort check - the pane may exist but the process inside
     * may have exited.
     */
    isActive(agentId: string): Promise<boolean>;
}
/**
 * Creates a PaneBackendExecutor wrapping the given PaneBackend.
 */
export declare function createPaneBackendExecutor(backend: PaneBackend): PaneBackendExecutor;
//# sourceMappingURL=PaneBackendExecutor.d.ts.map