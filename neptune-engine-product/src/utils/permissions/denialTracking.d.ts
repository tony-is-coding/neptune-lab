/**
 * Denial tracking infrastructure for permission classifiers.
 * Tracks consecutive denials and total denials to determine
 * when to fall back to prompting.
 */
export type DenialTrackingState = {
    consecutiveDenials: number;
    totalDenials: number;
};
export declare const DENIAL_LIMITS: {
    readonly maxConsecutive: 3;
    readonly maxTotal: 20;
};
export declare function createDenialTrackingState(): DenialTrackingState;
export declare function recordDenial(state: DenialTrackingState): DenialTrackingState;
export declare function recordSuccess(state: DenialTrackingState): DenialTrackingState;
export declare function shouldFallbackToPrompting(state: DenialTrackingState): boolean;
//# sourceMappingURL=denialTracking.d.ts.map