/**
 * Windows platform backend for Computer Use.
 *
 * Combines:
 * - PowerShell SetCursorPos/SendInput for global input (fallback)
 * - win32/windowMessage.ts for window-bound SendMessage input (preferred)
 * - Python Bridge (bridge.py) for screenshots (mss + ctypes PrintWindow)
 * - win32/windowEnum.ts for EnumWindows app listing
 * - No PowerShell for screenshots (Python Bridge only, no PS fallback)
 * - PowerShell Screen.AllScreens for display enumeration
 *
 * CRITICAL: All screenshots output JPEG (ImageFormat::Jpeg), not PNG.
 */
import type { Platform } from './index.js';
/** Get the bound HWND, or null if not bound */
export declare function getBoundHwnd(): string | null;
/** Get the bound app type */
export declare function getBoundAppType(): string | null;
/** Bind to a window HWND — all subsequent input/screenshot operations target this handle */
export declare function bindWindow(hwnd: string, pid?: number): void;
/** Bind to a COM-controlled file (Excel/Word — no window needed) */
export declare function bindFile(filePath: string, appType: import('../win32/appDispatcher.js').AppType): void;
/** Unbind — revert to global mode, remove overlays */
export declare function unbindWindow(): void;
export declare const platform: Platform;
//# sourceMappingURL=win32.d.ts.map