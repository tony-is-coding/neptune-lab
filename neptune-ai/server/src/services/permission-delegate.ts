import type {PermissionDelegate} from '@neptune/engine/permissions';
import {isAbsolute, relative, resolve} from 'path';
import type {PolicyDecisionRecorder, PolicyDecisionDenyInput} from './policy-decision';
import type {PolicyType, PolicySubjectType} from '@shared/neptune-ai';
import {createLogger} from '../utils/logger';

const log = createLogger('permission-delegate');

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
 * 治理事件上下文：让 permission-delegate 写入 PolicyDecision 时携带 runId/requestId 关联，
 * 这样治理台运行详情能看到这次 Run 中所有被拒的工具/MCP/路径决策。
 *
 * permission-delegate 是 Engine 进程内同步回调，不能从中拿到 runId（dispatch 启动后才有）。
 * 因此 engine-factory 在创建 delegate 时显式注入。
 */
export interface PermissionDelegateGovernanceContext {
    runId?: string | null;
    requestId?: string;
    /** 注入 PolicyDecision 写入入口；缺省时不写入（用于测试） */
    recorder?: PolicyDecisionRecorder;
}

/**
 * 租户级权限委托
 *
 * 组合 SDK 的 PermissionDelegate 接口，为每个 Session 注入：
 * - 工具白名单（来自 AgentTemplate）
 * - 文件路径限制（限制在租户 workspace 内）
 * - MCP Server 白名单（只能访问租户注册的 MCP）
 *
 * 设计原则：
 * - 永远不返回 'ask'（服务端无头模式）
 * - 每次 'deny' 必须写 PolicyDecision（治理事实），否则审计无法追溯
 * - PolicyDecision 写入是 fire-and-forget：不阻塞 deny 决策返回
 */
export class TenantPermissionDelegate implements PermissionDelegate {
    private allowedTools: Set<string>;
    private deniedTools: Set<string>;
    private governance: PermissionDelegateGovernanceContext;

    constructor(
        private tenantConfig: TenantConfig,
        private agentTemplate: AgentTemplateConfig,
        governance: PermissionDelegateGovernanceContext = {},
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

        this.governance = governance;
    }

    async onToolAccess(
        toolName: string,
        input: Record<string, unknown>,
    ): Promise<'allow' | 'deny'> {
        // 1. 禁用列表检查
        if (this.deniedTools.has(toolName)) {
            this.recordDeny({
                policyType: 'tool',
                subjectType: 'tool',
                subjectId: toolName,
                reason: '工具在租户级全局禁用列表',
                details: {
                    rule: 'global_denied_tools',
                    deniedTools: Array.from(this.deniedTools),
                },
            });
            return 'deny';
        }

        // 2. MCP 调用：仅允许租户注册的 MCP Server
        if (toolName.startsWith('mcp__')) {
            // MCP 工具名格式: mcp__{serverName}__{toolName}
            const parts = toolName.split('__');
            if (parts.length >= 2) {
                const serverName = parts[1];
                if (!this.tenantConfig.mcpServers.includes(serverName)) {
                    this.recordDeny({
                        policyType: 'mcp_server',
                        subjectType: 'mcp_server',
                        subjectId: serverName,
                        reason: '该 MCP server 不在租户白名单',
                        details: {
                            rule: 'tenant_mcp_whitelist',
                            toolName,
                            allowedServers: this.tenantConfig.mcpServers,
                        },
                    });
                    return 'deny';
                }
                return 'allow';
            }
            this.recordDeny({
                policyType: 'mcp_server',
                subjectType: 'mcp_server',
                subjectId: toolName,
                reason: 'MCP 工具名格式不合法',
                details: {rule: 'mcp_naming_invalid', toolName},
            });
            return 'deny';
        }

        // 3. 工具白名单检查（如果配置了白名单）
        if (this.allowedTools.size > 0 && !this.allowedTools.has(toolName)) {
            // 内部工具（Task 系列）自动放行
            if (!toolName.startsWith('Task')) {
                this.recordDeny({
                    policyType: 'tool',
                    subjectType: 'tool',
                    subjectId: toolName,
                    reason: '工具不在 Agent 模板白名单',
                    details: {
                        rule: 'agent_template_tools_whitelist',
                        allowedTools: Array.from(this.allowedTools),
                    },
                });
                return 'deny';
            }
        }

        // 4. 文件操作：路径限制在租户 workspace 内
        if (this.isFileTool(toolName)) {
            const path = (input.file_path as string) || (input.path as string);
            if (path && !this.isWithinWorkspace(path)) {
                this.recordDeny({
                    policyType: 'file_path',
                    subjectType: 'file_path',
                    subjectId: path,
                    reason: '文件路径越界于租户工作区',
                    details: {
                        rule: 'tenant_workspace_path_boundary',
                        toolName,
                        workspace: this.tenantConfig.workspace,
                    },
                });
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

    /**
     * Fire-and-forget 写 PolicyDecision。不阻塞决策返回；写入失败只打 warn。
     * 测试模式（无 recorder）下退化为 no-op。
     */
    private recordDeny(payload: {
        policyType: PolicyType;
        subjectType: PolicySubjectType;
        subjectId: string;
        reason: string;
        details?: Record<string, unknown>;
    }): void {
        const recorder = this.governance.recorder;
        if (!recorder) return;
        const input: PolicyDecisionDenyInput = {
            tenantId: this.tenantConfig.tenantId,
            runId: this.governance.runId ?? null,
            requestId: this.governance.requestId,
            policyType: payload.policyType,
            subjectType: payload.subjectType,
            subjectId: payload.subjectId,
            reason: payload.reason,
            details: payload.details,
        };
        // 不 await：deny 决策必须立即返回；写入失败也不能阻塞 LLM 流程
        recorder.recordDeny(input).catch(error => {
            log.warn('PolicyDecision deny record failed', {
                tenantId: input.tenantId,
                runId: input.runId,
                policyType: input.policyType,
                subjectId: input.subjectId,
                detail: (error as Error).message,
            });
        });
    }
}
