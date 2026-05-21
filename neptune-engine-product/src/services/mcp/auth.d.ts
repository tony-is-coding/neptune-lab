import { discoverAuthorizationServerMetadata, type OAuthClientProvider, type OAuthDiscoveryState } from '@modelcontextprotocol/sdk/client/auth.js';
import { type OAuthClientInformation, type OAuthClientInformationFull, type OAuthClientMetadata, type OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { McpHTTPServerConfig, McpSSEServerConfig } from './types.js';
export declare function normalizeOAuthErrorBody(response: Response): Promise<Response>;
export declare class AuthenticationCancelledError extends Error {
    constructor();
}
/**
 * Generates a unique key for server credentials based on both name and config hash
 * This prevents credentials from being reused across different servers
 * with the same name or different configurations
 */
export declare function getServerKey(serverName: string, serverConfig: McpSSEServerConfig | McpHTTPServerConfig): string;
/**
 * True when we have probed this server before (OAuth discovery state is
 * stored) but hold no credentials to try. A connection attempt in this
 * state is guaranteed to 401 — the only way out is the user running
 * /mcp to authenticate.
 */
export declare function hasMcpDiscoveryButNoToken(serverName: string, serverConfig: McpSSEServerConfig | McpHTTPServerConfig): boolean;
/**
 * Revokes tokens on the OAuth server if a revocation endpoint is available.
 * Per RFC 7009, we revoke the refresh token first (the long-lived credential),
 * then the access token. Revoking the refresh token prevents generation of new
 * access tokens and many servers implicitly invalidate associated access tokens.
 */
export declare function revokeServerTokens(serverName: string, serverConfig: McpSSEServerConfig | McpHTTPServerConfig, { preserveStepUpState }?: {
    preserveStepUpState?: boolean;
}): Promise<void>;
export declare function clearServerTokensFromLocalStorage(serverName: string, serverConfig: McpSSEServerConfig | McpHTTPServerConfig): void;
export declare function performMCPOAuthFlow(serverName: string, serverConfig: McpSSEServerConfig | McpHTTPServerConfig, onAuthorizationUrl: (url: string) => void, abortSignal?: AbortSignal, options?: {
    skipBrowserOpen?: boolean;
    onWaitingForCallback?: (submit: (callbackUrl: string) => void) => void;
}): Promise<void>;
/**
 * Wraps fetch to detect 403 insufficient_scope responses and mark step-up
 * pending on the provider BEFORE the SDK's 403 handler calls auth(). Without
 * this, the SDK's authInternal sees refresh_token → refreshes (uselessly, since
 * RFC 6749 §6 forbids scope elevation via refresh) → returns 'AUTHORIZED' →
 * retry → 403 again → aborts with "Server returned 403 after trying upscoping",
 * never reaching redirectToAuthorization where step-up scope is persisted.
 * With this flag set, tokens() omits refresh_token so the SDK falls through
 * to the PKCE flow. See github.com/anthropics/claude-code/issues/28258.
 */
export declare function wrapFetchWithStepUpDetection(baseFetch: FetchLike, provider: ClaudeAuthProvider): FetchLike;
export declare class ClaudeAuthProvider implements OAuthClientProvider {
    private serverName;
    private serverConfig;
    private redirectUri;
    private handleRedirection;
    private _codeVerifier?;
    private _authorizationUrl?;
    private _state?;
    private _scopes?;
    private _metadata?;
    private _refreshInProgress?;
    private _pendingStepUpScope?;
    private onAuthorizationUrlCallback?;
    private skipBrowserOpen;
    constructor(serverName: string, serverConfig: McpSSEServerConfig | McpHTTPServerConfig, redirectUri?: string, handleRedirection?: boolean, onAuthorizationUrl?: (url: string) => void, skipBrowserOpen?: boolean);
    get redirectUrl(): string;
    get authorizationUrl(): string | undefined;
    get clientMetadata(): OAuthClientMetadata;
    /**
     * CIMD (SEP-991): URL-based client_id. When the auth server advertises
     * client_id_metadata_document_supported: true, the SDK uses this URL as the
     * client_id instead of performing Dynamic Client Registration.
     * Override via MCP_OAUTH_CLIENT_METADATA_URL env var (e.g. for testing, FedStart).
     */
    get clientMetadataUrl(): string | undefined;
    setMetadata(metadata: Awaited<ReturnType<typeof discoverAuthorizationServerMetadata>>): void;
    /**
     * Called by the fetch wrapper when a 403 insufficient_scope response is
     * detected. Setting this causes tokens() to omit refresh_token, forcing
     * the SDK's authInternal to skip its (useless) refresh path and fall through
     * to startAuthorization → redirectToAuthorization → step-up persistence.
     * RFC 6749 §6 forbids scope elevation via refresh, so refreshing would just
     * return the same-scoped token and the retry would 403 again.
     */
    markStepUpPending(scope: string): void;
    state(): Promise<string>;
    clientInformation(): Promise<OAuthClientInformation | undefined>;
    saveClientInformation(clientInformation: OAuthClientInformationFull): Promise<void>;
    tokens(): Promise<OAuthTokens | undefined>;
    saveTokens(tokens: OAuthTokens): Promise<void>;
    /**
     * XAA silent refresh: cached id_token → Layer-2 exchange → new access_token.
     * No browser.
     *
     * Returns undefined if the id_token is gone from cache — caller treats this
     * as needs-interactive-reauth (transport will 401, CC surfaces it).
     *
     * On exchange failure, clears the id_token cache so the next interactive
     * auth does a fresh IdP login (the cached id_token is likely stale/revoked).
     *
     * TODO(xaa-ga): add cross-process lockfile before GA. `_refreshInProgress`
     * only dedupes within one process — two CC instances with expiring tokens
     * both fire the full 4-request XAA chain and race on storage.update().
     * Unlike inc-4829 the id_token is not single-use so both access_tokens
     * stay valid (wasted round-trips + keychain write race, not brickage),
     * but this is the shape CLAUDE.md flags under "Token/auth caching across
     * process boundaries". Mirror refreshAuthorization()'s lockfile pattern.
     */
    private xaaRefresh;
    redirectToAuthorization(authorizationUrl: URL): Promise<void>;
    saveCodeVerifier(codeVerifier: string): Promise<void>;
    codeVerifier(): Promise<string>;
    invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void>;
    saveDiscoveryState(state: OAuthDiscoveryState): Promise<void>;
    discoveryState(): Promise<OAuthDiscoveryState | undefined>;
    refreshAuthorization(refreshToken: string): Promise<OAuthTokens | undefined>;
    private _doRefresh;
}
export declare function readClientSecret(): Promise<string>;
export declare function saveMcpClientSecret(serverName: string, serverConfig: McpSSEServerConfig | McpHTTPServerConfig, clientSecret: string): void;
export declare function clearMcpClientConfig(serverName: string, serverConfig: McpSSEServerConfig | McpHTTPServerConfig): void;
export declare function getMcpClientConfig(serverName: string, serverConfig: McpSSEServerConfig | McpHTTPServerConfig): {
    clientSecret?: string;
} | undefined;
//# sourceMappingURL=auth.d.ts.map