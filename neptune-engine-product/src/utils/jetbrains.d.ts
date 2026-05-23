import type { IdeType } from './ide.js';
export declare function isJetBrainsPluginInstalled(ideType: IdeType): Promise<boolean>;
export declare function isJetBrainsPluginInstalledCached(ideType: IdeType, forceRefresh?: boolean): Promise<boolean>;
/**
 * Returns the cached result of isJetBrainsPluginInstalled synchronously.
 * Returns false if the result hasn't been resolved yet.
 * Use this only in sync contexts (e.g., status notice isActive checks).
 */
export declare function isJetBrainsPluginInstalledCachedSync(ideType: IdeType): boolean;
//# sourceMappingURL=jetbrains.d.ts.map