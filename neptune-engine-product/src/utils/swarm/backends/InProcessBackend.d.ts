import type { ToolUseContext } from '../../../Tool.js';
import type { TeammateExecutor, TeammateMessage, TeammateSpawnConfig, TeammateSpawnResult } from './types.js';
/**
 * InProcessBackend implements TeammateExecutor for in-process teammates.
 *
 * Unlike pane-based backends (tmux/iTerm2), in-process teammates run in the
 * same Node.js process with isolated context via AsyncLocalStorage. They:
 * - Share resources (API client, MCP connections) with the leader
 * - Communicate via file-based mailbox (same as pane-based teammates)
 * - Are terminated via AbortController (not kill-pane)
 *
 * IMPORTANT: Before spawning, call setContext() to provide the ToolUseContext
 * needed for AppState access. This is intended for use via the TeammateExecutor
 * abstraction (getTeammateExecutor() in registry.ts).
 */
export declare class InProcessBackend implements TeammateExecutor {
    readonly type: "in-process";
    /**
     * Tool use context for AppState access.
     * Must be set via setContext() before spawn() is called.
     */
    private context;
    /**
     * Sets the ToolUseContext for this backend.
     * Called by TeammateTool before spawning to provide AppState access.
     */
    setContext(context: ToolUseContext): void;
    /**
     * In-process backend is always available (no external dependencies).
     */
    isAvailable(): Promise<boolean>;
    /**
     * Spawns an in-process teammate.
     *
     * Uses spawnInProcessTeammate() to:
     * 1. Create TeammateContext via createTeammateContext()
     * 2. Create independent AbortController (not linked to parent)
     * 3. Register teammate in AppState.tasks
     * 4. Start agent execution via startInProcessTeammate()
     * 5. Return spawn result with agentId, taskId, abortController
     */
    spawn(config: TeammateSpawnConfig): Promise<TeammateSpawnResult>;
    /**
     * Sends a message to an in-process teammate.
     *
     * All teammates use file-based mailboxes for simplicity.
     */
    sendMessage(agentId: string, message: TeammateMessage): Promise<void>;
    /**
     * Gracefully terminates an in-process teammate.
     *
     * Sends a shutdown request message to the teammate and sets the
     * shutdownRequested flag. The teammate processes the request and
     * either approves (exits) or rejects (continues working).
     *
     * Unlike pane-based teammates, in-process teammates handle their own
     * exit via the shutdown flow - no external killPane() is needed.
     */
    terminate(agentId: string, reason?: string): Promise<boolean>;
    /**
     * Force kills an in-process teammate immediately.
     *
     * Uses the teammate's AbortController to cancel all async operations
     * and updates the task state to 'killed'.
     */
    kill(agentId: string): Promise<boolean>;
    /**
     * Checks if an in-process teammate is still active.
     *
     * Returns true if the teammate exists, has status 'running',
     * and its AbortController has not been aborted.
     */
    isActive(agentId: string): Promise<boolean>;
}
/**
 * Factory function to create an InProcessBackend instance.
 * Used by the registry (Task #8) to get backend instances.
 */
export declare function createInProcessBackend(): InProcessBackend;
//# sourceMappingURL=InProcessBackend.d.ts.map