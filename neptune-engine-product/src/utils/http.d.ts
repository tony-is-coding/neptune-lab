/**
 * HTTP utility constants and helpers
 */
export declare function getUserAgent(): string;
export declare function getMCPUserAgent(): string;
export declare function getWebFetchUserAgent(): string;
export type AuthHeaders = {
    headers: Record<string, string>;
    error?: string;
};
/**
 * Get authentication headers for API requests
 * Returns either OAuth headers for Max/Pro users or API key headers for regular users
 */
export declare function getAuthHeaders(): AuthHeaders;
/**
 * Wrapper that handles OAuth 401 errors by force-refreshing the token and
 * retrying once. Addresses clock drift scenarios where the local expiration
 * check disagrees with the server.
 *
 * The request closure is called again on retry, so it should re-read auth
 * (e.g., via getAuthHeaders()) to pick up the refreshed token.
 *
 * Note: bridgeApi.ts has its own DI-injected version — handleOAuth401Error
 * transitively pulls in config.ts (~1300 modules), which breaks the SDK bundle.
 *
 * @param opts.also403Revoked - Also retry on 403 with "OAuth token has been
 *   revoked" body (some endpoints signal revocation this way instead of 401).
 */
export declare function withOAuth401Retry<T>(request: () => Promise<T>, opts?: {
    also403Revoked?: boolean;
}): Promise<T>;
//# sourceMappingURL=http.d.ts.map