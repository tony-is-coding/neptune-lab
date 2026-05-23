/**
 * Fire-and-forget fetch of the official MCP registry.
 * Populates officialUrls for isOfficialMcpUrl lookups.
 */
export declare function prefetchOfficialMcpUrls(): Promise<void>;
/**
 * Returns true iff the given (already-normalized via getLoggingSafeMcpBaseUrl)
 * URL is in the official MCP registry. Undefined registry → false (fail-closed).
 */
export declare function isOfficialMcpUrl(normalizedUrl: string): boolean;
export declare function resetOfficialMcpUrlsForTesting(): void;
//# sourceMappingURL=officialRegistry.d.ts.map