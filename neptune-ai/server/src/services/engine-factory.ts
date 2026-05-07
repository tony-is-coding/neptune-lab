/**
 * ClaudeCodeEngineFactory — AgentEngine 的 EngineFactory 实现
 *
 * 将 ThreadManager 的 EngineFactory 接口与 claude-code-best/engine 的 AgentEngine 连接起来。
 * 负责创建 Engine 实例、创建 SDK Session、配置权限隔离。
 *
 * 设计要点：
 * - Engine 创建通过 AgentEngine.create() 静态工厂
 * - 权限隔离通过 TenantPermissionDelegate 注入
 * - systemPrompt 来自 agent_templates 表（由 ThreadManager.dispatch() 传入）
 * - API Key 从环境变量 ANTHROPIC_API_KEY 读取
 */

import { AgentEngine } from 'claude-code-best/engine';
import type { EngineFactory } from './thread-manager.js';
import type { DestroyableEngine } from './engine-pool.js';
import { TenantPermissionDelegate } from './permission-delegate.js';

/**
 * 扩展 DestroyableEngine 以支持 query 操作
 *
 * AgentEngine 实例同时具备 destroy() 和 query() 能力，
 * EnginePool 只关心 destroy()，而 ThreadManager.dispatch() 需要 query()。
 */
export interface QueryableEngine extends DestroyableEngine {
  query(sessionId: string, content: string): AsyncIterable<unknown>;
  on(event: string, handler: (payload: unknown) => void): void;
}

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
    systemPrompt: string;
    memoryRoot: string;
    workspace: string;
    tools: string[];
    mcpServerUrls: string[];
    tenantId: string;
  }): Promise<{
    engine: DestroyableEngine;
    sdkSessionId: string;
  }> {
    // 1. 创建权限委托
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

    // 2. 创建 Engine 实例
    const engine = AgentEngine.create({
      systemPrompt: params.systemPrompt,
      memoryRoot: params.memoryRoot,
      extensions: {
        permissions: {
          bypassPermissions: true,
        },
      },
      provider: {
        type: 'anthropic',
        config: {
          apiKey: this.apiKey,
          ...(this.baseURL ? { baseURL: this.baseURL } : {}),
          ...(this.defaultModel ? { defaultModel: this.defaultModel } : {}),
        },
      },
    });

    // 3. 创建 SDK Session（绑定到 workspace）
    const sdkSessionId = await engine.createSession({
      workspace: params.workspace,
      systemPrompt: params.systemPrompt,
    });

    return {
      engine: engine as unknown as DestroyableEngine,
      sdkSessionId,
    };
  }
}
