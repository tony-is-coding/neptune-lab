/**
 * True when running under `tmux -CC` (iTerm2 integration mode).
 *
 * The alt-screen / mouse-tracking path in fullscreen mode is unrecoverable
 * in -CC mode (double-click corrupts terminal state; mouse wheel is dead),
 * so callers auto-disable fullscreen.
 *
 * Lazily probes tmux on first call when the env heuristic can't decide.
 */
export declare function isTmuxControlMode(): boolean;
export declare function _resetTmuxControlModeProbeForTesting(): void;
/**
 * Runtime env-var check only. Ants default to on (CLAUDE_CODE_NO_FLICKER=0
 * to opt out); external users default to off (CLAUDE_CODE_NO_FLICKER=1 to
 * opt in).
 */
export declare function isFullscreenEnvEnabled(): boolean;
/**
 * Whether fullscreen mode should enable SGR mouse tracking (DEC 1000/1002/1006).
 * Set CLAUDE_CODE_DISABLE_MOUSE=1 to keep alt-screen + virtualized scroll
 * (keyboard PgUp/PgDn/Ctrl+Home/End still work) but skip mouse capture,
 * so tmux/kitty/terminal-native copy-on-select keeps working.
 *
 * Compare with CLAUDE_CODE_NO_FLICKER=0 which is all-or-nothing — it also
 * disables alt-screen and virtualized scrollback.
 */
export declare function isMouseTrackingEnabled(): boolean;
/**
 * Whether mouse click handling is disabled (clicks/drags ignored, wheel still
 * works). Set CLAUDE_CODE_DISABLE_MOUSE_CLICKS=1 to prevent accidental clicks
 * from triggering cursor positioning, text selection, or message expansion.
 *
 * Fullscreen-specific — only reachable when CLAUDE_CODE_NO_FLICKER is active.
 */
export declare function isMouseClicksDisabled(): boolean;
/**
 * True when the fullscreen alt-screen layout is actually rendering —
 * requires an interactive REPL session AND the env var not explicitly
 * set falsy. Headless paths (--print, SDK, in-process teammates) never
 * enter fullscreen, so features that depend on alt-screen re-rendering
 * should gate on this.
 */
export declare function isFullscreenActive(): boolean;
/**
 * One-time hint for tmux users in fullscreen with `mouse off`.
 *
 * tmux's `mouse` option is session-scoped by design — there is no
 * pane-level equivalent. We used to `tmux set mouse on` when entering
 * alt-screen so wheel scrolling worked, but that changed mouse behavior
 * for every sibling pane (vim, less, shell) and leaked on kill-pane or
 * when multiple CC instances raced on restore. Now we leave tmux state
 * alone — same as vim/less/htop — and just tell the user their options.
 *
 * Fire-and-forget from REPL startup. Returns the hint text once per
 * session if TMUX is set, fullscreen is active, and tmux's current
 * `mouse` option is off; null otherwise.
 */
export declare function maybeGetTmuxMouseHint(): Promise<string | null>;
/** Test-only: reset module-level once-per-session flags. */
export declare function _resetForTesting(): void;
//# sourceMappingURL=fullscreen.d.ts.map