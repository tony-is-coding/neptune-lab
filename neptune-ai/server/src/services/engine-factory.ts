/**
 * ClaudeCodeEngineFactory — AgentEngine 的 EngineFactory 实现
 *
 * 职责：
 * - 创建 Engine 实例（配置 Provider、权限、可观测性）
 * - 创建 SDK Session（绑定 workspace）
 * - 将 Agent 配置注入 Engine 原生扩展点：
 *   - identityOverride → 替换 CC 身份前缀
 *   - skills → SkillExtension[] → Engine 写入 .claude/skills/
 *   - instructions → 写入 workspace/CLAUDE.md → CC 自动读取
 */

import {AgentEngine} from 'claude-code-best/engine';
import type {EngineFactory, QueryableEngine} from './thread-manager.js';
import {TenantPermissionDelegate} from './permission-delegate.js';
import {createLogger} from '../utils/logger.js';
import {getTracingProvider, getMetricsProvider} from './observability/index.js';
import {writeFileSync, mkdirSync, existsSync} from 'fs';
import {join} from 'path';

const log = createLogger('engine-factory');

/**
 * ClaudeCodeEngineFactory 配置
 */
export interface ClaudeCodeEngineFactoryConfig {
    apiKey: string;
    baseURL?: string;
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
        skills?: Array<{ name: string; description?: string; content: string }>;
        instructions?: string;
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

        // 1. 将 instructions 写入 workspace/CLAUDE.md（CC 自动发现并注入 prompt）
        if (params.instructions) {
            const claudeMdPath = join(params.workspace, 'CLAUDE.md');
            if (!existsSync(params.workspace)) {
                mkdirSync(params.workspace, {recursive: true});
            }
            writeFileSync(claudeMdPath, params.instructions, 'utf-8');
            log.debug('CLAUDE.md 已写入', {path: claudeMdPath, length: params.instructions.length});
        }

        // 2. 将 skills 转换为 Engine 的 SkillExtension 格式
        const skillExtensions = (params.skills || []).map(s => ({
            name: s.name,
            description: s.description || s.name,
            content: s.content,
        }));

        // 3. 创建权限委托
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
            // 4. 创建 Engine 实例
            const engine = AgentEngine.create({
                // identity: 精确替换 CC 身份前缀
                identityOverride: params.identityOverride,
                // memory: 用户级记忆隔离
                memoryRoot: params.memoryRoot,
                // observability
                tracingProvider: getTracingProvider(),
                metricsProvider: getMetricsProvider(),
                extensions: {
                    // skills: Engine 内部写入 .claude/skills/，CC 自动发现
                    skills: skillExtensions.length > 0 ? skillExtensions : undefined,
                    permissions: {
                        bypassPermissions: true,
                    },
                },
                options: {
                    maxTurns: 50,
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

            // 5. 创建 SDK Session
            const sdkSessionId = await engine.createSession({
                workspace: params.workspace,
            });

            const durationMs = Math.round(performance.now() - startTime);
            log.info('Engine 创建完成', {tenantId: params.tenantId, sdkSessionId, durationMs});

            return {
                engine: engine as unknown as QueryableEngine,
                sdkSessionId,
            };
        } catch (error) {
            const durationMs = Math.round(performance.now() - startTime);
            log.error('Engine creation failed', {
                tenantId: params.tenantId,
                durationMs,
                detail: (error as Error).message,
            });
            throw error;
        }
    }
}
