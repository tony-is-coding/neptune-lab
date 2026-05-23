import type { OAuthProfileResponse } from 'src/services/oauth/types.js';
export declare function getOauthProfileFromApiKey(): Promise<OAuthProfileResponse | undefined>;
export declare function getOauthProfileFromOauthToken(accessToken: string): Promise<OAuthProfileResponse | undefined>;
//# sourceMappingURL=getOauthProfile.d.ts.map