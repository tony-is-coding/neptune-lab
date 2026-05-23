export declare const MODEL_CONTEXT_WINDOW_DEFAULT = 200000;
export declare const COMPACT_MAX_OUTPUT_TOKENS = 20000;
export declare const CAPPED_DEFAULT_MAX_TOKENS = 8000;
export declare const ESCALATED_MAX_TOKENS = 64000;
/**
 * Check if 1M context is disabled via environment variable.
 * Used by C4E admins to disable 1M context for HIPAA compliance.
 */
export declare function is1mContextDisabled(): boolean;
export declare function has1mContext(model: string): boolean;
export declare function modelSupports1M(model: string): boolean;
export declare function getContextWindowForModel(model: string, betas?: string[]): number;
export declare function getSonnet1mExpTreatmentEnabled(model: string): boolean;
/**
 * Calculate context window usage percentage from token usage data.
 * Returns used and remaining percentages, or null values if no usage data.
 */
export declare function calculateContextPercentages(currentUsage: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
} | null, contextWindowSize: number): {
    used: number | null;
    remaining: number | null;
};
/**
 * Returns the model's default and upper limit for max output tokens.
 */
export declare function getModelMaxOutputTokens(model: string): {
    default: number;
    upperLimit: number;
};
/**
 * Returns the max thinking budget tokens for a given model. The max
 * thinking tokens should be strictly less than the max output tokens.
 *
 * Deprecated since newer models use adaptive thinking rather than a
 * strict thinking token budget.
 */
export declare function getMaxThinkingTokensForModel(model: string): number;
//# sourceMappingURL=context.d.ts.map