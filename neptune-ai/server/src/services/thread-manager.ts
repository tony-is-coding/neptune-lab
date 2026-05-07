/**
 * ThreadManager — Thread 生命周期管理服务
 *
 * 基于 EnginePool 管理 Thread 的 CRUD 和 Engine 调度。
 * 核心设计：
 * - Engine 在 Thread 粒度复用（不像 QueryDispatcher 每次 query 创建/销毁）
 * - 通过 EnginePool 管理并发和 LRU 淘汰
 * - Engine 创建通过工厂函数注入，便于测试 mock
 */

import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { db } from '../db/index.js';
import { agentTemplates, sessions as sessionsTable } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { EnginePool, type DestroyableEngine, type EngineEntry } from './engine-pool.js';

/**
 * Thread 类型 — 基于 sessions 表
 */
export interface Thread {
  id: string;
  tenantId: string;
  userId: string;
  templateId: string | null;
  status: string;
  title: string | null;
  summary: string | null;
  workspace: string;
  lastActiveAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Thread 列表查询结果
 */
export interface ThreadListResult {
  data: Thread[];
  meta: {
    count: number;
    limit: number;
    offset: number;
  };
}

/**
 * Engine 工厂接口 — 用于解耦 AgentEngine 依赖
 */
export interface EngineFactory {
  createAndLoad(params: {
    systemPrompt: string;
    memoryRoot: string;
    workspace: string;
    tools: string[];
    mcpServerUrls: string[];
    tenantId: string;
  }): Promise<{
    engine: DestroyableEngine;
    sdkSessionId: string;
  }>;
}

/**
 * Query Usage 结果
 */
export interface QueryUsageResult {
  sessionId: string;
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    costUSD: number;
  }>;
}

/**
 * 默认并发限制
 */
const DEFAULT_MAX_CONCURRENT = 10;

/**
 * 默认 workspace 基础路径
 */
const DEFAULT_DATA_ROOT = '/data';

/**
 * ThreadManager 配置
 */
export interface ThreadManagerConfig {
  maxConcurrent?: number;
  engineFactory?: EngineFactory;
  dataRoot?: string;
}

/**
 * ThreadManager — Thread 生命周期管理
 */
export class ThreadManager {
  private pool: EnginePool;
  private engineFactory: EngineFactory | undefined;
  private lastUsage: QueryUsageResult | null = null;
  private dataRoot: string;

  constructor(config?: ThreadManagerConfig) {
    this.pool = new EnginePool({
      maxConcurrent: config?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
    });
    this.engineFactory = config?.engineFactory;
    this.dataRoot = config?.dataRoot ?? DEFAULT_DATA_ROOT;
  }

  // ===== CRUD 方法 =====

  /**
   * 创建 Thread
   */
  async create(params: {
    tenantId: string;
    userId: string;
    agentId: string;
    title?: string;
  }): Promise<Thread> {
    const threadId = randomUUID();
    const workspace = `${this.dataRoot}/tenants/${params.tenantId}/agents/${params.agentId}/users/${params.userId}/threads/${threadId}/`;

    // 创建 workspace 目录
    if (!existsSync(workspace)) {
      mkdirSync(workspace, { recursive: true });
    }

    const [thread] = await db
      .insert(sessionsTable)
      .values({
        id: threadId,
        tenantId: params.tenantId,
        userId: params.userId,
        templateId: params.agentId,
        status: 'idle',
        title: params.title ?? null,
        summary: null,
        workspace,
      })
      .returning();

    return this.mapToThread(thread);
  }

