export declare const PRODUCT_URL = "https://claude.com/claude-code";
export declare const CLAUDE_AI_BASE_URL = "https://claude.ai";
export declare const CLAUDE_AI_STAGING_BASE_URL = "https://claude-ai.staging.ant.dev";
export declare const CLAUDE_AI_LOCAL_BASE_URL = "http://localhost:4000";
/**
 * Determine if we're in a staging environment for remote sessions.
 * Checks session ID format and ingress URL.
 */
export declare function isRemoteSessionStaging(sessionId?: string, ingressUrl?: string): boolean;
/**
 * Determine if we're in a local-dev environment for remote sessions.
 * Checks session ID format (e.g. `session_local_...`) and ingress URL.
 */
export declare function isRemoteSessionLocal(sessionId?: string, ingressUrl?: string): boolean;
/**
 * Get the base URL for Claude AI based on environment.
 * For localhost, derives the base URL from the ingress URL to preserve the
 * actual server port instead of using the hardcoded default (4000).
 */
export declare function getClaudeAiBaseUrl(sessionId?: string, ingressUrl?: string): string;
/**
 * Get the full session URL for a remote session.
 *
 * The cse_→session_ translation is a temporary shim gated by
 * tengu_bridge_repl_v2_cse_shim_enabled (see isCseShimEnabled). Worker
 * endpoints (/v1/code/sessions/{id}/worker/*) want `cse_*` but the claude.ai
 * frontend currently routes on `session_*` (compat/convert.go:27 validates
 * TagSession). Same UUID body, different tag prefix. Once the server tags by
 * environment_kind and the frontend accepts `cse_*` directly, flip the gate
 * off. No-op for IDs already in `session_*` form. See toCompatSessionId in
 * src/utils/sessionIdCompat.ts for the canonical helper.
 */
export declare function getRemoteSessionUrl(sessionId: string, ingressUrl?: string): string;
//# sourceMappingURL=product.d.ts.map