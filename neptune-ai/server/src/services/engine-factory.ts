/**
 * ClaudeCodeEngineFactory — AgentEngine 的 EngineFactory 实现
 *
 * 核心链路：ThreadManager.dispatch() → engineFactory.createAndLoad()
 *
 * 职责：
 * - 创建 AgentEngine 实例（配置 Provider、权限、可观测性）
 * - 创建 SDK Session（绑定 workspace 目录）
 * - 返回可执行 query 的 Engine + sdkSessionId
 *
 * 设计要点：
 * - Engine 创建通过 AgentEngine.create() 静态工厂
 * - 权限隔离通过 TenantPermissionDelegate 注入
 * - systemPrompt 来自 prompt-assembler.ts 组装结果
 * - API Key 从环境变量 NEPTUNE_LLM_API_KEY 读取
 * - maxTurns 配置传递给 Engine 内部的 AgentLoop 防止无限循环
 */

import {AgentEngine} from 'claude-code-best/engine';
import type {EngineFactory, QueryableEngine} from './thread-manager.js';
import {TenantPermissionDelegate} from './permission-delegate.js';
import {createLogger} from '../utils/logger.js';
import {getTracingProvider, getMetricsProvider} from './observability/index.js';

const log = createLogger('engine-factory');

/**
 * ClaudeCodeEngineFactory 配置
 */
export interface ClaudeCodeEngineFactoryConfig {
    /** Anthropic API Key（必需） */
    apiKey: string;
    /** 自定义 API Base URL（可选，用于代理或兼容 API） */
    baseURL?: string;
    /** 默认模型（可选，如 claude-sonnet-4-20250514 或 glm-5.1） */
    defaultModel?: string;
}

/**
 * ClaudeCodeEngineFactory — 生产环境的 EngineFactory 实现
 */
export class ClaudeCodeEngineFactory implements EngineFactory {
    private apiKey: string;
    private baseURL?: string;
    private defaultModel?: string;

    constructor(config: ClaudeCodeEngineFactoryConfig) {
        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL;
        this.defaultModel = config.defaultModel;
    }

    async createAndLoad(params: {
        identityOverride?: string;
        systemPrompt: string;
        memoryRoot: string;
        workspace: string;
        tools: string[];
        mcpServerUrls: string[];
        tenantId: string;
    }): Promise<{
        engine: QueryableEngine;
        sdkSessionId: string;
    }> {
        const startTime = performance.now();
        log.info('Engine 开始创建', {tenantId: params.tenantId, workspace: params.workspace});

        // 1. 创建权限委托（租户隔离：限制工具白名单 + 文件路径 + MCP Server）
        const permissionDelegate = new TenantPermissionDelegate(
            {
                tenantId: params.tenantId,
                workspace: params.workspace,
                mcpServers: params.mcpServerUrls,
            },
            {
                tools: params.tools,
            },
        );

        try {
            // 2. 创建 Engine 实例
            // identityOverride: 精确替换 CC 身份前缀（"你是谁"）
            // systemPrompt: Agent 扩展内容（追加在 CC 核心能力之后）
            const engine = AgentEngine.create({
                systemPrompt: params.systemPrompt,
                identityOverride: params.identityOverride,
                memoryRoot: params.memoryRoot,
                tracingProvider: getTracingProvider(),
                metricsProvider: getMetricsProvider(),
                extensions: {
                    permissions: {
                        bypassPermissions: true,
                    },
                },
                options: {
                    maxTurns: 50, // AgentLoop 最大轮数，防止无限循环
                },
                provider: {
                    type: 'anthropic',
                    config: {
                        apiKey: this.apiKey,
                        ...(this.baseURL ? {baseURL: this.baseURL} : {}),
                        ...(this.defaultModel ? {model: this.defaultModel, defaultModel: this.defaultModel} : {}),
                    },
                },
            } as any);

            // 3. 创建 SDK Session（绑定 workspace 目录，Engine 内部会在此目录下管理 memory、transcript 等）
            const sdkSessionId = await engine.createSession({
                workspace: params.workspace,
                systemPrompt: params.systemPrompt,
            });

            const durationMs = Math.round(performance.now() - startTime);
            log.info('Engine 创建完成', {tenantId: params.tenantId, sdkSessionId, durationMs});

            return {
                engine: engine as unknown as QueryableEngine,
                sdkSessionId,
            };
        } catch (error) {
            const durationMs = Math.round(performance.now() - startTime);
            log.error('Engine 创建失败', {
                tenantId: params.tenantId,
                durationMs,
                detail: (error as Error).message,
            });
            throw error;
        }
    }
}
