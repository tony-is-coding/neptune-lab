/**
 * Reads plugin-related settings (enabledPlugins, extraKnownMarketplaces)
 * from --add-dir directories.
 *
 * These have the LOWEST priority — callers must spread standard settings
 * on top so that user/project/local/flag/policy sources all override.
 */
import type { z } from 'zod/v4';
import type { ExtraKnownMarketplaceSchema, SettingsJson } from '../settings/types.js';
type ExtraKnownMarketplace = z.infer<ReturnType<typeof ExtraKnownMarketplaceSchema>>;
/**
 * Returns a merged record of enabledPlugins from all --add-dir directories.
 *
 * Within each directory, settings.local.json is processed after settings.json
 * (local wins within that dir). Across directories, later CLI-order wins on
 * conflict.
 *
 * This has the lowest priority — callers must spread their standard settings
 * on top to let user/project/local/flag/policy override.
 */
export declare function getAddDirEnabledPlugins(): NonNullable<SettingsJson['enabledPlugins']>;
/**
 * Returns a merged record of extraKnownMarketplaces from all --add-dir directories.
 *
 * Same priority rules as getAddDirEnabledPlugins: settings.local.json wins
 * within each dir, and callers spread standard settings on top.
 */
export declare function getAddDirExtraMarketplaces(): Record<string, ExtraKnownMarketplace>;
export {};
//# sourceMappingURL=addDirPluginSettings.d.ts.map