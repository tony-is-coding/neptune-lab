/**
 * Application type dispatcher for Windows Computer Use.
 *
 * Routes operations to the appropriate controller based on file type:
 * - .xlsx/.xls/.csv → Excel COM (headless, no window)
 * - .docx/.doc      → Word COM (headless, no window)
 * - .txt/.log/.md   → notepad + SendMessage + HWND bind (offscreen)
 * - Others          → generic exe + HWND bind (offscreen)
 */
export type AppType = 'excel' | 'word' | 'text' | 'browser' | 'generic';
/**
 * Detect application type from file path or app name.
 */
export declare function detectAppType(nameOrPath: string): AppType;
export interface OpenResult {
    type: AppType;
    /** HWND for text/browser/generic apps (SendMessage target) */
    hwnd?: string;
    /** File path for COM-controlled apps (Excel/Word) */
    filePath?: string;
}
/**
 * Open a file or app with the appropriate controller.
 *
 * - Excel/Word: COM automation (no window, no HWND needed)
 * - Text/Browser/Generic: exe launch + offscreen HWND bind
 *
 * Returns the app type and either HWND or file path for subsequent operations.
 */
export declare function openWithController(nameOrPath: string): Promise<OpenResult>;
//# sourceMappingURL=appDispatcher.d.ts.map