import type { BetaUsage as Usage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import { type ModelShortName } from './model/model.js';
export type ModelCosts = {
    inputTokens: number;
    outputTokens: number;
    promptCacheWriteTokens: number;
    promptCacheReadTokens: number;
    webSearchRequests: number;
};
export declare const COST_TIER_3_15: {
    readonly inputTokens: 3;
    readonly outputTokens: 15;
    readonly promptCacheWriteTokens: 3.75;
    readonly promptCacheReadTokens: 0.3;
    readonly webSearchRequests: 0.01;
};
export declare const COST_TIER_15_75: {
    readonly inputTokens: 15;
    readonly outputTokens: 75;
    readonly promptCacheWriteTokens: 18.75;
    readonly promptCacheReadTokens: 1.5;
    readonly webSearchRequests: 0.01;
};
export declare const COST_TIER_5_25: {
    readonly inputTokens: 5;
    readonly outputTokens: 25;
    readonly promptCacheWriteTokens: 6.25;
    readonly promptCacheReadTokens: 0.5;
    readonly webSearchRequests: 0.01;
};
export declare const COST_TIER_30_150: {
    readonly inputTokens: 30;
    readonly outputTokens: 150;
    readonly promptCacheWriteTokens: 37.5;
    readonly promptCacheReadTokens: 3;
    readonly webSearchRequests: 0.01;
};
export declare const COST_HAIKU_35: {
    readonly inputTokens: 0.8;
    readonly outputTokens: 4;
    readonly promptCacheWriteTokens: 1;
    readonly promptCacheReadTokens: 0.08;
    readonly webSearchRequests: 0.01;
};
export declare const COST_HAIKU_45: {
    readonly inputTokens: 1;
    readonly outputTokens: 5;
    readonly promptCacheWriteTokens: 1.25;
    readonly promptCacheReadTokens: 0.1;
    readonly webSearchRequests: 0.01;
};
/**
 * Get the cost tier for Opus 4.6 based on fast mode.
 */
export declare function getOpus46CostTier(fastMode: boolean): ModelCosts;
export declare const MODEL_COSTS: Record<ModelShortName, ModelCosts>;
export declare function getModelCosts(model: string, usage: Usage): ModelCosts;
export declare function calculateUSDCost(resolvedModel: string, usage: Usage): number;
/**
 * Calculate cost from raw token counts without requiring a full BetaUsage object.
 * Useful for side queries (e.g. classifier) that track token counts independently.
 */
export declare function calculateCostFromTokens(model: string, tokens: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
}): number;
/**
 * Format model costs as a pricing string for display
 * e.g., "$3/$15 per Mtok"
 */
export declare function formatModelPricing(costs: ModelCosts): string;
/**
 * Get formatted pricing string for a model
 * Accepts either a short name or full model name
 * Returns undefined if model is not found
 */
export declare function getModelPricingString(model: string): string | undefined;
//# sourceMappingURL=modelCost.d.ts.map