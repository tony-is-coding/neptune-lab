import { type Tools } from './Tool.js';
import type { ToolPermissionContext } from './Tool.js';
import type { ToolRegistry } from './ToolRegistry.js';
export { ALL_AGENT_DISALLOWED_TOOLS, CUSTOM_AGENT_DISALLOWED_TOOLS, ASYNC_AGENT_ALLOWED_TOOLS, COORDINATOR_MODE_ALLOWED_TOOLS, } from './constants/tools.js';
import { REPL_ONLY_TOOLS } from '@neptune/builtin-tools/tools/REPLTool/constants.js';
export { REPL_ONLY_TOOLS };
/**
 * Predefined tool presets that can be used with --tools flag
 */
export declare const TOOL_PRESETS: readonly ["default"];
export type ToolPreset = (typeof TOOL_PRESETS)[number];
export declare function parseToolPreset(preset: string): ToolPreset | null;
/**
 * Get the list of tool names for a given preset
 * Filters out tools that are disabled via isEnabled() check
 * @param preset The preset name
 * @returns Array of tool names
 */
export declare function getToolsForDefaultPreset(): string[];
/**
 * Get the complete exhaustive list of all tools that could be available
 * in the current environment (respecting process.env flags).
 * This is the source of truth for ALL tools.
 */
/**
 * NOTE: This MUST stay in sync with https://console.statsig.com/4aF3Ewatb6xPVpCwxb5nA3/dynamic_configs/claude_code_global_system_caching, in order to cache the system prompt across users.
 */
export declare function getAllBaseTools(): Tools;
/**
 * Filters out tools that are blanket-denied by the permission context.
 * A tool is filtered out if there's a deny rule matching its name with no
 * ruleContent (i.e., a blanket deny for that tool).
 *
 * Uses the same matcher as the runtime permission check (step 1a), so MCP
 * server-prefix rules like `mcp__server` strip all tools from that server
 * before the model sees them — not just at call time.
 */
export declare function filterToolsByDenyRules<T extends {
    name: string;
    mcpInfo?: {
        serverName: string;
        toolName: string;
    };
}>(tools: readonly T[], permissionContext: ToolPermissionContext): T[];
export declare const getTools: (permissionContext: ToolPermissionContext) => Tools;
/**
 * Assemble the full tool pool for a given permission context and MCP tools.
 *
 * This is the single source of truth for combining built-in tools with MCP tools.
 * Both REPL.tsx (via useMergedTools hook) and runAgent.ts (for coordinator workers)
 * use this function to ensure consistent tool pool assembly.
 *
 * The function:
 * 1. Gets built-in tools via getTools() (respects mode filtering)
 * 2. Filters MCP tools by deny rules
 * 3. Deduplicates by tool name (built-in tools take precedence)
 *
 * @param permissionContext - Permission context for filtering built-in tools
 * @param mcpTools - MCP tools from appState.mcp.tools
 * @returns Combined, deduplicated array of built-in and MCP tools
 */
export declare function assembleToolPool(permissionContext: ToolPermissionContext, mcpTools: Tools): Tools;
/**
 * Get all tools including both built-in tools and MCP tools.
 *
 * This is the preferred function when you need the complete tools list for:
 * - Tool search threshold calculations (isToolSearchEnabled)
 * - Token counting that includes MCP tools
 * - Any context where MCP tools should be considered
 *
 * Use getTools() only when you specifically need just built-in tools.
 *
 * @param permissionContext - Permission context for filtering built-in tools
 * @param mcpTools - MCP tools from appState.mcp.tools
 * @returns Combined array of built-in and MCP tools
 */
export declare function getMergedTools(permissionContext: ToolPermissionContext, mcpTools: Tools): Tools;
/**
 * 设置全局 ToolRegistry
 * @param registry 自定义 ToolRegistry 实例
 */
export declare function setGlobalToolRegistry(registry: ToolRegistry): void;
/**
 * 获取当前 ToolRegistry
 * @returns ToolRegistry 实例
 */
export declare function getToolRegistry(): ToolRegistry;
/**
 * 从 ToolRegistry 获取工具列表（替代直接导入）
 * @param permissionContext 权限上下文
 * @returns 工具列表
 */
export declare function getToolsFromRegistry(permissionContext: ToolPermissionContext): Tools;
/**
 * 创建 SDK 模式的 ToolRegistry
 * @returns ToolRegistry 实例（仅核心工具）
 */
export declare function createSDKToolRegistry(): ToolRegistry;
/**
 * 创建 CLI 模式的 ToolRegistry
 * @returns ToolRegistry 实例（所有工具）
 */
export declare function createCLIToolRegistry(): ToolRegistry;
//# sourceMappingURL=tools.d.ts.map