/**
 * Checks if we're currently running inside a tmux session (synchronous version).
 * Uses the original TMUX value captured at module load, not process.env.TMUX,
 * because Shell.ts overrides TMUX when Claude's socket is initialized.
 *
 * IMPORTANT: We ONLY check the TMUX env var. We do NOT run `tmux display-message`
 * as a fallback because that command will succeed if ANY tmux server is running
 * on the system, not just if THIS process is inside tmux.
 */
export declare function isInsideTmuxSync(): boolean;
/**
 * Checks if we're currently running inside a tmux session.
 * Uses the original TMUX value captured at module load, not process.env.TMUX,
 * because Shell.ts overrides TMUX when Claude's socket is initialized.
 * Caches the result since this won't change during the process lifetime.
 *
 * IMPORTANT: We ONLY check the TMUX env var. We do NOT run `tmux display-message`
 * as a fallback because that command will succeed if ANY tmux server is running
 * on the system, not just if THIS process is inside tmux.
 */
export declare function isInsideTmux(): Promise<boolean>;
/**
 * Gets the leader's tmux pane ID captured at module load.
 * Returns null if not running inside tmux.
 */
export declare function getLeaderPaneId(): string | null;
/**
 * Checks if tmux is available on the system (installed and in PATH).
 */
export declare function isTmuxAvailable(): Promise<boolean>;
/**
 * Checks if we're currently running inside iTerm2.
 * Uses multiple detection methods:
 * 1. TERM_PROGRAM env var set to "iTerm.app"
 * 2. ITERM_SESSION_ID env var is present
 * 3. env.terminal detection from utils/env.ts
 *
 * Caches the result since this won't change during the process lifetime.
 *
 * Note: iTerm2 backend uses AppleScript (osascript) which is built into macOS,
 * so no external CLI tool installation is required.
 */
export declare function isInITerm2(): boolean;
/**
 * The it2 CLI command name.
 */
export declare const IT2_COMMAND = "it2";
/**
 * Checks if the it2 CLI tool is available AND can reach the iTerm2 Python API.
 * Uses 'session list' (not '--version') because --version succeeds even when
 * the Python API is disabled in iTerm2 preferences — which would cause
 * 'session split' to fail later with no fallback.
 */
export declare function isIt2CliAvailable(): Promise<boolean>;
/**
 * Resets all cached detection results. Used for testing.
 */
export declare function resetDetectionCache(): void;
//# sourceMappingURL=detection.d.ts.map