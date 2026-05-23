/**
 * Minimal module for firing MDM subprocess reads without blocking the event loop.
 * Has minimal imports — only child_process, fs, and mdmConstants (which only imports os).
 *
 * Two usage patterns:
 * 1. Startup: startMdmRawRead() fires at main.tsx module evaluation, results consumed later via getMdmRawReadPromise()
 * 2. Poll/fallback: fireRawRead() creates a fresh read on demand (used by changeDetector and SDK entrypoint)
 *
 * Raw stdout is consumed by mdmSettings.ts via consumeRawReadResult().
 */
export type RawReadResult = {
    plistStdouts: Array<{
        stdout: string;
        label: string;
    }> | null;
    hklmStdout: string | null;
    hkcuStdout: string | null;
};
/**
 * Fire fresh subprocess reads for MDM settings and return raw stdout.
 * On macOS: spawns plutil for each plist path in parallel, picks first winner.
 * On Windows: spawns reg query for HKLM and HKCU in parallel.
 * On Linux: returns empty (no MDM equivalent).
 */
export declare function fireRawRead(): Promise<RawReadResult>;
/**
 * Fire raw subprocess reads once for startup. Called at main.tsx module evaluation.
 * Results are consumed via getMdmRawReadPromise().
 */
export declare function startMdmRawRead(): void;
/**
 * Get the startup promise. Returns null if startMdmRawRead() wasn't called.
 */
export declare function getMdmRawReadPromise(): Promise<RawReadResult> | null;
//# sourceMappingURL=rawRead.d.ts.map