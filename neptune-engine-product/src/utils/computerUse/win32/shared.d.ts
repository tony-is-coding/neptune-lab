/**
 * Shared utilities for win32 Computer Use modules.
 * Single source of truth — no more duplication across files.
 */
/** Validate HWND is a pure numeric string — prevents PowerShell/Python injection. */
export declare function validateHwnd(hwnd: string): string;
/** Run a PowerShell script synchronously, return stdout trimmed. */
export declare function ps(script: string): string;
/** Run a PowerShell script synchronously, return null on failure. */
export declare function runPs(script: string): string | null;
/** Run a PowerShell script asynchronously. */
export declare function psAsync(script: string): Promise<string>;
/** Get the system temp directory. */
export declare function getTmpDir(): string;
/** Virtual key code mapping — canonical, complete. */
export declare const VK_MAP: Record<string, number>;
export declare const MODIFIER_KEYS: Set<string>;
//# sourceMappingURL=shared.d.ts.map