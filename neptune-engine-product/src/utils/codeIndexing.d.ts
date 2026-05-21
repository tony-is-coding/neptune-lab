/**
 * Utility functions for detecting code indexing tool usage.
 *
 * Tracks usage of common code indexing solutions like Sourcegraph, Cody, etc.
 * both via CLI commands and MCP server integrations.
 */
/**
 * Known code indexing tool identifiers.
 * These are the normalized names used in analytics events.
 */
export type CodeIndexingTool = 'sourcegraph' | 'hound' | 'seagoat' | 'bloop' | 'gitloop' | 'cody' | 'aider' | 'continue' | 'github-copilot' | 'cursor' | 'tabby' | 'codeium' | 'tabnine' | 'augment' | 'windsurf' | 'aide' | 'pieces' | 'qodo' | 'amazon-q' | 'gemini' | 'claude-context' | 'code-index-mcp' | 'local-code-search' | 'autodev-codebase' | 'openctx';
/**
 * Detects if a bash command is using a code indexing CLI tool.
 *
 * @param command - The full bash command string
 * @returns The code indexing tool identifier, or undefined if not a code indexing command
 *
 * @example
 * detectCodeIndexingFromCommand('src search "pattern"') // returns 'sourcegraph'
 * detectCodeIndexingFromCommand('cody chat --message "help"') // returns 'cody'
 * detectCodeIndexingFromCommand('ls -la') // returns undefined
 */
export declare function detectCodeIndexingFromCommand(command: string): CodeIndexingTool | undefined;
/**
 * Detects if an MCP tool is from a code indexing server.
 *
 * @param toolName - The MCP tool name (format: mcp__serverName__toolName)
 * @returns The code indexing tool identifier, or undefined if not a code indexing tool
 *
 * @example
 * detectCodeIndexingFromMcpTool('mcp__sourcegraph__search') // returns 'sourcegraph'
 * detectCodeIndexingFromMcpTool('mcp__cody__chat') // returns 'cody'
 * detectCodeIndexingFromMcpTool('mcp__filesystem__read') // returns undefined
 */
export declare function detectCodeIndexingFromMcpTool(toolName: string): CodeIndexingTool | undefined;
/**
 * Detects if an MCP server name corresponds to a code indexing tool.
 *
 * @param serverName - The MCP server name
 * @returns The code indexing tool identifier, or undefined if not a code indexing server
 *
 * @example
 * detectCodeIndexingFromMcpServerName('sourcegraph') // returns 'sourcegraph'
 * detectCodeIndexingFromMcpServerName('filesystem') // returns undefined
 */
export declare function detectCodeIndexingFromMcpServerName(serverName: string): CodeIndexingTool | undefined;
//# sourceMappingURL=codeIndexing.d.ts.map