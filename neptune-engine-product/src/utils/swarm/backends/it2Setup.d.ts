/**
 * Package manager types for installing it2.
 * Listed in order of preference.
 */
export type PythonPackageManager = 'uvx' | 'pipx' | 'pip';
/**
 * Result of attempting to install it2.
 */
export type It2InstallResult = {
    success: boolean;
    error?: string;
    packageManager?: PythonPackageManager;
};
/**
 * Result of verifying it2 setup.
 */
export type It2VerifyResult = {
    success: boolean;
    error?: string;
    needsPythonApiEnabled?: boolean;
};
/**
 * Detects which Python package manager is available on the system.
 * Checks in order of preference: uvx, pipx, pip.
 *
 * @returns The detected package manager, or null if none found
 */
export declare function detectPythonPackageManager(): Promise<PythonPackageManager | null>;
/**
 * Checks if the it2 CLI tool is installed and accessible.
 *
 * @returns true if it2 is available
 */
export declare function isIt2CliAvailable(): Promise<boolean>;
/**
 * Installs the it2 CLI tool using the detected package manager.
 *
 * @param packageManager - The package manager to use for installation
 * @returns Result indicating success or failure
 */
export declare function installIt2(packageManager: PythonPackageManager): Promise<It2InstallResult>;
/**
 * Verifies that it2 is properly configured and can communicate with iTerm2.
 * This tests the Python API connection by running a simple it2 command.
 *
 * @returns Result indicating success or the specific failure reason
 */
export declare function verifyIt2Setup(): Promise<It2VerifyResult>;
/**
 * Returns instructions for enabling the Python API in iTerm2.
 */
export declare function getPythonApiInstructions(): string[];
/**
 * Marks that it2 setup has been completed successfully.
 * This prevents showing the setup prompt again.
 */
export declare function markIt2SetupComplete(): void;
/**
 * Marks that the user prefers to use tmux over iTerm2 split panes.
 * This prevents showing the setup prompt when in iTerm2.
 */
export declare function setPreferTmuxOverIterm2(prefer: boolean): void;
/**
 * Checks if the user prefers tmux over iTerm2 split panes.
 */
export declare function getPreferTmuxOverIterm2(): boolean;
//# sourceMappingURL=it2Setup.d.ts.map