/**
 * Python Bridge Client — manages a long-lived Python subprocess for Windows
 * Computer Use operations.
 *
 * Replaces per-call PowerShell spawning with a persistent Python process
 * that communicates via JSON lines over stdin/stdout.
 *
 * Performance: ~1-5ms per call vs ~200-500ms per PowerShell spawn.
 */
/**
 * Start the Python bridge process if not already running.
 */
export declare function ensureBridge(): boolean;
/**
 * Send a request to the Python bridge and wait for the response.
 */
export declare function call<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T>;
/**
 * Synchronous call — blocks the event loop. Use sparingly.
 * Falls back to PowerShell if bridge is not available.
 */
export declare function callSync<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs?: number): T | null;
/**
 * Kill the bridge process.
 */
export declare function stopBridge(): void;
//# sourceMappingURL=bridgeClient.d.ts.map