  /**
   * 列出 Thread
   */
  async list(
    agentId: string,
    userId: string,
    filters?: {
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<ThreadListResult> {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const conditions = [
      eq(sessionsTable.templateId, agentId),
      eq(sessionsTable.userId, userId),
    ];

    if (filters?.status) {
      conditions.push(eq(sessionsTable.status, filters.status));
    }

    // 查询总数
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionsTable)
      .where(and(...conditions));

    const count = countResult[0]?.count ?? 0;

    // 查询数据
    const results = await db
      .select()
      .from(sessionsTable)
      .where(and(...conditions))
      .orderBy(desc(sessionsTable.lastActiveAt))
      .limit(limit)
      .offset(offset);

    return {
      data: results.map(r => this.mapToThread(r)),
      meta: { count, limit, offset },
    };
  }

  /**
   * 列出用户最近的 Thread（跨所有 Agent）
   * 用于 Collaborate 首页的"最近协作记录"视图
   */
  async listRecentThreads(
    userId: string,
    tenantId: string,
    limit = 10,
  ): Promise<Array<{
    id: string;
    tenantId: string;
    userId: string;
    templateId: string | null;
    status: string;
    title: string | null;
    summary: string | null;
    workspace: string;
    lastActiveAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    agentName: string | null;
    agentIcon: string | null;
  }>> {
    // 查询用户最近的 Thread，包含 Agent 信息
    const results = await db
      .select({
        id: sessionsTable.id,
        tenantId: sessionsTable.tenantId,
        userId: sessionsTable.userId,
        templateId: sessionsTable.templateId,
        status: sessionsTable.status,
        title: sessionsTable.title,
        summary: sessionsTable.summary,
        workspace: sessionsTable.workspace,
        lastActiveAt: sessionsTable.lastActiveAt,
        createdAt: sessionsTable.createdAt,
        updatedAt: sessionsTable.updatedAt,
        agentName: agentTemplates.name,
        agentIcon: agentTemplates.icon,
      })
      .from(sessionsTable)
      .leftJoin(agentTemplates, eq(sessionsTable.templateId, agentTemplates.id))
      .where(
        and(
          eq(sessionsTable.userId, userId),
          eq(sessionsTable.tenantId, tenantId),
        ),
      )
      .orderBy(desc(sessionsTable.lastActiveAt))
      .limit(limit);

    return results.map(r => ({
      id: r.id,
      tenantId: r.tenantId,
      userId: r.userId,
      templateId: r.templateId,
      status: r.status,
      title: r.title,
      summary: r.summary,
      workspace: r.workspace,
      lastActiveAt: r.lastActiveAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      agentName: r.agentName ?? null,
      agentIcon: r.agentIcon ?? null,
    }));
  }

  /**
   * 获取单个 Thread
   */
  async get(threadId: string): Promise<Thread | null> {
    const [row] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, threadId))
      .limit(1);

