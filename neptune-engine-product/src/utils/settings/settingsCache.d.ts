import type { SettingSource } from './constants.js';
import type { SettingsJson } from './types.js';
import type { SettingsWithErrors, ValidationError } from './validation.js';
export declare function getSessionSettingsCache(): SettingsWithErrors | null;
export declare function setSessionSettingsCache(value: SettingsWithErrors): void;
export declare function getCachedSettingsForSource(source: SettingSource): SettingsJson | null | undefined;
export declare function setCachedSettingsForSource(source: SettingSource, value: SettingsJson | null): void;
/**
 * Path-keyed cache for parseSettingsFile. Both getSettingsForSource and
 * loadSettingsFromDisk call parseSettingsFile on the same paths during
 * startup — this dedupes the disk read + zod parse.
 */
type ParsedSettings = {
    settings: SettingsJson | null;
    errors: ValidationError[];
};
export declare function getCachedParsedFile(path: string): ParsedSettings | undefined;
export declare function setCachedParsedFile(path: string, value: ParsedSettings): void;
export declare function resetSettingsCache(): void;
export declare function getPluginSettingsBase(): Record<string, unknown> | undefined;
export declare function setPluginSettingsBase(settings: Record<string, unknown> | undefined): void;
export declare function clearPluginSettingsBase(): void;
export {};
//# sourceMappingURL=settingsCache.d.ts.map