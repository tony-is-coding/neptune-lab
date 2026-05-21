export declare const CHROME_EXTENSION_URL = "https://claude.ai/chrome";
export type ChromiumBrowser = 'chrome' | 'brave' | 'arc' | 'chromium' | 'edge' | 'vivaldi' | 'opera';
export type BrowserPath = {
    browser: ChromiumBrowser;
    path: string;
};
type Logger = (message: string) => void;
/**
 * Get all browser data paths to check for extension installation.
 * Portable version that uses process.platform directly.
 */
export declare function getAllBrowserDataPathsPortable(): BrowserPath[];
/**
 * Detects if the Claude in Chrome extension is installed by checking the Extensions
 * directory across all supported Chromium-based browsers and their profiles.
 *
 * This is a portable version that can be used by both TUI and VS Code extension.
 *
 * @param browserPaths - Array of browser data paths to check (from getAllBrowserDataPaths)
 * @param log - Optional logging callback for debug messages
 * @returns Object with isInstalled boolean and the browser where the extension was found
 */
export declare function detectExtensionInstallationPortable(browserPaths: BrowserPath[], log?: Logger): Promise<{
    isInstalled: boolean;
    browser: ChromiumBrowser | null;
}>;
/**
 * Simple wrapper that returns just the boolean result
 */
export declare function isChromeExtensionInstalledPortable(browserPaths: BrowserPath[], log?: Logger): Promise<boolean>;
/**
 * Convenience function that gets browser paths automatically.
 * Use this when you don't need to provide custom browser paths.
 */
export declare function isChromeExtensionInstalled(log?: Logger): Promise<boolean>;
export {};
//# sourceMappingURL=setupPortable.d.ts.map