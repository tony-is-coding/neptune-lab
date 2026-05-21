/**
 * Terminal dark/light mode detection for the 'auto' theme setting.
 *
 * Detection is based on the terminal's actual background color (queried via
 * OSC 11 by systemThemeWatcher.ts) rather than the OS appearance setting —
 * a dark terminal on a light-mode OS should still resolve to 'dark'.
 *
 * The detected theme is cached module-level so callers can resolve 'auto'
 * without awaiting the async OSC round-trip. The cache is seeded from
 * $COLORFGBG (synchronous, set by some terminals at launch) and then
 * updated by the watcher once the OSC 11 response arrives.
 */
import type { ThemeName, ThemeSetting } from './theme.js';
export type SystemTheme = 'dark' | 'light';
/**
 * Get the current terminal theme. Cached after first detection; the watcher
 * updates the cache on live changes.
 */
export declare function getSystemThemeName(): SystemTheme;
/**
 * Update the cached terminal theme. Called by the watcher when the OSC 11
 * query returns so non-React call sites stay in sync.
 */
export declare function setCachedSystemTheme(theme: SystemTheme): void;
/**
 * Resolve a ThemeSetting (which may be 'auto') to a concrete ThemeName.
 */
export declare function resolveThemeSetting(setting: ThemeSetting): ThemeName;
/**
 * Parse an OSC color response data string into a theme.
 *
 * Accepts XParseColor formats returned by OSC 10/11 queries:
 * - `rgb:R/G/B` where each component is 1–4 hex digits (each scaled to
 *   [0, 16^n - 1] for n digits). This is what xterm, iTerm2, Terminal.app,
 *   Ghostty, kitty, Alacritty, etc. return.
 * - `#RRGGBB` / `#RRRRGGGGBBBB` (rare, but cheap to accept).
 *
 * Returns undefined for unrecognized formats so callers can fall back.
 */
export declare function themeFromOscColor(data: string): SystemTheme | undefined;
//# sourceMappingURL=systemTheme.d.ts.map