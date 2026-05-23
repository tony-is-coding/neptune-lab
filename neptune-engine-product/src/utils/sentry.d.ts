/**
 * Sentry integration module
 *
 * Initializes Sentry SDK when SENTRY_DSN environment variable is set.
 * When DSN is not configured, all exports are no-ops.
 */
/**
 * Initialize Sentry SDK. Safe to call multiple times — subsequent calls are no-ops.
 * Only activates when SENTRY_DSN environment variable is set.
 */
export declare function initSentry(): void;
/**
 * Capture an exception and send it to Sentry.
 * No-op if Sentry has not been initialized.
 */
export declare function captureException(error: unknown, context?: Record<string, unknown>): void;
/**
 * Set a tag on the current scope for grouping/filtering in Sentry.
 * No-op if Sentry has not been initialized.
 */
export declare function setTag(key: string, value: string): void;
/**
 * Set user context in Sentry for error attribution.
 * No-op if Sentry has not been initialized.
 */
export declare function setUser(user: {
    id?: string;
    email?: string;
    username?: string;
}): void;
/**
 * Flush pending Sentry events and close the client.
 * Call during graceful shutdown to ensure events are sent.
 */
export declare function closeSentry(timeoutMs?: number): Promise<void>;
/**
 * Check if Sentry is initialized. Useful for conditional UI rendering.
 */
export declare function isSentryInitialized(): boolean;
//# sourceMappingURL=sentry.d.ts.map