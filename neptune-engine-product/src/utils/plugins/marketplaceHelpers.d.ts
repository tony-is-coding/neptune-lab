import { getMarketplace } from './marketplaceManager.js';
import type { KnownMarketplace, MarketplaceSource } from './schemas.js';
/**
 * Format plugin failure details for user display
 * @param failures - Array of failures with names and reasons
 * @param includeReasons - Whether to include failure reasons (true for full errors, false for summaries)
 * @returns Formatted string like "plugin-a (reason); plugin-b (reason)" or "plugin-a, plugin-b"
 */
export declare function formatFailureDetails(failures: Array<{
    name: string;
    reason?: string;
    error?: string;
}>, includeReasons: boolean): string;
/**
 * Extract source display string from marketplace configuration
 */
export declare function getMarketplaceSourceDisplay(source: MarketplaceSource): string;
/**
 * Create a plugin ID from plugin name and marketplace name
 */
export declare function createPluginId(pluginName: string, marketplaceName: string): string;
/**
 * Load marketplaces with graceful degradation for individual failures.
 * Blocked marketplaces (per enterprise policy) are excluded from the results.
 */
export declare function loadMarketplacesWithGracefulDegradation(config: Record<string, KnownMarketplace>): Promise<{
    marketplaces: Array<{
        name: string;
        config: KnownMarketplace;
        data: Awaited<ReturnType<typeof getMarketplace>> | null;
    }>;
    failures: Array<{
        name: string;
        error: string;
    }>;
}>;
/**
 * Format marketplace loading failures into appropriate user messages
 */
export declare function formatMarketplaceLoadingErrors(failures: Array<{
    name: string;
    error: string;
}>, successCount: number): {
    type: 'warning' | 'error';
    message: string;
} | null;
/**
 * Get the strict marketplace source allowlist from policy settings.
 * Returns null if no restriction is in place, or an array of allowed sources.
 */
export declare function getStrictKnownMarketplaces(): MarketplaceSource[] | null;
/**
 * Get the marketplace source blocklist from policy settings.
 * Returns null if no blocklist is in place, or an array of blocked sources.
 */
export declare function getBlockedMarketplaces(): MarketplaceSource[] | null;
/**
 * Get the custom plugin trust message from policy settings.
 * Returns undefined if not configured.
 */
export declare function getPluginTrustMessage(): string | undefined;
/**
 * Extract the host/domain from a marketplace source.
 * Used for hostPattern matching in strictKnownMarketplaces.
 *
 * Currently only supports github, git, and url sources.
 * npm, file, and directory sources are not supported for hostPattern matching.
 *
 * @param source - The marketplace source to extract host from
 * @returns The hostname string, or null if extraction fails or source type not supported
 */
export declare function extractHostFromSource(source: MarketplaceSource): string | null;
/**
 * Get hosts from hostPattern entries in the allowlist.
 * Used to provide helpful error messages.
 */
export declare function getHostPatternsFromAllowlist(): string[];
/**
 * Check if a marketplace source is explicitly in the blocklist.
 * Used for error message differentiation.
 *
 * This also catches attempts to bypass a github blocklist entry by using
 * git URLs (e.g., git@github.com:owner/repo.git or https://github.com/owner/repo.git).
 */
export declare function isSourceInBlocklist(source: MarketplaceSource): boolean;
/**
 * Check if a marketplace source is allowed by enterprise policy.
 * Returns true if allowed (or no policy), false if blocked.
 * This check happens BEFORE downloading, so blocked sources never touch the filesystem.
 *
 * Policy precedence:
 * 1. blockedMarketplaces (blocklist) - if source matches, it's blocked
 * 2. strictKnownMarketplaces (allowlist) - if set, source must be in the list
 */
export declare function isSourceAllowedByPolicy(source: MarketplaceSource): boolean;
/**
 * Format a MarketplaceSource for display in error messages
 */
export declare function formatSourceForDisplay(source: MarketplaceSource): string;
/**
 * Reasons why no marketplaces are available in the Discover screen
 */
export type EmptyMarketplaceReason = 'git-not-installed' | 'all-blocked-by-policy' | 'policy-restricts-sources' | 'all-marketplaces-failed' | 'no-marketplaces-configured' | 'all-plugins-installed';
/**
 * Detect why no marketplaces are available.
 * Checks in order of priority: git availability → policy restrictions → config state → failures
 */
export declare function detectEmptyMarketplaceReason({ configuredMarketplaceCount, failedMarketplaceCount, }: {
    configuredMarketplaceCount: number;
    failedMarketplaceCount: number;
}): Promise<EmptyMarketplaceReason>;
//# sourceMappingURL=marketplaceHelpers.d.ts.map