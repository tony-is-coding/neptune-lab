/**
 * Detects if the current runtime is Bun.
 * Returns true when:
 * - Running a JS file via the `bun` command
 * - Running a Bun-compiled standalone executable
 */
export declare function isRunningWithBun(): boolean;
/**
 * Detects if running as a Bun-compiled standalone executable.
 * This checks for embedded files which are present in compiled binaries.
 */
export declare function isInBundledMode(): boolean;
//# sourceMappingURL=bundledMode.d.ts.map