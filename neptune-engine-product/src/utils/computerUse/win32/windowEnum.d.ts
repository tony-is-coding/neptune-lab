/**
 * Window enumeration using Win32 EnumWindows API.
 * Returns visible windows with their HWND, PID, and title.
 */
export interface WindowInfo {
    hwnd: string;
    pid: number;
    title: string;
}
/**
 * List all visible windows with non-empty titles.
 * Returns HWND, PID, and window title for each.
 */
export declare function listWindows(): WindowInfo[];
//# sourceMappingURL=windowEnum.d.ts.map