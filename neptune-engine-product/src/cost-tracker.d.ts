import type { BetaUsage as Usage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import { addToTotalLinesChanged, getModelUsage, getTotalAPIDuration, getTotalAPIDurationWithoutRetries, getTotalCacheCreationInputTokens, getTotalCacheReadInputTokens, getTotalCostUSD, getTotalDuration, getTotalInputTokens, getTotalLinesAdded, getTotalLinesRemoved, getTotalOutputTokens, getTotalWebSearchRequests, getUsageForModel, hasUnknownModelCost, resetCostState, resetStateForTests, setHasUnknownModelCost } from './bootstrap/state.js';
import type { ModelUsage } from './entrypoints/agentSdkTypes.js';
import type { FpsMetrics } from './utils/fpsTracker.js';
export { getTotalCostUSD as getTotalCost, getTotalDuration, getTotalAPIDuration, getTotalAPIDurationWithoutRetries, addToTotalLinesChanged, getTotalLinesAdded, getTotalLinesRemoved, getTotalInputTokens, getTotalOutputTokens, getTotalCacheReadInputTokens, getTotalCacheCreationInputTokens, getTotalWebSearchRequests, formatCost, hasUnknownModelCost, resetStateForTests, resetCostState, setHasUnknownModelCost, getModelUsage, getUsageForModel, };
type StoredCostState = {
    totalCostUSD: number;
    totalAPIDuration: number;
    totalAPIDurationWithoutRetries: number;
    totalToolDuration: number;
    totalLinesAdded: number;
    totalLinesRemoved: number;
    lastDuration: number | undefined;
    modelUsage: {
        [modelName: string]: ModelUsage;
    } | undefined;
};
/**
 * Gets stored cost state from project config for a specific session.
 * Returns the cost data if the session ID matches, or undefined otherwise.
 * Use this to read costs BEFORE overwriting the config with saveCurrentSessionCosts().
 */
export declare function getStoredSessionCosts(sessionId: string): StoredCostState | undefined;
/**
 * Restores cost state from project config when resuming a session.
 * Only restores if the session ID matches the last saved session.
 * @returns true if cost state was restored, false otherwise
 */
export declare function restoreCostStateForSession(sessionId: string): boolean;
/**
 * Saves the current session's costs to project config.
 * Call this before switching sessions to avoid losing accumulated costs.
 */
export declare function saveCurrentSessionCosts(fpsMetrics?: FpsMetrics): void;
declare function formatCost(cost: number, maxDecimalPlaces?: number): string;
export declare function formatTotalCost(): string;
export declare function addToTotalSessionCost(cost: number, usage: Usage, model: string): number;
//# sourceMappingURL=cost-tracker.d.ts.map