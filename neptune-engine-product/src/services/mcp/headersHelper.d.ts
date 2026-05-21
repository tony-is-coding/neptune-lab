import type { McpHTTPServerConfig, McpSSEServerConfig, McpWebSocketServerConfig } from './types.js';
/**
 * Get dynamic headers for an MCP server using the headersHelper script
 * @param serverName The name of the MCP server
 * @param config The MCP server configuration
 * @returns Headers object or null if not configured or failed
 */
export declare function getMcpHeadersFromHelper(serverName: string, config: McpSSEServerConfig | McpHTTPServerConfig | McpWebSocketServerConfig): Promise<Record<string, string> | null>;
/**
 * Get combined headers for an MCP server (static + dynamic)
 * @param serverName The name of the MCP server
 * @param config The MCP server configuration
 * @returns Combined headers object
 */
export declare function getMcpServerHeaders(serverName: string, config: McpSSEServerConfig | McpHTTPServerConfig | McpWebSocketServerConfig): Promise<Record<string, string>>;
//# sourceMappingURL=headersHelper.d.ts.map