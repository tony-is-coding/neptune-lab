import * as React from 'react';
import type { MCPToolResult } from '../mcpValidation.js';
/**
 * Rendering overrides for `mcp__computer-use__*` tools. Spread into the MCP
 * tool object in `client.ts` after the default `userFacingName`, so these win.
 * Mirror of `getClaudeInChromeMCPToolOverrides`.
 */
export declare function getComputerUseMCPRenderingOverrides(toolName: string): {
    userFacingName: () => string;
    renderToolUseMessage: (input: Record<string, unknown>, options: {
        verbose: boolean;
    }) => React.ReactNode;
    renderToolResultMessage: (output: MCPToolResult, progressMessages: unknown[], options: {
        verbose: boolean;
    }) => React.ReactNode;
};
//# sourceMappingURL=toolRendering.d.ts.map