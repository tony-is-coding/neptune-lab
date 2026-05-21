import { type Platform } from './platform.js';
export type SystemDirectories = {
    HOME: string;
    DESKTOP: string;
    DOCUMENTS: string;
    DOWNLOADS: string;
    [key: string]: string;
};
type EnvLike = Record<string, string | undefined>;
type SystemDirectoriesOptions = {
    env?: EnvLike;
    homedir?: string;
    platform?: Platform;
};
/**
 * Get cross-platform system directories
 * Handles differences between Windows, macOS, Linux, and WSL
 * @param options Optional overrides for testing (env, homedir, platform)
 */
export declare function getSystemDirectories(options?: SystemDirectoriesOptions): SystemDirectories;
export {};
//# sourceMappingURL=systemDirectories.d.ts.map