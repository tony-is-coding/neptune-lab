/**
 * Centralized rate limit message generation
 * Single source of truth for all rate limit-related messages
 */
import type { ClaudeAILimits } from './claudeAiLimits.js';
/**
 * All possible rate limit error message prefixes
 * Export this to avoid fragile string matching in UI components
 */
export declare const RATE_LIMIT_ERROR_PREFIXES: readonly ["You've hit your", "You've used", "You're now using extra usage", "You're close to", "You're out of extra usage"];
/**
 * Check if a message is a rate limit error
 */
export declare function isRateLimitErrorMessage(text: string): boolean;
export type RateLimitMessage = {
    message: string;
    severity: 'error' | 'warning';
};
/**
 * Get the appropriate rate limit message based on limit state
 * Returns null if no message should be shown
 */
export declare function getRateLimitMessage(limits: ClaudeAILimits, model: string): RateLimitMessage | null;
/**
 * Get error message for API errors (used in errors.ts)
 * Returns the message string or null if no error message should be shown
 */
export declare function getRateLimitErrorMessage(limits: ClaudeAILimits, model: string): string | null;
/**
 * Get warning message for UI footer
 * Returns the warning message string or null if no warning should be shown
 */
export declare function getRateLimitWarning(limits: ClaudeAILimits, model: string): string | null;
/**
 * Get notification text for overage mode transitions
 * Used for transient notifications when entering overage mode
 */
export declare function getUsingOverageText(limits: ClaudeAILimits): string;
//# sourceMappingURL=rateLimitMessages.d.ts.map