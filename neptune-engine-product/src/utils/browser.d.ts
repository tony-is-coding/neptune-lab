/**
 * Open a file or folder path using the system's default handler.
 * Uses `open` on macOS, `explorer` on Windows, `xdg-open` on Linux.
 */
export declare function openPath(path: string): Promise<boolean>;
export declare function openBrowser(url: string): Promise<boolean>;
//# sourceMappingURL=browser.d.ts.map