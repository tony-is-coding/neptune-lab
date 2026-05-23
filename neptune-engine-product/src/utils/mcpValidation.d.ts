import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
export declare const MCP_TOKEN_COUNT_THRESHOLD_FACTOR = 0.5;
export declare const IMAGE_TOKEN_ESTIMATE = 1600;
/**
 * Resolve the MCP output token cap. Precedence:
 *   1. MAX_MCP_OUTPUT_TOKENS env var (explicit user override)
 *   2. tengu_satin_quoll GrowthBook flag's `mcp_tool` key (tokens, not chars —
 *      unlike the other keys in that map which getPersistenceThreshold reads
 *      as chars; MCP has its own truncation layer upstream of that)
 *   3. Hardcoded default
 */
export declare function getMaxMcpOutputTokens(): number;
export type MCPToolResult = string | ContentBlockParam[] | undefined;
export declare function getContentSizeEstimate(content: MCPToolResult): number;
export declare function mcpContentNeedsTruncation(content: MCPToolResult): Promise<boolean>;
export declare function truncateMcpContent(content: MCPToolResult): Promise<MCPToolResult>;
export declare function truncateMcpContentIfNeeded(content: MCPToolResult): Promise<MCPToolResult>;
//# sourceMappingURL=mcpValidation.d.ts.map