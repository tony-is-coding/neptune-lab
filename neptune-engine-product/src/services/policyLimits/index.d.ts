/**
 * Policy Limits Service
 *
 * Fetches organization-level policy restrictions from the API and uses them
 * to disable CLI features. Follows the same patterns as remote managed settings
 * (fail open, ETag caching, background polling, retry logic).
 *
 * Eligibility:
 * - Console users (API key): All eligible
 * - OAuth users (Claude.ai): Only Team and Enterprise/C4E subscribers are eligible
 * - API fails open (non-blocking) - if fetch fails, continues without restrictions
 * - API returns empty restrictions for users without policy limits
 */
/**
 * Test-only sync reset. clearPolicyLimitsCache() does file I/O and is too
 * expensive for preload beforeEach; this only clears the module-level
 * singleton so downstream tests in the same shard see a clean slate.
 */
export declare function _resetPolicyLimitsForTesting(): void;
/**
 * Initialize the loading promise for policy limits
 * This should be called early (e.g., in init.ts) to allow other systems
 * to await policy limits loading even if loadPolicyLimits() hasn't been called yet.
 *
 * Only creates the promise if the user is eligible for policy limits.
 * Includes a timeout to prevent deadlocks if loadPolicyLimits() is never called.
 */
export declare function initializePolicyLimitsLoadingPromise(): void;
/**
 * Check if the current user is eligible for policy limits.
 *
 * IMPORTANT: This function must NOT call getSettings() or any function that calls
 * getSettings() to avoid circular dependencies during settings loading.
 */
export declare function isPolicyLimitsEligible(): boolean;
/**
 * Wait for the initial policy limits loading to complete
 * Returns immediately if user is not eligible or loading has already completed
 */
export declare function waitForPolicyLimitsToLoad(): Promise<void>;
/**
 * Check if a specific policy is allowed
 * Returns true if the policy is unknown, unavailable, or explicitly allowed (fail open).
 * Exception: policies in ESSENTIAL_TRAFFIC_DENY_ON_MISS fail closed when
 * essential-traffic-only mode is active and the cache is unavailable.
 */
export declare function isPolicyAllowed(policy: string): boolean;
/**
 * Load policy limits during CLI initialization
 * Fails open - if fetch fails, continues without restrictions
 * Also starts background polling to pick up changes mid-session
 */
export declare function loadPolicyLimits(): Promise<void>;
/**
 * Refresh policy limits asynchronously (for auth state changes)
 * Used when login occurs
 */
export declare function refreshPolicyLimits(): Promise<void>;
/**
 * Clear all policy limits (session, persistent, and stop polling)
 */
export declare function clearPolicyLimitsCache(): Promise<void>;
/**
 * Start background polling for policy limits
 */
export declare function startBackgroundPolling(): void;
/**
 * Stop background polling for policy limits
 */
export declare function stopBackgroundPolling(): void;
//# sourceMappingURL=index.d.ts.map