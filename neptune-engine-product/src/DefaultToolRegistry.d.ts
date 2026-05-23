/**
 * DefaultToolRegistry - 默认工具注册表实现
 *
 * 提供默认的工具注册和获取功能。
 * SDK 模式：只加载核心工具（~20个无条件工具）
 * CLI 模式：加载所有工具（55+工具）
 */
import type { ToolPermissionContext } from './Tool.js';
import type { Tool } from './Tool.js';
import type { ToolRegistry, ToolSet } from './ToolRegistry.js';
/**
 * DefaultToolRegistry 实现
 */
export declare class DefaultToolRegistry implements ToolRegistry {
    private options;
    private toolSets;
    private allToolsCache;
    constructor(options?: {
        mode: 'sdk' | 'cli';
    });
    registerToolSet(toolSet: ToolSet): void;
    getTools(permissionContext: ToolPermissionContext): Tool[];
    getToolByName(name: string): Tool | undefined;
    filterTools(filterFn: (tool: Tool) => boolean): Tool[];
    getCoreToolCount(): number;
    /**
     * 获取核心工具列表（SDK 必需）
     */
    private getCoreTools;
    /**
     * 获取条件工具列表（仅 CLI 模式）
     * 使用动态 require 按需加载
     */
    private getConditionalTools;
    private invalidateCache;
}
//# sourceMappingURL=DefaultToolRegistry.d.ts.map