import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AgentEngine, type QueryEvent } from 'claude-code-best/engine';
import { TenantPermissionDelegate } from './permission-delegate.js';
import { db } from '../db/index.js';
import { agentTemplates, sessions as sessionsTable } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

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
 * Query 调度参数
 */
export interface DispatchParams {
  tenantId: string;
  userId: string;
  agentId: string; // templateId
  content: string;
}

/**
 * QueryDispatcher — 每 Query 创建/销毁 Engine 的调度器
 *
 * 核心设计原则：
 * - 无状态：不保持 Engine 实例，每次 dispatch 创建新的 Engine
 * - 按需创建：Query 开始时创建 Engine，结束时销毁
 * - 流式输出：dispatch() 返回 AsyncGenerator，支持 SSE
 * - Session 隔离：每个用户+Agent 组合有独立的 workspace
 */
export class QueryDispatcher {
  private usageResult: QueryUsageResult | null = null;

  /**
   * 核心方法：调度 Query 执行
   *
   * 为每次 Query 创建独立的 Engine 实例，执行完成后销毁。
   * 返回 AsyncGenerator 支持流式输出。
   *
   * @param params 调度参数
   * @returns AsyncGenerator<QueryEvent> 流式查询事件
   */
  async *dispatch(params: DispatchParams): AsyncGenerator<QueryEvent> {
    // 1. 查 agent_templates
    const [template] = await db
      .select()
      .from(agentTemplates)
      .where(eq(agentTemplates.id, params.agentId))
      .limit(1);

    if (!template) {
      throw new Error(`Agent 模板不存在: ${params.agentId}`);
    }

    // 2. 获取或创建 session（含 workspace）
    const { sessionId, workspace } = await this.getOrCreateSession(params);

    // 3. 创建 TenantPermissionDelegate
    const mcpServerUrls = (template.mcpServers as Array<{ name: string; url: string; authConfig?: Record<string, unknown> }> || []).map(s => s.url);
    const permissionDelegate = new TenantPermissionDelegate(
      {
        tenantId: params.tenantId,
        workspace,
        mcpServers: mcpServerUrls,
      },
      {
        tools: (template.tools as string[]) || [],
      },
    );

    // 4. 创建 AgentEngine（每 query 临时创建）
    const engine = AgentEngine.create({
      systemPrompt: template.systemPrompt,
      memoryRoot: `/data/tenants/${params.tenantId}/agents/${params.agentId}`,
      extensions: {
        permissions: { permissionDelegate },
      },
    });

    try {
      // 5. 加载或创建 session
      let sdkSessionId = await engine.loadSession({ workspace });
      if (!sdkSessionId) {
        sdkSessionId = await engine.createSession({
          workspace,
          systemPrompt: template.systemPrompt,
        });
      }

      // 6. 设置记忆路径
      engine.setMemoryPath(sdkSessionId, params.userId);

      // 7. 监听 query:complete 收集 usage
      engine.on('query:complete', (payload: unknown) => {
        this.usageResult = payload as QueryUsageResult;
      });

      // 8. 执行 query 并 yield 事件
      for await (const event of engine.query(sdkSessionId, params.content)) {
        yield event;
      }
    } finally {
      // 9. 更新 lastActiveAt
      try {
        await db
          .update(sessionsTable)
          .set({ lastActiveAt: new Date() })
          .where(eq(sessionsTable.id, sessionId));
      } catch (error) {
        console.warn('更新 Session lastActiveAt 失败:', error);
      }

      // 10. 销毁 engine
      try {
        await engine.destroy();
      } catch (error) {
        console.warn('Engine 销毁失败:', error);
      }
    }
  }

