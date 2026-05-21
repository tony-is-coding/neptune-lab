import type { PermissionMode } from '../permissions/PermissionMode.js';
import { type ModelAlias } from './aliases.js';
export type ModelShortName = string;
export type ModelName = string;
export type ModelSetting = ModelName | ModelAlias | null;
export declare function getSmallFastModel(): ModelName;
export declare function isNonCustomOpusModel(model: ModelName): boolean;
/**
 * Helper to get the model from /model (including via /config), the --model flag, environment variable,
 * or the saved settings. The returned value can be a model alias if that's what the user specified.
 * Undefined if the user didn't configure anything, in which case we fall back to
 * the default (null).
 *
 * Priority order within this function:
 * 1. Model override during session (from /model command) - highest priority
 * 2. Model override at startup (from --model flag)
 * 3. ANTHROPIC_MODEL environment variable
 * 4. Settings (from user's saved settings)
 */
export declare function getUserSpecifiedModelSetting(): ModelSetting | undefined;
/**
 * Get the main loop model to use for the current session.
 *
 * Model Selection Priority Order:
 * 1. Model override during session (from /model command) - highest priority
 * 2. Model override at startup (from --model flag)
 * 3. ANTHROPIC_MODEL environment variable
 * 4. Settings (from user's saved settings)
 * 5. Built-in default
 *
 * @returns The resolved model name to use
 */
export declare function getMainLoopModel(): ModelName;
export declare function getBestModel(): ModelName;
export declare function getDefaultOpusModel(): ModelName;
export declare function getDefaultSonnetModel(): ModelName;
export declare function getDefaultHaikuModel(): ModelName;
/**
 * Get the model to use for runtime, depending on the runtime context.
 * @param params Subset of the runtime context to determine the model to use.
 * @returns The model to use
 */
export declare function getRuntimeMainLoopModel(params: {
    permissionMode: PermissionMode;
    mainLoopModel: string;
    exceeds200kTokens?: boolean;
}): ModelName;
/**
 * Get the default main loop model setting.
 *
 * This handles the built-in default:
 * - Opus for Max and Team Premium users
 * - Sonnet 4.6 for all other users (including Team Standard, Pro, Enterprise)
 *
 * @returns The default model setting to use
 */
export declare function getDefaultMainLoopModelSetting(): ModelName | ModelAlias;
/**
 * Synchronous operation to get the default main loop model to use
 * (bypassing any user-specified values).
 */
export declare function getDefaultMainLoopModel(): ModelName;
/**
 * Pure string-match that strips date/provider suffixes from a first-party model
 * name. Input must already be a 1P-format ID (e.g. 'claude-3-7-sonnet-20250219',
 * 'us.anthropic.claude-opus-4-6-v1:0'). Does not touch settings, so safe at
 * module top-level (see MODEL_COSTS in modelCost.ts).
 */
export declare function firstPartyNameToCanonical(name: ModelName): ModelShortName;
/**
 * Maps a full model string to a shorter canonical version that's unified across 1P and 3P providers.
 * For example, 'claude-3-5-haiku-20241022' and 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
 * would both be mapped to 'claude-3-5-haiku'.
 * @param fullModelName The full model name (e.g., 'claude-3-5-haiku-20241022')
 * @returns The short name (e.g., 'claude-3-5-haiku') if found, or the original name if no mapping exists
 */
export declare function getCanonicalName(fullModelName: ModelName): ModelShortName;
export declare function getClaudeAiUserDefaultModelDescription(fastMode?: boolean): string;
export declare function renderDefaultModelSetting(setting: ModelName | ModelAlias): string;
export declare function getOpus46PricingSuffix(fastMode: boolean): string;
export declare function isOpus1mMergeEnabled(): boolean;
export declare function renderModelSetting(setting: ModelName | ModelAlias): string;
/**
 * Returns a human-readable display name for known public models, or null
 * if the model is not recognized as a public model.
 */
export declare function getPublicModelDisplayName(model: ModelName): string | null;
export declare function renderModelName(model: ModelName): string;
/**
 * Returns a safe author name for public display (e.g., in git commit trailers).
 * Returns "Claude {ModelName}" for publicly known models, or "Claude ({model})"
 * for unknown/internal models so the exact model name is preserved.
 *
 * @param model The full model name
 * @returns "Claude {ModelName}" for public models, or "Claude ({model})" for non-public models
 */
export declare function getPublicModelName(model: ModelName): string;
/**
 * Returns a full model name for use in this session, possibly after resolving
 * a model alias.
 *
 * This function intentionally does not support version numbers to align with
 * the model switcher.
 *
 * Supports [1m] suffix on any model alias (e.g., haiku[1m], sonnet[1m]) to enable
 * 1M context window without requiring each variant to be in MODEL_ALIASES.
 *
 * @param modelInput The model alias or name provided by the user.
 */
export declare function parseUserSpecifiedModel(modelInput: ModelName | ModelAlias): ModelName;
/**
 * Resolves a skill's `model:` frontmatter against the current model, carrying
 * the `[1m]` suffix over when the target family supports it.
 *
 * A skill author writing `model: opus` means "use opus-class reasoning" — not
 * "downgrade to 200K". If the user is on opus[1m] at 230K tokens and invokes a
 * skill with `model: opus`, passing the bare alias through drops the effective
 * context window from 1M to 200K, which trips autocompact at 23% apparent usage
 * and surfaces "Context limit reached" even though nothing overflowed.
 *
 * We only carry [1m] when the target actually supports it (sonnet/opus). A skill
 * with `model: haiku` on a 1M session still downgrades — haiku has no 1M variant,
 * so the autocompact that follows is correct. Skills that already specify [1m]
 * are left untouched.
 */
export declare function resolveSkillModelOverride(skillModel: string, currentModel: string): string;
/**
 * Opt-out for the legacy Opus 4.0/4.1 → current Opus remap.
 */
export declare function isLegacyModelRemapEnabled(): boolean;
export declare function modelDisplayString(model: ModelSetting): string;
export declare function getMarketingNameForModel(modelId: string): string | undefined;
export declare function normalizeModelStringForAPI(model: string): string;
//# sourceMappingURL=model.d.ts.map