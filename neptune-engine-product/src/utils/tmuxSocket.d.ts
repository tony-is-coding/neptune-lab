/**
 * TMUX SOCKET ISOLATION
 * =====================
 * This module manages an isolated tmux socket for Claude's operations.
 *
 * WHY THIS EXISTS:
 * Without isolation, Claude could accidentally affect the user's tmux sessions.
 * For example, running `tmux kill-session` via the Bash tool would kill the
 * user's current session if they started Claude from within tmux.
 *
 * HOW IT WORKS:
 * 1. Claude creates its own tmux socket: `claude-<PID>` (e.g., `claude-12345`)
 * 2. ALL Tmux tool commands use this socket via the `-L` flag
 * 3. ALL Bash tool commands inherit TMUX env var pointing to this socket
 *    (set in Shell.ts via getClaudeTmuxEnv())
 *
 * This means ANY tmux command run through Claude - whether via the Tmux tool
 * directly or via Bash - will operate on Claude's isolated socket, NOT the
 * user's tmux session.
 *
 * IMPORTANT: The user's original TMUX env var is NOT used. After socket
 * initialization, getClaudeTmuxEnv() returns a value that overrides the
 * user's TMUX in all child processes spawned by Shell.ts.
 */
/**
 * Gets the socket name for Claude's isolated tmux session.
 * Format: claude-<PID>
 */
export declare function getClaudeSocketName(): string;
/**
 * Gets the socket path if the socket has been initialized.
 * Returns null if not yet initialized.
 */
export declare function getClaudeSocketPath(): string | null;
/**
 * Sets socket info after initialization.
 * Called after the tmux session is created.
 */
export declare function setClaudeSocketInfo(path: string, pid: number): void;
/**
 * Returns whether the socket has been initialized.
 */
export declare function isSocketInitialized(): boolean;
/**
 * Gets the TMUX environment variable value for Claude's isolated socket.
 *
 * CRITICAL: This value is used by Shell.ts to override the TMUX env var
 * in ALL child processes. This ensures that any `tmux` command run via
 * the Bash tool will operate on Claude's socket, NOT the user's session.
 *
 * Format: "socket_path,server_pid,pane_index" (matches tmux's TMUX env var)
 * Example: "/tmp/tmux-501/claude-12345,54321,0"
 *
 * Returns null if socket is not yet initialized.
 * When null, Shell.ts does not override TMUX, preserving user's environment.
 */
export declare function getClaudeTmuxEnv(): string | null;
/**
 * Checks if tmux is available on this system.
 * This is checked once and cached for the lifetime of the process.
 *
 * When tmux is not available:
 * - TungstenTool (Tmux) will not work
 * - TeammateTool will not work (it uses tmux for pane management)
 * - Bash commands will run without tmux isolation
 */
export declare function checkTmuxAvailable(): Promise<boolean>;
/**
 * Returns the cached tmux availability status.
 * Returns false if availability hasn't been checked yet.
 * Use checkTmuxAvailable() to perform the check.
 */
export declare function isTmuxAvailable(): boolean;
/**
 * Marks that the Tmux tool has been used at least once.
 * Called by TungstenTool before initialization.
 * After this is called, Shell.ts will initialize the socket for subsequent Bash commands.
 */
export declare function markTmuxToolUsed(): void;
/**
 * Returns whether the Tmux tool has been used at least once.
 * Used by Shell.ts to decide whether to initialize the socket.
 */
export declare function hasTmuxToolBeenUsed(): boolean;
/**
 * Ensures the socket is initialized with a tmux session.
 * Called by Shell.ts when the Tmux tool has been used or the command includes "tmux".
 * Safe to call multiple times; will only initialize once.
 *
 * If tmux is not installed, this function returns gracefully without
 * initializing the socket. getClaudeTmuxEnv() will return null, and
 * Bash commands will run without tmux isolation.
 */
export declare function ensureSocketInitialized(): Promise<void>;
export declare function resetSocketState(): void;
//# sourceMappingURL=tmuxSocket.d.ts.map