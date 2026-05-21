import * as React from 'react';
import type { MCPToolResult } from '../../utils/mcpValidation.js';
export type { Tool } from '@modelcontextprotocol/sdk/types.js';
/**
 * All tool names from BROWSER_TOOLS in @ant/claude-for-chrome-mcp.
 * Keep in sync with the package's BROWSER_TOOLS array.
 */
export type ChromeToolName = 'javascript_tool' | 'read_page' | 'find' | 'form_input' | 'computer' | 'navigate' | 'resize_window' | 'gif_creator' | 'upload_image' | 'get_page_text' | 'tabs_context_mcp' | 'tabs_create_mcp' | 'update_plan' | 'read_console_messages' | 'read_network_requests' | 'shortcuts_list' | 'shortcuts_execute';
/**
 * Custom tool result message rendering for claude-in-chrome tools.
 * Shows a brief summary for successful results. Errors are handled by
 * the default renderToolUseErrorMessage when is_error is set.
 */
export declare function renderChromeToolResultMessage(output: MCPToolResult, toolName: ChromeToolName, verbose: boolean): React.ReactNode;
/**
 * Returns tool method overrides for Claude in Chrome MCP tools. Use this to customize
 * rendering for chrome tools in a single spread operation.
 */
export declare function getClaudeInChromeMCPToolOverrides(toolName: string): {
    userFacingName: (input?: Record<string, unknown>) => string;
    renderToolUseMessage: (input: Record<string, unknown>, options: {
        verbose: boolean;
    }) => React.ReactNode;
    renderToolUseTag: (input: Partial<Record<string, unknown>>) => React.ReactNode;
    renderToolResultMessage: (output: string | MCPToolResult, progressMessagesForMessage: unknown[], options: {
        verbose: boolean;
    }) => React.ReactNode;
};
//# sourceMappingURL=toolRendering.d.ts.map