export declare function fileSuffixForOauthConfig(): string;
export declare const CLAUDE_AI_INFERENCE_SCOPE: "user:inference";
export declare const CLAUDE_AI_PROFILE_SCOPE: "user:profile";
export declare const OAUTH_BETA_HEADER: "oauth-2025-04-20";
export declare const CONSOLE_OAUTH_SCOPES: readonly ["org:create_api_key", "user:profile"];
export declare const CLAUDE_AI_OAUTH_SCOPES: readonly ["user:profile", "user:inference", "user:sessions:claude_code", "user:mcp_servers", "user:file_upload"];
export declare const ALL_OAUTH_SCOPES: ("user:inference" | "user:profile" | "org:create_api_key" | "user:sessions:claude_code" | "user:mcp_servers" | "user:file_upload")[];
type OauthConfig = {
    BASE_API_URL: string;
    CONSOLE_AUTHORIZE_URL: string;
    CLAUDE_AI_AUTHORIZE_URL: string;
    /**
     * The claude.ai web origin. Separate from CLAUDE_AI_AUTHORIZE_URL because
     * that now routes through claude.com/cai/* for attribution — deriving
     * .origin from it would give claude.com, breaking links to /code,
     * /settings/connectors, and other claude.ai web pages.
     */
    CLAUDE_AI_ORIGIN: string;
    TOKEN_URL: string;
    API_KEY_URL: string;
    ROLES_URL: string;
    CONSOLE_SUCCESS_URL: string;
    CLAUDEAI_SUCCESS_URL: string;
    MANUAL_REDIRECT_URL: string;
    CLIENT_ID: string;
    OAUTH_FILE_SUFFIX: string;
    MCP_PROXY_URL: string;
    MCP_PROXY_PATH: string;
};
/**
 * Client ID Metadata Document URL for MCP OAuth (CIMD / SEP-991).
 * When an MCP auth server advertises client_id_metadata_document_supported: true,
 * Claude Code uses this URL as its client_id instead of Dynamic Client Registration.
 * The URL must point to a JSON document hosted by Anthropic.
 * See: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00
 */
export declare const MCP_CLIENT_METADATA_URL = "https://claude.ai/oauth/claude-code-client-metadata";
export declare function getOauthConfig(): OauthConfig;
export {};
//# sourceMappingURL=oauth.d.ts.map