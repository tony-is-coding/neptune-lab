import { APIError } from '@anthropic-ai/sdk';
export { getRateLimitErrorMessage, getRateLimitWarning, getUsingOverageText, } from './rateLimitMessages.js';
type QuotaStatus = 'allowed' | 'allowed_warning' | 'rejected';
type RateLimitType = 'five_hour' | 'seven_day' | 'seven_day_opus' | 'seven_day_sonnet' | 'overage';
export type { RateLimitType };
export declare function getRateLimitDisplayName(type: RateLimitType): string;
export type OverageDisabledReason = 'overage_not_provisioned' | 'org_level_disabled' | 'org_level_disabled_until' | 'out_of_credits' | 'seat_tier_level_disabled' | 'member_level_disabled' | 'seat_tier_zero_credit_limit' | 'group_zero_credit_limit' | 'member_zero_credit_limit' | 'org_service_level_disabled' | 'org_service_zero_credit_limit' | 'no_limits_configured' | 'unknown';
export type ClaudeAILimits = {
    status: QuotaStatus;
    unifiedRateLimitFallbackAvailable: boolean;
    resetsAt?: number;
    rateLimitType?: RateLimitType;
    utilization?: number;
    overageStatus?: QuotaStatus;
    overageResetsAt?: number;
    overageDisabledReason?: OverageDisabledReason;
    isUsingOverage?: boolean;
    surpassedThreshold?: number;
};
export declare let currentLimits: ClaudeAILimits;
/**
 * Raw per-window utilization from response headers, tracked on every API
 * response (unlike currentLimits.utilization which is only set when a warning
 * threshold fires). Exposed to statusline scripts via getRawUtilization().
 */
type RawWindowUtilization = {
    utilization: number;
    resets_at: number;
};
type RawUtilization = {
    five_hour?: RawWindowUtilization;
    seven_day?: RawWindowUtilization;
};
export declare function getRawUtilization(): RawUtilization;
type StatusChangeListener = (limits: ClaudeAILimits) => void;
export declare const statusListeners: Set<StatusChangeListener>;
export declare function emitStatusChange(limits: ClaudeAILimits): void;
export declare function checkQuotaStatus(): Promise<void>;
export declare function extractQuotaStatusFromHeaders(headers: globalThis.Headers): void;
export declare function extractQuotaStatusFromError(error: APIError): void;
//# sourceMappingURL=claudeAiLimits.d.ts.map