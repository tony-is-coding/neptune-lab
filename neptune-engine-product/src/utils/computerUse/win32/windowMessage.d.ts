/**
 * SendMessage-based input for Win32 windows.
 *
 * ALL text/keyboard operations target a specific HWND via SendMessageW.
 * No SendInput / keybd_event / SendKeys — those are global and conflict with the user.
 *
 * Text input strategy:
 * 1. Short text (≤ CLIPBOARD_THRESHOLD chars): SendMessageW(WM_CHAR) per codepoint
 * 2. Long text (> threshold): Clipboard.SetText() + SendMessageW(Ctrl+V) paste
 * Both paths support full Unicode (Chinese, emoji, etc.) without IME involvement.
 */
/** Clear cached edit-child mappings. Call on unbind. */
export declare function clearEditChildCache(hwnd?: string): void;
/**
 * Resolve the HWND that should actually receive input messages.
 * For WinUI 3 apps, returns the InputSite child window.
 * For traditional Win32 apps, returns the edit control or the original HWND.
 */
export declare function resolveInputHwnd(hwnd: string): string;
/**
 * Find the first edit-capable child window of a parent HWND.
 *
 * Strategy:
 * 1. EnumChildWindows — search for known edit control class names
 * 2. UI Automation fallback — find the first Edit/Document element and get its native HWND
 *
 * EnumChildWindows is recursive and enumerates all descendant windows,
 * but for UWP apps the edit control may be in a different process (hosted
 * inside ApplicationFrameHost). UI Automation crosses process boundaries.
 */
export declare function findEditChild(parentHwnd: string): string | null;
/**
 * Send a single Unicode character to a window via SendMessageW(WM_CHAR).
 * Handles surrogate pairs for characters outside BMP (emoji, rare CJK, etc.).
 */
export declare function sendChar(hwnd: string, char: string): boolean;
/**
 * Send text to a window via WM_CHAR per Unicode codepoint.
 * Always uses the WM_CHAR path — reliable across all window types including
 * Windows Terminal / ConPTY where clipboard-based Ctrl+V doesn't work.
 * Window-targeted, no global input APIs.
 */
export declare function sendText(hwnd: string, text: string): boolean;
/**
 * Send a key down or key up event via PostMessageW(WM_KEYDOWN / WM_KEYUP).
 * Uses PostMessage (async) instead of SendMessage — required for Windows Terminal
 * and ConPTY-based console windows to correctly process key events.
 * lParam includes the correct scan code via MapVirtualKeyW.
 */
export declare function sendKey(hwnd: string, vk: number, action: 'down' | 'up'): boolean;
/**
 * Send a key combination (e.g. ['ctrl', 'a']).
 * Holds modifiers via WM_KEYDOWN, presses the key, then releases in reverse.
 * All via SendMessageW — no global APIs.
 */
export declare function sendKeys(hwnd: string, combo: string[]): boolean;
/**
 * Send a key to a console window via WriteConsoleInput (Console Input Buffer).
 * This is required for terminal apps like Claude Code REPL that read stdin in raw mode.
 */
export declare function consoleKey(hwnd: string, vk: number, ch?: string): boolean;
/**
 * Send text + Enter to a console window via WriteConsoleInput.
 * Directly injects into the Console Input Buffer — works for raw-mode stdin.
 */
export declare function consoleText(hwnd: string, text: string): boolean;
/**
 * Send a mouse click at client-area coordinates (x, y) relative to the window.
 * Via SendMessageW — window-targeted, no cursor movement.
 */
export declare function sendClick(hwnd: string, x: number, y: number, button: 'left' | 'right'): boolean;
/**
 * Send a mouse-button-down at client-area coordinates (x, y).
 * Via SendMessageW(WM_LBUTTONDOWN) — window-targeted, no cursor movement.
 */
export declare function sendMouseDown(hwnd: string, x: number, y: number): boolean;
/**
 * Send a mouse-button-up at client-area coordinates (x, y).
 * Via SendMessageW(WM_LBUTTONUP) — window-targeted, no cursor movement.
 */
export declare function sendMouseUp(hwnd: string, x: number, y: number): boolean;
/**
 * Send a WM_MOUSEMOVE at client-area coordinates (x, y).
 * Used during drag operations. Via SendMessageW — window-targeted.
 */
export declare function sendMouseMove(hwnd: string, x: number, y: number): boolean;
/**
 * Send mouse wheel scroll at client-area coordinates (x, y).
 * Via SendMessageW(WM_MOUSEWHEEL / WM_MOUSEHWHEEL).
 *
 * WM_MOUSEWHEEL:  vertical scroll (positive delta = scroll up)
 * WM_MOUSEHWHEEL: horizontal scroll (positive delta = scroll right)
 *
 * delta is in multiples of WHEEL_DELTA (120). One "click" = 120.
 * lParam = screen coordinates (not client), wParam high word = delta.
 *
 * Works on Excel, browsers, modern UI — unlike WM_VSCROLL/WM_HSCROLL
 * which only work on traditional scrollbar controls.
 */
export declare function sendMouseWheel(hwnd: string, x: number, y: number, delta: number, horizontal?: boolean): boolean;
//# sourceMappingURL=windowMessage.d.ts.map