/**
 * Cross-App Access (XAA) / Enterprise Managed Authorization (SEP-990)
 *
 * Obtains an MCP access token WITHOUT a browser consent screen by chaining:
 *   1. RFC 8693 Token Exchange at the IdP: id_token → ID-JAG
 *   2. RFC 7523 JWT Bearer Grant at the AS: ID-JAG → access_token
 *
 * Spec refs:
 *   - ID-JAG (IETF draft): https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/
 *   - MCP ext-auth (SEP-990): https://github.com/modelcontextprotocol/ext-auth
 *   - RFC 8693 (Token Exchange), RFC 7523 (JWT Bearer), RFC 9728 (PRM)
 *
 * Reference impl: ~/code/mcp/conformance/examples/clients/typescript/everything-client.ts:375-522
 *
 * Structure: four Layer-2 ops (aligned with TS SDK PR #1593's Layer-2 shapes so
 * a future SDK swap is mechanical) + one Layer-3 orchestrator that composes them.
 */
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js';
/**
 * Thrown by requestJwtAuthorizationGrant when the IdP token-exchange leg
 * fails. Carries `shouldClearIdToken` so callers can decide whether to drop
 * the cached id_token based on OAuth error semantics (not substring matching):
 *   - 4xx / invalid_grant / invalid_token → id_token is bad, clear it
 *   - 5xx → IdP is down, id_token may still be valid, keep it
 *   - 200 with structurally-invalid body → protocol violation, clear it
 */
export declare class XaaTokenExchangeError extends Error {
    readonly shouldClearIdToken: boolean;
    constructor(message: string, shouldClearIdToken: boolean);
}
export type ProtectedResourceMetadata = {
    resource: string;
    authorization_servers: string[];
};
/**
 * RFC 9728 PRM discovery via SDK, plus RFC 9728 §3.3 resource-mismatch
 * validation (mix-up protection — TODO: upstream to SDK).
 */
export declare function discoverProtectedResource(serverUrl: string, opts?: {
    fetchFn?: FetchLike;
}): Promise<ProtectedResourceMetadata>;
export type AuthorizationServerMetadata = {
    issuer: string;
    token_endpoint: string;
    grant_types_supported?: string[];
    token_endpoint_auth_methods_supported?: string[];
};
/**
 * AS metadata discovery via SDK (RFC 8414 + OIDC fallback), plus RFC 8414
 * §3.3 issuer-mismatch validation (mix-up protection — TODO: upstream to SDK).
 */
export declare function discoverAuthorizationServer(asUrl: string, opts?: {
    fetchFn?: FetchLike;
}): Promise<AuthorizationServerMetadata>;
export type JwtAuthGrantResult = {
    /** The ID-JAG (Identity Assertion Authorization Grant) */
    jwtAuthGrant: string;
    expiresIn?: number;
    scope?: string;
};
/**
 * RFC 8693 Token Exchange at the IdP: id_token → ID-JAG.
 * Validates `issued_token_type` is `urn:ietf:params:oauth:token-type:id-jag`.
 *
 * `clientSecret` is optional — sent via `client_secret_post` if present.
 * Some IdPs register the client as confidential even when they advertise
 * `token_endpoint_auth_method: "none"`.
 *
 * TODO(xaa-ga): consult `token_endpoint_auth_methods_supported` from IdP
 * OIDC metadata and support `client_secret_basic`, mirroring the AS-side
 * selection in `performCrossAppAccess`. All major IdPs accept POST today.
 */
export declare function requestJwtAuthorizationGrant(opts: {
    tokenEndpoint: string;
    audience: string;
    resource: string;
    idToken: string;
    clientId: string;
    clientSecret?: string;
    scope?: string;
    fetchFn?: FetchLike;
}): Promise<JwtAuthGrantResult>;
export type XaaTokenResult = {
    access_token: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
    refresh_token?: string;
};
export type XaaResult = XaaTokenResult & {
    /**
     * The AS issuer URL discovered via PRM. Callers must persist this as
     * `discoveryState.authorizationServerUrl` so that refresh (auth.ts _doRefresh)
     * and revocation (revokeServerTokens) can locate the token/revocation
     * endpoints — the MCP URL is not the AS URL in typical XAA setups.
     */
    authorizationServerUrl: string;
};
/**
 * RFC 7523 JWT Bearer Grant at the AS: ID-JAG → access_token.
 *
 * `authMethod` defaults to `client_secret_basic` (Base64 header, not body
 * params) — the SEP-990 conformance test requires this. Only set
 * `client_secret_post` if the AS explicitly requires it.
 */
export declare function exchangeJwtAuthGrant(opts: {
    tokenEndpoint: string;
    assertion: string;
    clientId: string;
    clientSecret: string;
    authMethod?: 'client_secret_basic' | 'client_secret_post';
    scope?: string;
    fetchFn?: FetchLike;
}): Promise<XaaTokenResult>;
/**
 * Config needed to run the full XAA orchestrator.
 * Mirrors the conformance test context shape (see ClientConformanceContextSchema).
 */
export type XaaConfig = {
    /** Client ID registered at the MCP server's authorization server */
    clientId: string;
    /** Client secret for the MCP server's authorization server */
    clientSecret: string;
    /** Client ID registered at the IdP (for the token-exchange request) */
    idpClientId: string;
    /** Optional IdP client secret (client_secret_post) — some IdPs require it */
    idpClientSecret?: string;
    /** The user's OIDC id_token from the IdP login */
    idpIdToken: string;
    /** IdP token endpoint (where to send the RFC 8693 token-exchange) */
    idpTokenEndpoint: string;
};
/**
 * Full XAA flow: PRM → AS metadata → token-exchange → jwt-bearer → access_token.
 * Thin composition of the four Layer-2 ops. Used by performMCPXaaAuth,
 * ClaudeAuthProvider.xaaRefresh, and the try-xaa*.ts debug scripts.
 *
 * @param serverUrl The MCP server URL (e.g. `https://mcp.example.com/mcp`)
 * @param config IdP + AS credentials
 * @param serverName Server name for debug logging
 */
export declare function performCrossAppAccess(serverUrl: string, config: XaaConfig, serverName?: string, abortSignal?: AbortSignal): Promise<XaaResult>;
//# sourceMappingURL=xaa.d.ts.map