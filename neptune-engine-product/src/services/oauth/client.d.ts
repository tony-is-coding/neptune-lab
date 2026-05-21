import type { BillingType, OAuthProfileResponse, OAuthTokenExchangeResponse, OAuthTokens, RateLimitTier, SubscriptionType } from './types.js';
/**
 * Check if the user has Claude.ai authentication scope
 * @private Only call this if you're OAuth / auth related code!
 */
export declare function shouldUseClaudeAIAuth(scopes: string[] | undefined): boolean;
export declare function parseScopes(scopeString?: string): string[];
export declare function buildAuthUrl({ codeChallenge, state, port, isManual, loginWithClaudeAi, inferenceOnly, orgUUID, loginHint, loginMethod, }: {
    codeChallenge: string;
    state: string;
    port: number;
    isManual: boolean;
    loginWithClaudeAi?: boolean;
    inferenceOnly?: boolean;
    orgUUID?: string;
    loginHint?: string;
    loginMethod?: string;
}): string;
export declare function exchangeCodeForTokens(authorizationCode: string, state: string, codeVerifier: string, port: number, useManualRedirect?: boolean, expiresIn?: number): Promise<OAuthTokenExchangeResponse>;
export declare function refreshOAuthToken(refreshToken: string, { scopes: requestedScopes }?: {
    scopes?: string[];
}): Promise<OAuthTokens>;
export declare function fetchAndStoreUserRoles(accessToken: string): Promise<void>;
export declare function createAndStoreApiKey(accessToken: string): Promise<string | null>;
export declare function isOAuthTokenExpired(expiresAt: number | null): boolean;
export declare function fetchProfileInfo(accessToken: string): Promise<{
    subscriptionType: SubscriptionType | null;
    displayName?: string;
    rateLimitTier: RateLimitTier | null;
    hasExtraUsageEnabled: boolean | null;
    billingType: BillingType | null;
    accountCreatedAt?: string;
    subscriptionCreatedAt?: string;
    rawProfile?: OAuthProfileResponse;
}>;
/**
 * Gets the organization UUID from the OAuth access token
 * @returns The organization UUID or null if not authenticated
 */
export declare function getOrganizationUUID(): Promise<string | null>;
/**
 * Populate the OAuth account info if it has not already been cached in config.
 * @returns Whether or not the oauth account info was populated.
 */
export declare function populateOAuthAccountInfoIfNeeded(): Promise<boolean>;
export declare function storeOAuthAccountInfo({ accountUuid, emailAddress, organizationUuid, displayName, hasExtraUsageEnabled, billingType, accountCreatedAt, subscriptionCreatedAt, }: {
    accountUuid: string;
    emailAddress: string;
    organizationUuid: string | undefined;
    displayName?: string;
    hasExtraUsageEnabled?: boolean;
    billingType?: BillingType;
    accountCreatedAt?: string;
    subscriptionCreatedAt?: string;
}): void;
//# sourceMappingURL=client.d.ts.map