/**
 * Platform dispatcher for Computer Use.
 *
 * Loads the correct platform backend based on `process.platform`.
 * Each backend implements the same unified interface.
 */
import type { InputPlatform, ScreenshotPlatform, DisplayPlatform, AppsPlatform, WindowManagementPlatform } from './types.js';
export interface Platform {
    input: InputPlatform;
    screenshot: ScreenshotPlatform;
    display: DisplayPlatform;
    apps: AppsPlatform;
    windowManagement?: WindowManagementPlatform;
}
export declare function loadPlatform(): Platform;
export type { InputPlatform, ScreenshotPlatform, DisplayPlatform, AppsPlatform, WindowManagementPlatform } from './types.js';
export type { WindowHandle, ScreenshotResult, DisplayInfo, InstalledApp, FrontmostAppInfo, WindowAction } from './types.js';
//# sourceMappingURL=index.d.ts.map