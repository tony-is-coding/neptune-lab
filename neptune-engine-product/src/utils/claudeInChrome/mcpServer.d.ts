/** @cli-only */
import { type ClaudeForChromeContext } from '@ant/claude-for-chrome-mcp';
/**
 * Build the ClaudeForChromeContext used by both the subprocess MCP server
 * and the in-process path in the MCP client.
 */
export declare function createChromeContext(env?: Record<string, string>): ClaudeForChromeContext;
export declare function runClaudeInChromeMcpServer(): Promise<void>;
//# sourceMappingURL=mcpServer.d.ts.map