  /**
   * 获取或创建 Session
   *
   * 逻辑：
   * 1. 查 sessions 表 WHERE userId + templateId AND status='active'
   * 2. 如无记录：创建目录并插入 sessions 记录
   * 3. 返回 { sessionId, workspace }
   */
  private async getOrCreateSession(params: DispatchParams): Promise<{
    sessionId: string;
    workspace: string;
  }> {
    // 1. 查找现有 session
    const [existing] = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.userId, params.userId),
          eq(sessionsTable.templateId, params.agentId),
          eq(sessionsTable.status, 'active'),
        ),
      )
      .limit(1);

    if (existing) {
      return {
        sessionId: existing.id,
        workspace: existing.workspace,
      };
    }

    // 2. 创建新 session
    const sessionId = randomUUID();
    const workspace = `/data/tenants/${params.tenantId}/agents/${params.agentId}/users/${params.userId}/workspace/`;

    // 3. 创建目录（如果不存在）
    const workspacePath = workspace;
    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true });
    }

    // 4. 插入 sessions 记录
    try {
      await db.insert(sessionsTable).values({
        id: sessionId,
        tenantId: params.tenantId,
        userId: params.userId,
        templateId: params.agentId,
        status: 'active',
        workspace,
      });
    } catch (error) {
      console.warn('Session 插入失败:', error);
    }

    return { sessionId, workspace };
  }

  /**
   * 获取 Session 的 workspace 路径
   *
   * 供历史端点使用
   */
  async getSessionWorkspace(sessionId: string): Promise<string | null> {
    const [session] = await db
      .select({ workspace: sessionsTable.workspace })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    return session?.workspace || null;
  }

  /**
   * 获取最后一次 Query 的 Usage 结果
   */
  getUsage(): QueryUsageResult | null {
    return this.usageResult;
  }

  /**
   * 列出 Session 元数据（从数据库查询）
   */
  async list(filters: {
    tenantId?: string;
    userId?: string;
    agentId?: string;
    status?: string;
    limit?: number;
  }): Promise<Array<{
    id: string;
    tenantId: string;
    userId: string;
    templateId: string;
    status: string;
    workspace: string;
    createdAt: Date | null;
    lastActiveAt: Date | null;
  }>> {
    // 构建动态查询条件
    const conditions: Array<ReturnType<typeof eq>> = [];

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

    // 执行查询
    let query = db.select().from(sessionsTable);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const results = await query.execute();
    return results.map(r => ({
      ...r,
      templateId: r.templateId ?? '',
    }));
  }

  /**
   * 获取 Session 详情
   */
  async get(sessionId: string): Promise<Record<string, unknown> | null> {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      tenantId: session.tenantId,
      userId: session.userId,
      agentId: session.templateId,
      status: session.status,
      workspace: session.workspace,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
    };
  }

  /**
   * 暂停 Session
   */
  async pause(sessionId: string): Promise<boolean> {
    const result = await db
      .update(sessionsTable)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(sessionsTable.id, sessionId))
      .returning();

    return result.length > 0;
  }

  /**
   * 恢复 Session
   */
  async resume(sessionId: string): Promise<boolean> {
    const result = await db
      .update(sessionsTable)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(sessionsTable.id, sessionId))
      .returning();

    return result.length > 0;
  }

  /**
   * 销毁 Session
   */
  async destroy(sessionId: string): Promise<boolean> {
    const result = await db
      .update(sessionsTable)
      .set({ status: 'terminated', updatedAt: new Date() })
      .where(eq(sessionsTable.id, sessionId))
      .returning();

    return result.length > 0;
  }

  /**
   * 获取 Session 统计信息
   */
  async getStats(sessionId: string): Promise<Record<string, unknown> | null> {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      status: session.status,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      workspace: session.workspace,
    };
  }

  /**
   * 获取所有活跃 Session 数量
   */
  async getActiveCount(): Promise<number> {
    const result = await db
      .select({ count: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.status, 'active'));

    return result.length;
  }

  /**
   * 获取所有暂停 Session 数量
   */
  async getPausedCount(): Promise<number> {
    const result = await db
      .select({ count: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.status, 'paused'));

    return result.length;
  }
}

/**
 * 单例实例
 */
export const queryDispatcher = new QueryDispatcher();
