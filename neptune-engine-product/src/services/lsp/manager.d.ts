import { type LSPServerManager } from './LSPServerManager.js';
/**
 * Test-only sync reset. shutdownLspServerManager() is async and tears down
 * real connections; this only clears the module-scope singleton state so
 * reinitializeLspServerManager() early-returns on 'not-started' in downstream
 * tests on the same shard.
 */
export declare function _resetLspManagerForTesting(): void;
/**
 * Get the singleton LSP server manager instance.
 * Returns undefined if not yet initialized, initialization failed, or still pending.
 *
 * Callers should check for undefined and handle gracefully, as initialization happens
 * asynchronously during Claude Code startup. Use getInitializationStatus() to
 * distinguish between pending, failed, and not-started states.
 */
export declare function getLspServerManager(): LSPServerManager | undefined;
/**
 * Get the current initialization status of the LSP server manager.
 *
 * @returns Status object with current state and error (if failed)
 */
export declare function getInitializationStatus(): {
    status: 'not-started';
} | {
    status: 'pending';
} | {
    status: 'success';
} | {
    status: 'failed';
    error: Error;
};
/**
 * Check whether at least one language server is connected and healthy.
 * Backs LSPTool.isEnabled().
 */
export declare function isLspConnected(): boolean;
/**
 * Wait for LSP server manager initialization to complete.
 *
 * Returns immediately if initialization has already completed (success or failure).
 * If initialization is pending, waits for it to complete.
 * If initialization hasn't started, returns immediately.
 *
 * @returns Promise that resolves when initialization is complete
 */
export declare function waitForInitialization(): Promise<void>;
/**
 * Initialize the LSP server manager singleton.
 *
 * This function is called during Claude Code startup. It synchronously creates
 * the manager instance, then starts async initialization (loading LSP configs)
 * in the background without blocking the startup process.
 *
 * Safe to call multiple times - will only initialize once (idempotent).
 * However, if initialization previously failed, calling again will retry.
 */
export declare function initializeLspServerManager(): void;
/**
 * Force re-initialization of the LSP server manager, even after a prior
 * successful init. Called from refreshActivePlugins() after plugin caches
 * are cleared, so newly-loaded plugin LSP servers are picked up.
 *
 * Fixes https://github.com/anthropics/claude-code/issues/15521:
 * loadAllPlugins() is memoized and can be called very early in startup
 * (via getCommands prefetch in setup.ts) before marketplaces are reconciled,
 * caching an empty plugin list. initializeLspServerManager() then reads that
 * stale memoized result and initializes with 0 servers. Unlike commands/agents/
 * hooks/MCP, LSP was never re-initialized on plugin refresh.
 *
 * Safe to call when no LSP plugins changed: initialize() is just config
 * parsing (servers are lazy-started on first use). Also safe during pending
 * init: the generation counter invalidates the in-flight promise.
 */
export declare function reinitializeLspServerManager(): void;
/**
 * Shutdown the LSP server manager and clean up resources.
 *
 * This should be called during Claude Code shutdown. Stops all running LSP servers
 * and clears internal state. Safe to call when not initialized (no-op).
 *
 * NOTE: Errors during shutdown are logged for monitoring but NOT propagated to the caller.
 * State is always cleared even if shutdown fails, to prevent resource accumulation.
 * This is acceptable during application exit when recovery is not possible.
 *
 * @returns Promise that resolves when shutdown completes (errors are swallowed)
 */
export declare function shutdownLspServerManager(): Promise<void>;
//# sourceMappingURL=manager.d.ts.map