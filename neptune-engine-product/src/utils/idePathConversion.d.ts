/**
 * Path conversion utilities for IDE communication
 * Handles conversions between Claude's environment and the IDE's environment
 */
export interface IDEPathConverter {
    /**
     * Convert path from IDE format to Claude's local format
     * Used when reading workspace folders from IDE lockfile
     */
    toLocalPath(idePath: string): string;
    /**
     * Convert path from Claude's local format to IDE format
     * Used when sending paths to IDE (showDiffInIDE, etc.)
     */
    toIDEPath(localPath: string): string;
}
/**
 * Converter for Windows IDE + WSL Claude scenario
 */
export declare class WindowsToWSLConverter implements IDEPathConverter {
    private wslDistroName;
    constructor(wslDistroName: string | undefined);
    toLocalPath(windowsPath: string): string;
    toIDEPath(wslPath: string): string;
}
/**
 * Check if distro names match for WSL UNC paths
 */
export declare function checkWSLDistroMatch(windowsPath: string, wslDistroName: string): boolean;
//# sourceMappingURL=idePathConversion.d.ts.map