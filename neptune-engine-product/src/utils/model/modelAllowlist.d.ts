/**
 * Check if a model is allowed by the availableModels allowlist in settings.
 * If availableModels is not set, all models are allowed.
 *
 * Matching tiers:
 * 1. Family aliases ("opus", "sonnet", "haiku") — wildcard for the entire family,
 *    UNLESS more specific entries for that family also exist (e.g., "opus-4-5").
 *    In that case, the family wildcard is ignored and only the specific entries apply.
 * 2. Version prefixes ("opus-4-5", "claude-opus-4-5") — any build of that version
 * 3. Full model IDs ("claude-opus-4-5-20251101") — exact match only
 */
export declare function isModelAllowed(model: string): boolean;
//# sourceMappingURL=modelAllowlist.d.ts.map