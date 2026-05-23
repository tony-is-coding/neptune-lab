export declare const CLAUDE_CODE_20250219_BETA_HEADER = "claude-code-20250219";
export declare const INTERLEAVED_THINKING_BETA_HEADER = "interleaved-thinking-2025-05-14";
export declare const CONTEXT_1M_BETA_HEADER = "context-1m-2025-08-07";
export declare const CONTEXT_MANAGEMENT_BETA_HEADER = "context-management-2025-06-27";
export declare const STRUCTURED_OUTPUTS_BETA_HEADER = "structured-outputs-2025-12-15";
export declare const WEB_SEARCH_BETA_HEADER = "web-search-2025-03-05";
export declare const TOOL_SEARCH_BETA_HEADER_1P = "advanced-tool-use-2025-11-20";
export declare const TOOL_SEARCH_BETA_HEADER_3P = "tool-search-tool-2025-10-19";
export declare const EFFORT_BETA_HEADER = "effort-2025-11-24";
export declare const TASK_BUDGETS_BETA_HEADER = "task-budgets-2026-03-13";
export declare const PROMPT_CACHING_SCOPE_BETA_HEADER = "prompt-caching-scope-2026-01-05";
export declare const FAST_MODE_BETA_HEADER = "fast-mode-2026-02-01";
export declare const REDACT_THINKING_BETA_HEADER = "redact-thinking-2026-02-12";
export declare const TOKEN_EFFICIENT_TOOLS_BETA_HEADER = "token-efficient-tools-2026-03-28";
export declare const AFK_MODE_BETA_HEADER: string;
export declare const CLI_INTERNAL_BETA_HEADER: string;
export declare const ADVISOR_BETA_HEADER = "advisor-tool-2026-03-01";
/**
 * Bedrock only supports a limited number of beta headers and only through
 * extraBodyParams. This set maintains the beta strings that should be in
 * Bedrock extraBodyParams *and not* in Bedrock headers.
 */
export declare const BEDROCK_EXTRA_PARAMS_HEADERS: Set<string>;
/**
 * Betas allowed on Vertex countTokens API.
 * Other betas will cause 400 errors.
 */
export declare const VERTEX_COUNT_TOKENS_ALLOWED_BETAS: Set<string>;
export declare const CACHE_EDITING_BETA_HEADER: string;
//# sourceMappingURL=betas.d.ts.map