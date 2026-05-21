/**
 * Privacy level controls how much nonessential network traffic and telemetry
 * Claude Code generates.
 *
 * Levels are ordered by restrictiveness:
 *   default < no-telemetry < essential-traffic
 *
 * - default:            Everything enabled.
 * - no-telemetry:       Analytics/telemetry disabled (Datadog, 1P events, feedback survey).
 * - essential-traffic:  ALL nonessential network traffic disabled
 *                       (telemetry + auto-updates, grove, release notes, model capabilities, etc.).
 *
 * The resolved level is the most restrictive signal from:
 *   CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC  →  essential-traffic
 *   DISABLE_TELEMETRY                         →  no-telemetry
 */
type PrivacyLevel = 'default' | 'no-telemetry' | 'essential-traffic';
export declare function getPrivacyLevel(): PrivacyLevel;
/**
 * True when all nonessential network traffic should be suppressed.
 * Equivalent to the old `process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` check.
 */
export declare function isEssentialTrafficOnly(): boolean;
/**
 * True when telemetry/analytics should be suppressed.
 * True at both `no-telemetry` and `essential-traffic` levels.
 */
export declare function isTelemetryDisabled(): boolean;
/**
 * Returns the env var name responsible for the current essential-traffic restriction,
 * or null if unrestricted. Used for user-facing "unset X to re-enable" messages.
 */
export declare function getEssentialTrafficOnlyReason(): string | null;
export {};
//# sourceMappingURL=privacyLevel.d.ts.map