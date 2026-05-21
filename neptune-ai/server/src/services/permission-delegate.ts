import type {PermissionDelegate} from '@neptune/engine/permissions';
import {isAbsolute, relative, resolve} from 'path';

/**
 * 租户配置
 */
export interface TenantConfig {
    tenantId: string;
    workspace: string;
    mcpServers: string[];
}

/**
 * Agent 模板配置
 */
export interface AgentTemplateConfig {
    tools: string[];
}

/**
 * 租户级权限委托
 *
 * 组合 SDK 的 PermissionDelegate 接口，为每个 Session 注入：
 * - 工具白名单（来自 AgentTemplate）
 * - 文件路径限制（限制在租户 workspace 内）
 * - MCP Server 白名单（只能访问租户注册的 MCP）
 *
 * 设计原则：永远不返回 'ask'（服务端无头模式）
 */
export class TenantPermissionDelegate implements PermissionDelegate {
    private allowedTools: Set<string>;
    private deniedTools: Set<string>;

    constructor(
        private tenantConfig: TenantConfig,
        private agentTemplate: AgentTemplateConfig,
    ) {
        // Agent 模板工具白名单
        this.allowedTools = new Set(agentTemplate.tools);

        // 明确禁用的工具
        this.deniedTools = new Set([
            'Bash',
            'EnterPlanMode',
            'ExitPlanMode',
            'EnterPlanModeV2',
        ]);
    }

    async onToolAccess(
        toolName: string,
        input: Record<string, unknown>,
    ): Promise<'allow' | 'deny'> {
        // 1. 禁用列表检查
        if (this.deniedTools.has(toolName)) {
            return 'deny';
        }

        // 2. MCP 调用：仅允许租户注册的 MCP Server
        if (toolName.startsWith('mcp__')) {
            // MCP 工具名格式: mcp__{serverName}__{toolName}
            const parts = toolName.split('__');
            if (parts.length >= 2) {
                const serverName = parts[1];
                return this.tenantConfig.mcpServers.includes(serverName) ? 'allow' : 'deny';
            }
            return 'deny';
        }

        // 3. 工具白名单检查（如果配置了白名单）
        if (this.allowedTools.size > 0 && !this.allowedTools.has(toolName)) {
            // 内部工具（Task 系列）自动放行
            if (!toolName.startsWith('Task')) {
                return 'deny';
            }
        }

        // 4. 文件操作：路径限制在租户 workspace 内
        if (this.isFileTool(toolName)) {
            const path = (input.file_path as string) || (input.path as string);
            if (path && !this.isWithinWorkspace(path)) {
                return 'deny';
            }
        }

        return 'allow';
        // 注意：永远不返回 'ask'——服务端无头模式
    }

    private isFileTool(toolName: string): boolean {
        return [
            'Read',
            'Edit',
            'Write',
            'MultiEdit',
            'FileRead',
            'FileEdit',
            'FileWrite',
            'Glob',
            'Grep',
        ].includes(toolName);
    }

    private isWithinWorkspace(filePath: string): boolean {
        const workspace = resolve(this.tenantConfig.workspace);
        const candidate = isAbsolute(filePath)
            ? resolve(filePath)
            : resolve(workspace, filePath);
        const rel = relative(workspace, candidate);
        return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
    }
}
