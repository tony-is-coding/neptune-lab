export declare const CLAUDE_IN_CHROME_MCP_SERVER_NAME = "claude-in-chrome";
export type { ChromiumBrowser } from './setupPortable.js';
import type { ChromiumBrowser } from './setupPortable.js';
type BrowserConfig = {
    name: string;
    macos: {
        appName: string;
        dataPath: string[];
        nativeMessagingPath: string[];
    };
    linux: {
        binaries: string[];
        dataPath: string[];
        nativeMessagingPath: string[];
    };
    windows: {
        dataPath: string[];
        registryKey: string;
        useRoaming?: boolean;
    };
};
export declare const CHROMIUM_BROWSERS: Record<ChromiumBrowser, BrowserConfig>;
export declare const BROWSER_DETECTION_ORDER: ChromiumBrowser[];
/**
 * Get all browser data paths to check for extension installation
 */
export declare function getAllBrowserDataPaths(): {
    browser: ChromiumBrowser;
    path: string;
}[];
/**
 * Get native messaging host directories for all supported browsers
 */
export declare function getAllNativeMessagingHostsDirs(): {
    browser: ChromiumBrowser;
    path: string;
}[];
/**
 * Get Windows registry keys for all supported browsers
 */
export declare function getAllWindowsRegistryKeys(): {
    browser: ChromiumBrowser;
    key: string;
}[];
/**
 * Detect which browser to use for opening URLs
 * Returns the first available browser, or null if none found
 */
export declare function detectAvailableBrowser(): Promise<ChromiumBrowser | null>;
export declare function isClaudeInChromeMCPServer(name: string): boolean;
export declare function trackClaudeInChromeTabId(tabId: number): void;
export declare function isTrackedClaudeInChromeTabId(tabId: number): boolean;
export declare function openInChrome(url: string): Promise<boolean>;
/**
 * Get the socket directory path (Unix only)
 */
export declare function getSocketDir(): string;
/**
 * Get the socket path (Unix) or pipe name (Windows)
 */
export declare function getSecureSocketPath(): string;
/**
 * Get all socket paths including PID-based sockets in the directory
 * and legacy fallback paths
 */
export declare function getAllSocketPaths(): string[];
//# sourceMappingURL=common.d.ts.map