export declare const CCR_OAUTH_TOKEN_PATH = "/home/claude/.claude/remote/.oauth_token";
export declare const CCR_API_KEY_PATH = "/home/claude/.claude/remote/.api_key";
export declare const CCR_SESSION_INGRESS_TOKEN_PATH = "/home/claude/.claude/remote/.session_ingress_token";
/**
 * Best-effort write of the token to a well-known location for subprocess
 * access. CCR-gated: outside CCR there's no /home/claude/ and no reason to
 * put a token on disk that the FD was meant to keep off disk.
 */
export declare function maybePersistTokenForSubprocesses(path: string, token: string, tokenName: string): void;
/**
 * Fallback read from a well-known file. The path only exists in CCR (env-manager
 * creates the directory), so file-not-found is the expected outcome everywhere
 * else — treated as "no fallback", not an error.
 */
export declare function readTokenFromWellKnownFile(path: string, tokenName: string): string | null;
/**
 * Get the CCR-injected OAuth token. See getCredentialFromFd for FD-vs-disk
 * rationale. Env var: CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR.
 * Well-known file: /home/claude/.claude/remote/.oauth_token.
 */
export declare function getOAuthTokenFromFileDescriptor(): string | null;
/**
 * Get the CCR-injected API key. See getCredentialFromFd for FD-vs-disk
 * rationale. Env var: CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR.
 * Well-known file: /home/claude/.claude/remote/.api_key.
 */
export declare function getApiKeyFromFileDescriptor(): string | null;
//# sourceMappingURL=authFileDescriptor.d.ts.map