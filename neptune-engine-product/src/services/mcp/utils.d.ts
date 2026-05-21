import type { Command } from '../../commands.js';
import type { AgentMcpServerInfo } from '../../types/mcpTypes.js';
import type { Tool } from '../../Tool.js';
import type { AgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import { type ConfigScope, type MCPServerConnection, type McpServerConfig, type ScopedMcpServerConfig, type ServerResource } from './types.js';
/**
 * Filters tools by MCP server name
 *
 * @param tools Array of tools to filter
 * @param serverName Name of the MCP server
 * @returns Tools belonging to the specified server
 */
export declare function filterToolsByServer(tools: Tool[], serverName: string): Tool[];
/**
 * True when a command belongs to the given MCP server.
 *
 * MCP **prompts** are named `mcp__<server>__<prompt>` (wire-format constraint);
 * MCP **skills** are named `<server>:<skill>` (matching plugin/nested-dir skill
 * naming). Both live in `mcp.commands`, so cleanup and filtering must match
 * either shape.
 */
export declare function commandBelongsToServer(command: Command, serverName: string): boolean;
/**
 * Filters commands by MCP server name
 * @param commands Array of commands to filter
 * @param serverName Name of the MCP server
 * @returns Commands belonging to the specified server
 */
export declare function filterCommandsByServer(commands: Command[], serverName: string): Command[];
/**
 * Filters MCP **prompts** (not skills) by server. Used by the `/mcp` menu
 * capabilities display — skills are a separate feature shown in `/skills`,
 * so they mustn't inflate the "prompts" capability badge.
 *
 * The distinguisher is `loadedFrom === 'mcp'`: MCP skills set it, MCP
 * prompts don't (they use `isMcp: true` instead).
 */
export declare function filterMcpPromptsByServer(commands: Command[], serverName: string): Command[];
/**
 * Filters resources by MCP server name
 * @param resources Array of resources to filter
 * @param serverName Name of the MCP server
 * @returns Resources belonging to the specified server
 */
export declare function filterResourcesByServer(resources: ServerResource[], serverName: string): ServerResource[];
/**
 * Removes tools belonging to a specific MCP server
 * @param tools Array of tools
 * @param serverName Name of the MCP server to exclude
 * @returns Tools not belonging to the specified server
 */
export declare function excludeToolsByServer(tools: Tool[], serverName: string): Tool[];
/**
 * Removes commands belonging to a specific MCP server
 * @param commands Array of commands
 * @param serverName Name of the MCP server to exclude
 * @returns Commands not belonging to the specified server
 */
export declare function excludeCommandsByServer(commands: Command[], serverName: string): Command[];
/**
 * Removes resources belonging to a specific MCP server
 * @param resources Map of server resources
 * @param serverName Name of the MCP server to exclude
 * @returns Resources map without the specified server
 */
export declare function excludeResourcesByServer(resources: Record<string, ServerResource[]>, serverName: string): Record<string, ServerResource[]>;
/**
 * Stable hash of an MCP server config for change detection on /reload-plugins.
 * Excludes `scope` (provenance, not content — moving a server from .mcp.json
 * to settings.json shouldn't reconnect it). Keys sorted so `{a:1,b:2}` and
 * `{b:2,a:1}` hash the same.
 */
export declare function hashMcpConfig(config: ScopedMcpServerConfig): string;
/**
 * Remove stale MCP clients and their tools/commands/resources. A client is
 * stale if:
 *   - scope 'dynamic' and name no longer in configs (plugin disabled), or
 *   - config hash changed (args/url/env edited in .mcp.json) — any scope
 *
 * The removal case is scoped to 'dynamic' so /reload-plugins can't
 * accidentally disconnect a user-configured server that's just temporarily
 * absent from the in-memory config (e.g. during a partial reload). The
 * config-changed case applies to all scopes — if the config actually changed
 * on disk, reconnecting is what you want.
 *
 * Returns the stale clients so the caller can disconnect them (clearServerCache).
 */
export declare function excludeStalePluginClients(mcp: {
    clients: MCPServerConnection[];
    tools: Tool[];
    commands: Command[];
    resources: Record<string, ServerResource[]>;
}, configs: Record<string, ScopedMcpServerConfig>): {
    clients: MCPServerConnection[];
    tools: Tool[];
    commands: Command[];
    resources: Record<string, ServerResource[]>;
    stale: MCPServerConnection[];
};
/**
 * Checks if a tool name belongs to a specific MCP server
 * @param toolName The tool name to check
 * @param serverName The server name to match against
 * @returns True if the tool belongs to the specified server
 */
export declare function isToolFromMcpServer(toolName: string, serverName: string): boolean;
/**
 * Checks if a tool belongs to any MCP server
 * @param tool The tool to check
 * @returns True if the tool is from an MCP server
 */
export declare function isMcpTool(tool: Tool): boolean;
/**
 * Checks if a command belongs to any MCP server
 * @param command The command to check
 * @returns True if the command is from an MCP server
 */
export declare function isMcpCommand(command: Command): boolean;
/**
 * Describe the file path for a given MCP config scope.
 * @param scope The config scope ('user', 'project', 'local', or 'dynamic')
 * @returns A description of where the config is stored
 */
export declare function describeMcpConfigFilePath(scope: ConfigScope): string;
export declare function getScopeLabel(scope: ConfigScope): string;
export declare function ensureConfigScope(scope?: string): ConfigScope;
export declare function ensureTransport(type?: string): 'stdio' | 'sse' | 'http';
export declare function parseHeaders(headerArray: string[]): Record<string, string>;
export declare function getProjectMcpServerStatus(serverName: string): 'approved' | 'rejected' | 'pending';
/**
 * Get the scope/settings source for an MCP server from a tool name
 * @param toolName MCP tool name (format: mcp__serverName__toolName)
 * @returns ConfigScope or null if not an MCP tool or server not found
 */
export declare function getMcpServerScopeFromToolName(toolName: string): ConfigScope | null;
/**
 * Extracts MCP server definitions from agent frontmatter and groups them by server name.
 * This is used to show agent-specific MCP servers in the /mcp command.
 *
 * @param agents Array of agent definitions
 * @returns Array of AgentMcpServerInfo, grouped by server name with list of source agents
 */
export declare function extractAgentMcpServers(agents: AgentDefinition[]): AgentMcpServerInfo[];
/**
 * Extracts the MCP server base URL (without query string) for analytics logging.
 * Query strings are stripped because they can contain access tokens.
 * Trailing slashes are also removed for normalization.
 * Returns undefined for stdio/sdk servers or if URL parsing fails.
 */
export declare function getLoggingSafeMcpBaseUrl(config: McpServerConfig): string | undefined;
//# sourceMappingURL=utils.d.ts.map