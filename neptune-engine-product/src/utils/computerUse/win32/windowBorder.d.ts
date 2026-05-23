/**
 * Visual indicator for bound windows — DWM native border color.
 *
 * Uses DwmSetWindowAttribute(DWMWA_BORDER_COLOR) to set a green border
 * on the bound window. The border:
 * - Is the window's OWN border, not an overlay — zero offset, zero shadow issues
 * - Follows window movement/resize/rounded corners automatically (OS-level)
 * - Persists across repaints, zero performance overhead
 * - Works on Win11 22000+ (Build 22000 = Windows 11 GA)
 *
 * No overlays, no polling, no separate processes, no z-order issues.
 */
/**
 * Set green border on bound window via DWM.
 */
export declare function markBound(hwnd: string): boolean;
/**
 * Remove border, restore default.
 */
export declare function unmarkBound(hwnd: string): boolean;
/**
 * Kill all borders — just reset all bound windows.
 * With DWM approach, no processes to kill.
 */
export declare function cleanupAllBorders(): void;
//# sourceMappingURL=windowBorder.d.ts.map