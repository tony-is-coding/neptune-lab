/**
 * Builds a redirect URI on localhost with the given port and a fixed `/callback` path.
 *
 * RFC 8252 Section 7.3 (OAuth for Native Apps): loopback redirect URIs match any
 * port as long as the path matches.
 */
export declare function buildRedirectUri(port?: number): string;
/**
 * Finds an available port in the specified range for OAuth redirect
 * Uses random selection for better security
 */
export declare function findAvailablePort(): Promise<number>;
//# sourceMappingURL=oauthPort.d.ts.map