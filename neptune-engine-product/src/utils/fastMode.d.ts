import { type ModelSetting } from './model/model.js';
export declare function isFastModeEnabled(): boolean;
export declare function isFastModeAvailable(): boolean;
export declare function getFastModeUnavailableReason(): string | null;
export declare const FAST_MODE_MODEL_DISPLAY = "Opus 4.6";
export declare function getFastModeModel(): string;
export declare function getInitialFastModeSetting(model: ModelSetting): boolean;
export declare function isFastModeSupportedByModel(modelSetting: ModelSetting): boolean;
export type FastModeRuntimeState = {
    status: 'active';
} | {
    status: 'cooldown';
    resetAt: number;
    reason: CooldownReason;
};
export type CooldownReason = 'rate_limit' | 'overloaded';
export declare const onCooldownTriggered: (listener: (resetAt: number, reason: CooldownReason) => void) => () => void;
export declare const onCooldownExpired: (listener: () => void) => () => void;
export declare function getFastModeRuntimeState(): FastModeRuntimeState;
export declare function triggerFastModeCooldown(resetTimestamp: number, reason: CooldownReason): void;
export declare function clearFastModeCooldown(): void;
/**
 * Called when the API rejects a fast mode request (e.g., 400 "Fast mode is
 * not enabled for your organization"). Permanently disables fast mode using
 * the same flow as when the prefetch discovers the org has it disabled.
 */
export declare function handleFastModeRejectedByAPI(): void;
export declare const onFastModeOverageRejection: (listener: (message: string) => void) => () => void;
/**
 * Called when a 429 indicates fast mode was rejected because extra usage
 * is not available. Permanently disables fast mode (unless the user has
 * ran out of credits) and notifies with a reason-specific message.
 */
export declare function handleFastModeOverageRejection(reason: string | null): void;
export declare function isFastModeCooldown(): boolean;
export declare function getFastModeState(model: ModelSetting, fastModeUserEnabled: boolean | undefined): 'off' | 'cooldown' | 'on';
export type FastModeDisabledReason = 'free' | 'preference' | 'extra_usage_disabled' | 'network_error' | 'unknown';
export declare const onOrgFastModeChanged: (listener: (orgEnabled: boolean) => void) => () => void;
/**
 * Resolve orgStatus from the persisted cache without making any API calls.
 * Used when startup prefetches are throttled to avoid hitting the network
 * while still making fast mode availability checks work.
 */
export declare function resolveFastModeStatusFromCache(): void;
export declare function prefetchFastModeStatus(): Promise<void>;
//# sourceMappingURL=fastMode.d.ts.map