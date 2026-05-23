/**
 * XAA IdP Login — acquires an OIDC id_token from an enterprise IdP via the
 * standard authorization_code + PKCE flow, then caches it by IdP issuer.
 *
 * This is the "one browser pop" in the XAA value prop: one IdP login → N silent
 * MCP server auths. The id_token is cached in the keychain and reused until expiry.
 */
import { type OpenIdProviderDiscoveryMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
export declare function isXaaEnabled(): boolean;
export type XaaIdpSettings = {
    issuer: string;
    clientId: string;
    callbackPort?: number;
};
/**
 * Typed accessor for settings.xaaIdp. The field is env-gated in SettingsSchema
 * so it doesn't surface in SDK types/docs — which means the inferred settings
 * type doesn't have it at compile time. This is the one cast.
 */
export declare function getXaaIdpSettings(): XaaIdpSettings | undefined;
export type IdpLoginOptions = {
    idpIssuer: string;
    idpClientId: string;
    /**
     * Optional IdP client secret for confidential clients. Auth method
     * (client_secret_post, client_secret_basic, none) is chosen per IdP
     * metadata. Omit for public clients (PKCE only).
     */
    idpClientSecret?: string;
    /**
     * Fixed callback port. If omitted, a random port is chosen.
     * Use this when the IdP client is pre-registered with a specific loopback
     * redirect URI (RFC 8252 §7.3 says IdPs SHOULD accept any port for
     * http://localhost, but many don't).
     */
    callbackPort?: number;
    /** Called with the authorization URL before (or instead of) opening the browser */
    onAuthorizationUrl?: (url: string) => void;
    /** If true, don't auto-open the browser — just call onAuthorizationUrl */
    skipBrowserOpen?: boolean;
    abortSignal?: AbortSignal;
};
/**
 * Normalize an IdP issuer URL for use as a cache key: strip trailing slashes,
 * lowercase host. Issuers from config and from OIDC discovery may differ
 * cosmetically but should hit the same cache slot. Exported so the setup
 * command can compare issuers using the same normalization as keychain ops.
 */
export declare function issuerKey(issuer: string): string;
/**
 * Read a cached id_token for the given IdP issuer from secure storage.
 * Returns undefined if missing or within ID_TOKEN_EXPIRY_BUFFER_S of expiring.
 */
export declare function getCachedIdpIdToken(idpIssuer: string): string | undefined;
/**
 * Save an externally-obtained id_token into the XAA cache — the exact slot
 * getCachedIdpIdToken/acquireIdpIdToken read from. Used by conformance testing
 * where the mock IdP hands us a pre-signed token but doesn't serve /authorize.
 *
 * Parses the JWT's exp claim for cache TTL (same as acquireIdpIdToken).
 * Returns the expiresAt it computed so the caller can report it.
 */
export declare function saveIdpIdTokenFromJwt(idpIssuer: string, idToken: string): number;
export declare function clearIdpIdToken(idpIssuer: string): void;
/**
 * Save an IdP client secret to secure storage, keyed by IdP issuer.
 * Separate from MCP server AS secrets — different trust domain.
 * Returns the storage update result so callers can surface keychain
 * failures (locked keychain, `security` nonzero exit) instead of
 * silently dropping the secret and failing later with invalid_client.
 */
export declare function saveIdpClientSecret(idpIssuer: string, clientSecret: string): {
    success: boolean;
    warning?: string;
};
/**
 * Read the IdP client secret for the given issuer from secure storage.
 */
export declare function getIdpClientSecret(idpIssuer: string): string | undefined;
/**
 * Remove the IdP client secret for the given issuer from secure storage.
 * Used by `claude mcp xaa clear`.
 */
export declare function clearIdpClientSecret(idpIssuer: string): void;
export declare function discoverOidc(idpIssuer: string): Promise<OpenIdProviderDiscoveryMetadata>;
/**
 * Acquire an id_token from the IdP: return cached if valid, otherwise run
 * the full OIDC authorization_code + PKCE flow (one browser pop).
 */
export declare function acquireIdpIdToken(opts: IdpLoginOptions): Promise<string>;
//# sourceMappingURL=xaaIdpLogin.d.ts.map