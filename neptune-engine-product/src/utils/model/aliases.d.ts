export declare const MODEL_ALIASES: readonly ["sonnet", "opus", "haiku", "best", "sonnet[1m]", "opus[1m]", "opusplan"];
export type ModelAlias = (typeof MODEL_ALIASES)[number];
export declare function isModelAlias(modelInput: string): modelInput is ModelAlias;
/**
 * Bare model family aliases that act as wildcards in the availableModels allowlist.
 * When "opus" is in the allowlist, ANY opus model is allowed (opus 4.5, 4.6, etc.).
 * When a specific model ID is in the allowlist, only that exact version is allowed.
 */
export declare const MODEL_FAMILY_ALIASES: readonly ["sonnet", "opus", "haiku"];
export declare function isModelFamilyAlias(model: string): boolean;
//# sourceMappingURL=aliases.d.ts.map