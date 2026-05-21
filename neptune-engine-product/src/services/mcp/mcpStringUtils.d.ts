/**
 * Pure string utility functions for MCP tool/server name parsing.
 * This file has no heavy dependencies to keep it lightweight for
 * consumers that only need string parsing (e.g., permissionValidation).
 */
export declare function mcpInfoFromString(toolString: string): {
    serverName: string;
    toolName: string | undefined;
} | null;
/**
 * Generates the MCP tool/command name prefix for a given server
 * @param serverName Name of the MCP server
 * @returns The prefix string
 */
export declare function getMcpPrefix(serverName: string): string;
/**
 * Builds a fully qualified MCP tool name from server and tool names.
 * Inverse of mcpInfoFromString().
 * @param serverName Name of the MCP server (unnormalized)
 * @param toolName Name of the tool (unnormalized)
 * @returns The fully qualified name, e.g., "mcp__server__tool"
 */
export declare function buildMcpToolName(serverName: string, toolName: string): string;
/**
 * Returns the name to use for permission rule matching.
 * For MCP tools, uses the fully qualified mcp__server__tool name so that
 * deny rules targeting builtins (e.g., "Write") don't match unprefixed MCP
 * replacements that share the same display name. Falls back to `tool.name`.
 */
export declare function getToolNameForPermissionCheck(tool: {
    name: string;
    mcpInfo?: {
        serverName: string;
        toolName: string;
    };
}): string;
export declare function getMcpDisplayName(fullName: string, serverName: string): string;
/**
 * Extracts just the tool/command display name from a userFacingName
 * @param userFacingName The full user-facing name (e.g., "github - Add comment to issue (MCP)")
 * @returns The display name without server prefix and (MCP) suffix
 */
export declare function extractMcpToolDisplayName(userFacingName: string): string;
//# sourceMappingURL=mcpStringUtils.d.ts.map