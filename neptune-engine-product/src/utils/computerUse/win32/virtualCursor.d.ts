/**
 * Virtual Cursor — visible overlay cursor for the bound window.
 *
 * Shows a small colored cursor icon on top of the bound window,
 * independent of the real mouse cursor. The user's real mouse
 * stays free for their own use.
 *
 * The virtual cursor:
 * - Moves when Computer Use calls click/moveMouse
 * - Shows click animations (brief color flash)
 * - Is click-through (WS_EX_TRANSPARENT) — doesn't intercept real mouse
 * - Tracks the bound window position via the border tracker
 * - Disappears when the window is unbound
 */
/**
 * Start the virtual cursor overlay for a bound window.
 */
export declare function showVirtualCursor(hwnd: string): boolean;
/**
 * Move the virtual cursor to client-area coordinates.
 */
export declare function moveVirtualCursor(x: number, y: number, isClick?: boolean): void;
/**
 * Hide and destroy the virtual cursor.
 */
export declare function hideVirtualCursor(): void;
/**
 * Check if virtual cursor is active.
 */
export declare function isVirtualCursorActive(): boolean;
//# sourceMappingURL=virtualCursor.d.ts.map