    return row ? this.mapToThread(row) : null;
  }

  /**
   * 更新 Thread
   */
  async update(
    threadId: string,
    data: {
      title?: string;
      summary?: string;
      status?: string;
    },
  ): Promise<Thread | null> {
    const [updated] = await db
      .update(sessionsTable)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(sessionsTable.id, threadId))
      .returning();

    return updated ? this.mapToThread(updated) : null;
  }

  /**
   * 删除 Thread
   */
  async delete(threadId: string): Promise<boolean> {
    // 先释放 pool 中的 engine（如果存在）
    if (this.pool.has(threadId)) {
      await this.pool.release(threadId);
    }

    const result = await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.id, threadId))
      .returning();

    return result.length > 0;
  }

  // ===== Dispatch 方法 =====

  /**
   * 向 Thread 发送消息 — 核心方法
   *
   * 流程：
   * 1. 获取 Thread，验证状态
   * 2. 更新状态为 running
   * 3. 获取 Agent 模板
   * 4. 从 pool 获取或创建 Engine
   * 5. 执行 query 并 yield 事件
   * 6. 完成后更新状态为 idle
   */
  async *dispatch(
    threadId: string,
    content: string,
  ): AsyncGenerator<unknown> {
    const thread = await this.get(threadId);
    if (!thread) {
      throw new Error(`Thread 不存在: ${threadId}`);
    }

    // 验证状态
    if (thread.status === 'running') {
      throw new Error(`Thread 正在执行中: ${threadId}`);
    }
    // error 状态允许重试（engine 可能因 server 重启丢失）

    // 如果没有 engineFactory，无法执行 dispatch（测试环境下可能没有）
    if (!this.engineFactory) {
      throw new Error('Engine factory 未配置');
    }

    // 更新状态为 running
    await this.update(threadId, {
      status: 'running',
      summary: content.substring(0, 100),
    });

    try {
      // 获取 Agent 模板
      const agentId = thread.templateId;
      if (!agentId) {
        throw new Error('Thread 没有关联的 Agent 模板');
      }

      const [template] = await db
        .select()
        .from(agentTemplates)
        .where(eq(agentTemplates.id, agentId))
        .limit(1);

      if (!template) {
        throw new Error(`Agent 模板不存在: ${agentId}`);
      }

      // 从 pool 获取或创建 Engine
      const entry = this.pool.get(threadId);
      let engine: DestroyableEngine;
      let sdkSessionId: string;

      if (!entry) {
        // 检查池是否已满，需要淘汰
        if (this.pool.isAtCapacity()) {
          const evictableId = this.pool.getEvictable();
          if (evictableId) {
            await this.pool.release(evictableId);
            // 被淘汰的 thread 状态改为 idle
            await this.update(evictableId, { status: 'idle' }).catch(() => {});
          }
        }

        // 创建新 Engine
        const mcpServerUrls = (template.mcpServers as Array<{ name: string; url: string }> || []).map(s => s.url);
        const result = await this.engineFactory!.createAndLoad({
          systemPrompt: template.systemPrompt,
          memoryRoot: `${this.dataRoot}/tenants/${thread.tenantId}/agents/${agentId}`,
          workspace: thread.workspace,
          tools: (template.tools as string[]) || [],
          mcpServerUrls,
          tenantId: thread.tenantId,
        });

        engine = result.engine;
        sdkSessionId = result.sdkSessionId;
        this.pool.register(threadId, engine, sdkSessionId);
      } else {
        // 已有 engine，使用存储的 sdkSessionId
        engine = entry.engine;
        sdkSessionId = entry.sdkSessionId;
      }

      // 执行 query（通过 engine 的通用接口）
      const queryable = engine as any;
      if (typeof queryable.query !== 'function') {
        throw new Error('Engine 不支持 query 操作');
      }

      // 监听 query:complete 收集 usage
      if (typeof queryable.on === 'function') {
        queryable.on('query:complete', (payload: unknown) => {
          this.lastUsage = payload as QueryUsageResult;
        });
      }

      // 创建 PlanManager（每次 dispatch 新建）
      const { PlanManager } = await import('./plan/PlanManager.js');
      const planManager = new PlanManager(threadId);

      for await (const event of queryable.query(sdkSessionId, content)) {
        // 通过 PlanManager 处理 Plan 相关事件
        const planEvents = planManager.processSDKEvent(event as Record<string, unknown>);
        for (const planEvent of planEvents) {
          yield planEvent;
        }

        // 原有事件继续 yield
        yield event;
      }

      // 更新状态为 idle
      await this.update(threadId, {
        status: 'idle',
      });
    } catch (error) {
      // 出错时更新状态为 error
      await this.update(threadId, { status: 'error' }).catch(() => {});
      throw error;
    }
  }

  /**
   * 向 Agent 发送消息 — 自动查找或创建 Thread
   */
  async *dispatchToAgent(
    tenantId: string,
    userId: string,
    agentId: string,
    content: string,
  ): AsyncGenerator<unknown> {
    // 查找最新的 idle thread
    const threads = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.templateId, agentId),
          eq(sessionsTable.userId, userId),
          eq(sessionsTable.tenantId, tenantId),
          eq(sessionsTable.status, 'idle'),
        ),
      )
      .orderBy(desc(sessionsTable.lastActiveAt))
      .limit(1);

    let threadId: string;

    if (threads.length > 0) {
      threadId = threads[0].id;
    } else {
      // 创建新 thread
      const newThread = await this.create({
        tenantId,
        userId,
        agentId,
      });
      threadId = newThread.id;
    }

    yield* this.dispatch(threadId, content);
  }

  // ===== 兼容方法 =====

  /**
   * 获取最后一次 Query 的 Usage
   */
  getLastUsage(): QueryUsageResult | null {
    return this.lastUsage;
  }

  /**
   * 获取 Thread 的 workspace 路径
   */
  async getWorkspace(threadId: string): Promise<string | null> {
    const thread = await this.get(threadId);
    return thread?.workspace ?? null;
  }

  /**
   * 获取 pool 中的 Engine entry（测试专用）
   *
   * 仅用于测试验证 pool 内部状态，生产环境不应依赖此方法。
   */
  getPoolEntry(threadId: string): { engine: DestroyableEngine; sdkSessionId: string } | undefined {
    return this.pool.get(threadId);
  }

  /**
   * 基于过滤器查询 Thread — 兼容旧接口
   */
  async listByFilters(filters: {
    tenantId?: string;
    userId?: string;
    agentId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ThreadListResult> {
    const conditions = [];

    if (filters.tenantId) {
      conditions.push(eq(sessionsTable.tenantId, filters.tenantId));
    }
    if (filters.userId) {
      conditions.push(eq(sessionsTable.userId, filters.userId));
    }
    if (filters.agentId) {
      conditions.push(eq(sessionsTable.templateId, filters.agentId));
    }
    if (filters.status) {
      conditions.push(eq(sessionsTable.status, filters.status));
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    // 查询总数
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const count = countResult[0]?.count ?? 0;

    // 查询数据
    const results = await db
      .select()
      .from(sessionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sessionsTable.lastActiveAt))
      .limit(limit)
      .offset(offset);

    return {
      data: results.map(r => this.mapToThread(r)),
      meta: { count, limit, offset },
    };
  }

  // ===== 内部方法 =====

  /**
   * 映射数据库行到 Thread 类型
   */
  private mapToThread(row: any): Thread {
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      templateId: row.templateId,
      status: row.status,
      title: row.title,
      summary: row.summary,
      workspace: row.workspace,
      lastActiveAt: row.lastActiveAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

/**
 * 单例实例（延迟初始化）
 * dataRoot 可通过 DATA_ROOT 环境变量覆盖（测试环境使用）
 * engineFactory 仅在 ANTHROPIC_API_KEY 存在时注入（测试环境不需要）
 */
let _threadManager: ThreadManager | null = null;

export function getThreadManager(): ThreadManager {
  if (!_threadManager) {
    // 仅在 ANTHROPIC_API_KEY 存在时注入 EngineFactory
    // 测试环境不需要真实 Engine，dispatch() 会因缺少 factory 而抛错
    let engineFactory: EngineFactory | undefined;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      // 动态 import 避免测试环境加载 claude-code-best/engine 模块
      try {
        const { ClaudeCodeEngineFactory } = require('./engine-factory.js') as typeof import('./engine-factory.js');
        engineFactory = new ClaudeCodeEngineFactory({
          apiKey,
          baseURL: process.env.ANTHROPIC_BASE_URL,
          defaultModel: process.env.ANTHROPIC_MODEL,
        });
      } catch {
        console.warn('EngineFactory 加载失败，dispatch 功能不可用');
      }
    }

    _threadManager = new ThreadManager({
      dataRoot: resolve(process.env.DATA_ROOT || DEFAULT_DATA_ROOT),
      engineFactory,
    });
  }
  return _threadManager;
}

/**
 * 重置单例（仅用于测试）
 */
export function resetThreadManager(): void {
  _threadManager = null;
}

/**
 * 便捷导出 — 使用 getter 确保延迟初始化
 */
export const threadManager = new Proxy({} as ThreadManager, {
  get(_, prop) {
    return (getThreadManager() as any)[prop];
  },
});
