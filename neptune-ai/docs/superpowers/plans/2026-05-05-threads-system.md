# Threads 系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Neptune-AI 后端实现 Threads 系统，支持一个 Agent 下多个并发 Thread（Engine Session），并提供完整的 Thread CRUD + 对话 API。

**Architecture:** 在现有 `sessions` 表上新增 `title`/`summary` 字段升级为 Thread 概念。新建 `ThreadManager` 服务（含 `EnginePool`）取代 `QueryDispatcher` 的单 Session 限制，支持多 Engine 并发。新增 `threads` 路由提供 Thread CRUD，改造现有 `sessions` 路由兼容旧接口。

**Tech Stack:** Bun + Fastify 5 + Drizzle ORM + PostgreSQL + claude-code-best/engine SDK

**Spec:** `docs/design/2026-05-05-threads-system-design.md`

---

## File Structure

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/services/engine-pool.ts` | Engine 实例池管理（获取/释放/回收） |
| `src/services/thread-manager.ts` | Thread 生命周期管理（CRUD + dispatch） |
| `src/routes/threads.ts` | Thread CRUD 路由（GET/POST/PATCH/DELETE） |
| `test/threads.test.ts` | Thread API 集成测试 |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src/db/schema.ts` | sessions 表新增 `title`、`summary` 字段 |
| `src/services/session.ts` | 重构为 thin wrapper 委托给 ThreadManager（保持向后兼容） |
| `src/routes/sessions.ts` | 修改 chat/history 路由委托给 ThreadManager |
| `src/index.ts` | 注册 threads 路由 |
| `src/config.ts` | 新增 `engine.idleTimeoutMs` 配置 |

---

## Task 1: Schema — sessions 表新增 title/summary 字段

**Files:**
- Modify: `src/db/schema.ts:89-102`
- Create: `src/db/migrations/` (auto-generated)

- [ ] **Step 1: 修改 schema.ts，给 sessions 表添加 title 和 summary 字段**

在 `src/db/schema.ts` 的 `sessions` 表定义中，`status` 行之后添加两个字段：

```typescript
// src/db/schema.ts — sessions 表中，在 status 行后添加：
title: text('title'),
summary: text('summary'),
```

- [ ] **Step 2: 生成 migration**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun run db:generate`
Expected: 生成新的 migration 文件到 `src/db/migrations/`

- [ ] **Step 3: 执行 migration**

Run: `bun run db:migrate`
Expected: 数据库更新成功，sessions 表新增 title、summary 列

- [ ] **Step 4: 迁移现有数据 status 值**

在 psql 或 migration SQL 中执行：

```sql
UPDATE sessions SET status = 'idle' WHERE status IN ('active', 'created', 'paused');
UPDATE sessions SET status = 'completed' WHERE status = 'terminated';
```

- [ ] **Step 5: 验证 schema 变更**

Run: `bun run db:studio`
Expected: Drizzle Studio 中 sessions 表显示 title、summary 列，status 值已迁移

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/migrations/
git commit -m "feat(threads): sessions 表新增 title/summary 字段"
```

---

## Task 2: EnginePool — Engine 实例池管理

**Files:**
- Create: `src/services/engine-pool.ts`
- Create: `test/engine-pool.test.ts`

- [ ] **Step 1: 编写 EnginePool 测试**

创建 `test/engine-pool.test.ts`：

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';

describe('EnginePool', () => {
  // 测试 1: 创建池实例
  test('should create pool with maxConcurrent config', async () => {
    const { EnginePool } = await import('../src/services/engine-pool');
    const pool = new EnginePool({ maxConcurrent: 3 });
    expect(pool.getActiveCount()).toBe(0);
  });

  // 测试 2: 注册和获取 engine
  test('should register and retrieve engine by threadId', async () => {
    const { EnginePool } = await import('../src/services/engine-pool');
    const pool = new EnginePool({ maxConcurrent: 2 });
    const mockEngine = { destroy: async () => {} } as any;
    pool.register('thread-1', mockEngine);
    expect(pool.get('thread-1')).toBe(mockEngine);
    expect(pool.getActiveCount()).toBe(1);
  });

  // 测试 3: 释放 engine
  test('should release engine and call destroy', async () => {
    const { EnginePool } = await import('../src/services/engine-pool');
    const pool = new EnginePool({ maxConcurrent: 2 });
    let destroyed = false;
    const mockEngine = { destroy: async () => { destroyed = true; } } as any;
    pool.register('thread-1', mockEngine);
    await pool.release('thread-1');
    expect(pool.get('thread-1')).toBeUndefined();
    expect(destroyed).toBe(true);
    expect(pool.getActiveCount()).toBe(0);
  });

  // 测试 4: 超出并发限制时返回需要淘汰的 threadId
  test('should identify evictable thread when at capacity', async () => {
    const { EnginePool } = await import('../src/services/engine-pool');
    const pool = new EnginePool({ maxConcurrent: 2 });
    pool.register('thread-1', { destroy: async () => {} } as any);
    pool.register('thread-2', { destroy: async () => {} } as any);
    // 已满，应返回最老的 threadId 用于淘汰
    const evictable = pool.getEvictable();
    expect(evictable).toBe('thread-1'); // FIFO: 最先注册的最先淘汰
  });

  // 测试 5: has() 检查
  test('should check if engine exists for thread', async () => {
    const { EnginePool } = await import('../src/services/engine-pool');
    const pool = new EnginePool({ maxConcurrent: 5 });
    expect(pool.has('thread-1')).toBe(false);
    pool.register('thread-1', { destroy: async () => {} } as any);
    expect(pool.has('thread-1')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun test test/engine-pool.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 EnginePool**

创建 `src/services/engine-pool.ts`：

```typescript
import type { AgentEngine } from 'claude-code-best/engine';

export interface EnginePoolConfig {
  maxConcurrent: number;
}

/**
 * EnginePool — 管理 AgentEngine 实例的内存池
 *
 * 每个 Thread 对应一个 Engine 实例。
 * 超出并发限制时，淘汰最久没活动的 Engine。
 */
export class EnginePool {
  private engines: Map<string, AgentEngine> = new Map();
  // 记录每个 engine 的最后活动时间，用于淘汰排序
  private lastActivity: Map<string, number> = new Map();
  private config: EnginePoolConfig;

  constructor(config: EnginePoolConfig) {
    this.config = config;
  }

  register(threadId: string, engine: AgentEngine): void {
    this.engines.set(threadId, engine);
    this.touch(threadId);
  }

  get(threadId: string): AgentEngine | undefined {
    const engine = this.engines.get(threadId);
    if (engine) this.touch(threadId);
    return engine;
  }

  has(threadId: string): boolean {
    return this.engines.has(threadId);
  }

  async release(threadId: string): Promise<void> {
    const engine = this.engines.get(threadId);
    if (engine) {
      try {
        await engine.destroy();
      } catch (error) {
        console.warn(`Engine 销毁失败 (thread=${threadId}):`, error);
      }
      this.engines.delete(threadId);
      this.lastActivity.delete(threadId);
    }
  }

  getActiveCount(): number {
    return this.engines.size;
  }

  isAtCapacity(): boolean {
    return this.engines.size >= this.config.maxConcurrent;
  }

  /**
   * 获取可淘汰的 Thread ID（最久没活动的）
   */
  getEvictable(): string | null {
    if (this.engines.size === 0) return null;

    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [threadId, time] of this.lastActivity) {
      if (time < oldestTime) {
        oldestTime = time;
        oldest = threadId;
      }
    }

    return oldest;
  }

  /**
   * 获取所有活跃的 threadId
   */
  getActiveThreadIds(): string[] {
    return Array.from(this.engines.keys());
  }

  private touch(threadId: string): void {
    this.lastActivity.set(threadId, Date.now());
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun test test/engine-pool.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/engine-pool.ts test/engine-pool.test.ts
git commit -m "feat(threads): EnginePool — Engine 实例池管理"
```

---

## Task 3: ThreadManager — Thread 生命周期管理

**Files:**
- Create: `src/services/thread-manager.ts`
- Create: `test/thread-manager.test.ts`

这是核心服务，依赖 Task 1（schema）和 Task 2（EnginePool）。

- [ ] **Step 1: 编写 ThreadManager 测试 — Thread CRUD**

创建 `test/thread-manager.test.ts`，测试 Thread 的创建、列表、获取、更新、删除：

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestApp, createTestUser } from './setup';
import type { FastifyInstance } from 'fastify';

describe('ThreadManager', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUser: any;
  let agentId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, 'admin');
    adminToken = admin.token;
    adminUser = admin.user;

    // 创建测试 Agent
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Test Agent',
        systemPrompt: 'You are a test assistant.',
        modelConfig: { provider: 'test', model: 'test', temperature: 0.7, maxTokens: 100 },
      },
    });
    agentId = res.json().id;
  });

  afterAll(async () => {
    await app.close();
  });

  test('POST /agents/:agentId/threads — 创建 Thread', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/threads`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'Test Thread' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe('Test Thread');
    expect(body.status).toBe('idle');
    expect(body.id).toBeDefined();
  });

  test('GET /agents/:agentId/threads — 获取 Thread 列表', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${agentId}/threads`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.meta).toBeDefined();
  });

  test('GET /agents/:agentId/threads — 按 lastActiveAt 降序排列', async () => {
    // 创建第二个 Thread
    await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/threads`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'Second Thread' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${agentId}/threads`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = res.json();
    // 最新的应该在前面
    expect(body.data[0].title).toBe('Second Thread');
  });

  test('PATCH /agents/:agentId/threads/:threadId — 更新 Thread', async () => {
    // 先创建
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/threads`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'Original' },
    });
    const threadId = createRes.json().id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/agents/${agentId}/threads/${threadId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'Updated Title' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Updated Title');
  });

  test('DELETE /agents/:agentId/threads/:threadId — 删除 Thread', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/threads`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'To Delete' },
    });
    const threadId = createRes.json().id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/agents/${agentId}/threads/${threadId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);
  });

  test('GET /agents/:agentId/threads — 支持状态过滤', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${agentId}/threads?status=idle`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const thread of body.data) {
      expect(thread.status).toBe('idle');
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun test test/thread-manager.test.ts`
Expected: FAIL — 路由不存在

- [ ] **Step 3: 实现 ThreadManager 服务**

创建 `src/services/thread-manager.ts`。这是核心文件，包含：
- Thread CRUD（create, list, get, update, delete）
- Engine 实例管理（通过 EnginePool）
- dispatch 核心方法（向指定 Thread 发消息）
- dispatchToAgent 兼容方法（自动创建/复用 Thread）

参考 `src/services/session.ts` 中 `QueryDispatcher` 的实现模式，但：
- 使用 `EnginePool` 管理 Engine 实例（不再每 query 创建/销毁）
- 去掉 `getOrCreateSession` 中"每用户+Agent 只有一个"的限制
- dispatch 时更新 thread 的 `summary` 和 `lastActiveAt`

关键方法签名和实现逻辑：

```typescript
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { AgentEngine, type QueryEvent } from 'claude-code-best/engine';
import { TenantPermissionDelegate } from './permission-delegate.js';
import { EnginePool } from './engine-pool.js';
import { db } from '../db/index.js';
import { agentTemplates, sessions as sessionsTable } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

export interface Thread {
  id: string;
  tenantId: string;
  userId: string;
  agentId: string; // templateId
  title: string | null;
  summary: string | null;
  status: string;
  workspace: string;
  lastActiveAt: Date | null;
  createdAt: Date | null;
}

export interface QueryUsageResult {
  sessionId: string;
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    costUSD: number;
  }>;
}

export class ThreadManager {
  private pool: EnginePool;
  private usageResult: QueryUsageResult | null = null;

  constructor() {
    // 从 config 或 agent template 获取并发限制，默认 5
    this.pool = new EnginePool({ maxConcurrent: 5 });
  }

  // ===== CRUD =====

  async create(params: {
    tenantId: string;
    userId: string;
    agentId: string;
    title?: string;
  }): Promise<Thread> {
    const threadId = randomUUID();
    const workspace = `/data/tenants/${params.tenantId}/agents/${params.agentId}/users/${params.userId}/threads/${threadId}/`;

    if (!existsSync(workspace)) {
      mkdirSync(workspace, { recursive: true });
    }

    await db.insert(sessionsTable).values({
      id: threadId,
      tenantId: params.tenantId,
      userId: params.userId,
      templateId: params.agentId,
      title: params.title || null,
      status: 'idle',
      workspace,
    });

    return (await this.get(threadId))!;
  }

  async list(agentId: string, userId: string, filters?: {
    status?: string; limit?: number; offset?: number;
  }): Promise<{ data: Thread[]; meta: { count: number; limit: number; offset: number } }> {
    const conditions = [
      eq(sessionsTable.templateId, agentId),
      eq(sessionsTable.userId, userId),
    ];
    if (filters?.status) {
      conditions.push(eq(sessionsTable.status, filters.status));
    }

    const results = await db
      .select()
      .from(sessionsTable)
      .where(and(...conditions))
      .orderBy(desc(sessionsTable.lastActiveAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    return {
      data: results.map(r => ({ ...r, agentId: r.templateId ?? '' })),
      meta: {
        count: results.length,
        limit: filters?.limit || 50,
        offset: filters?.offset || 0,
      },
    };
  }

  async get(threadId: string): Promise<Thread | null> {
    const [row] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, threadId))
      .limit(1);
    if (!row) return null;
    return { ...row, agentId: row.templateId ?? '' };
  }

  async update(threadId: string, data: {
    title?: string; summary?: string; status?: string;
  }): Promise<Thread | null> {
    await db
      .update(sessionsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sessionsTable.id, threadId));
    return this.get(threadId);
  }

  async delete(threadId: string): Promise<boolean> {
    // 释放 Engine
    if (this.pool.has(threadId)) {
      await this.pool.release(threadId);
    }
    const result = await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.id, threadId))
      .returning();
    return result.length > 0;
  }

  // ===== 对话 =====

  async *dispatch(threadId: string, content: string): AsyncGenerator<QueryEvent> {
    const thread = await this.get(threadId);
    if (!thread) throw new Error(`Thread 不存在: ${threadId}`);
    if (thread.status === 'running') throw new Error('THREAD_RUNNING');
    if (thread.status === 'completed' || thread.status === 'error') throw new Error('THREAD_CLOSED');

    // 更新状态为 running
    await this.update(threadId, { status: 'running', summary: content.slice(0, 100) });

    // 查 agent template
    const [template] = await db
      .select()
      .from(agentTemplates)
      .where(eq(agentTemplates.id, thread.agentId))
      .limit(1);
    if (!template) throw new Error(`Agent 模板不存在: ${thread.agentId}`);

    // 获取或创建 Engine
    let engine = this.pool.get(threadId);
    if (!engine) {
      // 检查并发限制
      if (this.pool.isAtCapacity()) {
        const evictable = this.pool.getEvictable();
        if (evictable) {
          await this.pool.release(evictable);
          await this.update(evictable, { status: 'idle' });
        }
      }

      const mcpServerUrls = (template.mcpServers as any[] || []).map(s => s.url);
      const permissionDelegate = new TenantPermissionDelegate(
        { tenantId: thread.tenantId, workspace: thread.workspace, mcpServers: mcpServerUrls },
        { tools: (template.tools as string[]) || [] },
      );

      engine = AgentEngine.create({
        systemPrompt: template.systemPrompt,
        memoryRoot: `/data/tenants/${thread.tenantId}/agents/${thread.agentId}`,
        extensions: { permissions: { permissionDelegate } },
      });

      // 加载或创建 SDK Session
      let sdkSessionId = await engine.loadSession({ workspace: thread.workspace });
      if (!sdkSessionId) {
        sdkSessionId = await engine.createSession({
          workspace: thread.workspace,
          systemPrompt: template.systemPrompt,
        });
      }
      engine.setMemoryPath(sdkSessionId, thread.userId);

      this.pool.register(threadId, engine);
    }

    // 监听 usage
    engine.on('query:complete', (payload: unknown) => {
      this.usageResult = payload as QueryUsageResult;
    });

    try {
      // 执行 query
      for await (const event of engine.query(undefined, content)) {
        yield event;
      }
    } finally {
      // 更新状态为 idle
      await this.update(threadId, {
        status: 'idle',
        lastActiveAt: new Date(),
      });
    }
  }

  async *dispatchToAgent(tenantId: string, userId: string, agentId: string, content: string): AsyncGenerator<QueryEvent> {
    // 查找最近的 idle Thread
    const { data: threads } = await this.list(agentId, userId, { status: 'idle', limit: 1 });

    let threadId: string;
    if (threads.length > 0) {
      threadId = threads[0].id;
    } else {
      // 自动创建新 Thread
      const thread = await this.create({ tenantId, userId, agentId });
      threadId = thread.id;
    }

    yield* this.dispatch(threadId, content);
  }

  // ===== 兼容旧接口 =====

  getLastUsage(): QueryUsageResult | null {
    return this.usageResult;
  }

  async getWorkspace(threadId: string): Promise<string | null> {
    const thread = await this.get(threadId);
    return thread?.workspace || null;
  }

  async listByFilters(filters: {
    tenantId?: string; userId?: string; agentId?: string;
    status?: string; limit?: number;
  }): Promise<any[]> {
    const conditions: any[] = [];
    if (filters.tenantId) conditions.push(eq(sessionsTable.tenantId, filters.tenantId));
    if (filters.userId) conditions.push(eq(sessionsTable.userId, filters.userId));
    if (filters.agentId) conditions.push(eq(sessionsTable.templateId, filters.agentId));
    if (filters.status) conditions.push(eq(sessionsTable.status, filters.status));

    let query = db.select().from(sessionsTable);
    if (conditions.length > 0) query = query.where(and(...conditions));
    if (filters.limit) query = query.limit(filters.limit);

    return (await query).map(r => ({ ...r, templateId: r.templateId ?? '' }));
  }
}

export const threadManager = new ThreadManager();
```

- [ ] **Step 4: 实现 threads 路由**

创建 `src/routes/threads.ts`。**所有 Thread 相关路由统一放在此文件中**（CRUD + chat + history）。

路由端点（全部注册在 `/agents` 前缀下）：
- `GET /:agentId/threads` — Thread 列表
- `POST /:agentId/threads` — 创建 Thread
- `GET /:agentId/threads/:threadId` — Thread 详情
- `PATCH /:agentId/threads/:threadId` — 更新 Thread
- `DELETE /:agentId/threads/:threadId` — 删除 Thread
- `POST /:agentId/threads/:threadId/chat` — 向 Thread 发消息（SSE）
- `GET /:agentId/threads/:threadId/history` — 获取 Thread 历史

所有端点需要 Bearer 认证。创建/更新/删除需要 admin 角色。

chat 端点行为：
- Thread 状态为 `running` → 返回 409 Conflict
- Thread 状态为 `completed` 或 `error` → 返回 400 Bad Request
- Thread 状态为 `idle` → 创建/复用 Engine 执行，返回 SSE 流

参考 `src/routes/agents.ts` 的代码模式（Fastify 路由注册、preHandler 认证、错误处理）。

- [ ] **Step 5: 注册 threads 路由到 app**

修改 `src/index.ts`：

```typescript
import { threadRoutes } from './routes/threads';

// 在 API 路由组中，sessionRoutes 之前添加：
await app.register(threadRoutes, { prefix: '/agents' });
```

注意：threads 路由的前缀是 `/agents`，因为最终路径是 `/agents/:agentId/threads`。由于 Fastify 路由匹配按注册顺序，需确保 threadRoutes 注册在 sessionRoutes 之前，避免 `/agents/:agentId/threads/:threadId/chat` 被 `/:agentId/chat` 误匹配。

- [ ] **Step 6: 运行测试确认通过**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun test test/thread-manager.test.ts`
Expected: ALL PASS

- [ ] **Step 7: 运行全部测试确认无回归**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun test`
Expected: ALL PASS（原有测试不受影响）

- [ ] **Step 8: Commit**

```bash
git add src/services/thread-manager.ts src/routes/threads.ts src/index.ts test/thread-manager.test.ts
git commit -m "feat(threads): ThreadManager 服务 + Thread CRUD 路由"
```

---

## Task 4: 改造 sessions 路由 — 兼容旧接口

**Files:**
- Modify: `src/routes/sessions.ts`
- Create: `test/threads-chat.test.ts`

> 注意：Thread 对话路由（`/threads/:threadId/chat` 和 `/threads/:threadId/history`）已在 Task 3 Step 4 的 `threads.ts` 中实现。本 Task 只改造 sessions.ts 中的旧接口兼容。

- [ ] **Step 1: 编写兼容路由测试**

创建 `test/threads-chat.test.ts`，测试旧接口和 Thread 对话的集成：

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestApp, createTestUser } from './setup';
import type { FastifyInstance } from 'fastify';

describe('Thread Chat API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUser: any;
  let agentId: string;
  let threadId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, 'admin');
    adminToken = admin.token;
    adminUser = admin.user;

    // 创建测试 Agent
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Chat Test Agent',
        systemPrompt: 'You are a test assistant.',
        modelConfig: { provider: 'test', model: 'test', temperature: 0.7, maxTokens: 100 },
      },
    });
    agentId = res.json().id;

    // 创建测试 Thread
    const threadRes = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/threads`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'Chat Thread' },
    });
    threadId = threadRes.json().id;
  });

  afterAll(async () => {
    await app.close();
  });

  test('POST /agents/:agentId/threads/:threadId/chat — 缺少 content 返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/threads/${threadId}/chat`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  test('POST /agents/:agentId/threads/:threadId/chat — 不存在的 Thread 返回 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/threads/nonexistent/chat`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { content: 'hello' },
    });
    expect(res.statusCode).toBe(404);
  });

  test('GET /agents/:agentId/threads/:threadId/history — 获取历史', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${agentId}/threads/${threadId}/history`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.meta).toBeDefined();
  });

  test('POST /agents/:agentId/chat — 旧接口兼容（自动创建 Thread）', async () => {
    // 旧接口不指定 threadId，应自动创建/复用 Thread
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/chat`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { content: 'hello from old api' },
    });
    // 可能因为没有真实 Engine 而失败，但不应是 404 或路由错误
    expect([200, 400, 500]).toContain(res.statusCode);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun test test/threads-chat.test.ts`
Expected: FAIL — 路由不存在

- [ ] **Step 3: 改造 sessions.ts 路由 — 只改旧接口兼容**

修改 `src/routes/sessions.ts`，将现有的两个旧路由改造为委托给 ThreadManager：

1. **改造 `POST /:agentId/chat`**：
   - 替换 `queryDispatcher.dispatch(...)` → `threadManager.dispatchToAgent(agentId, userId, tenantId, content)`
   - ThreadManager 内部自动查找/创建最近 idle 的 Thread

2. **改造 `GET /:agentId/history`**：
   - 替换 `queryDispatcher.list(...)` → `threadManager.list(agentId, userId, { limit: 1 })`
   - 找到最近 Thread 后读取其 workspace 的 transcript.jsonl

核心改造点：
- `import { threadManager } from '../services/thread-manager.js'`
- chat: `threadManager.dispatchToAgent(user.tenantId, user.userId, agentId, content)`
- history: 先 `threadManager.list(agentId, user.userId, { limit: 1 })` 获取最近 Thread，再读取 workspace

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun test test/threads-chat.test.ts`
Expected: ALL PASS

- [ ] **Step 5: 运行全部测试确认无回归**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/sessions.ts test/threads-chat.test.ts
git commit -m "feat(threads): 改造 sessions 路由支持 Thread 对话"
```

---

## Task 5: 兼容旧接口 + 集成验证

**Files:**
- Modify: `src/services/session.ts`（保留为 thin wrapper 或删除直接引用）
- Create: `test/threads-compat.test.ts`

- [ ] **Step 1: 编写兼容性测试**

创建 `test/threads-compat.test.ts`，验证旧接口行为不变：

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestApp, createTestUser } from './setup';
import type { FastifyInstance } from 'fastify';

describe('Thread 兼容旧接口', () => {
  let app: FastifyInstance;
  let token: string;
  let agentId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, 'admin');
    token = admin.token;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Compat Test Agent',
        systemPrompt: 'You are a test assistant.',
        modelConfig: { provider: 'test', model: 'test', temperature: 0.7, maxTokens: 100 },
      },
    });
    agentId = res.json().id;
  });

  afterAll(async () => {
    await app.close();
  });

  test('POST /agents/:agentId/chat — 自动创建 Thread（兼容）', async () => {
    // 旧接口不指定 threadId，应自动创建新 Thread 并开始对话
    // 由于没有真实 Engine，这个测试主要验证路由不报错
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/chat`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'hello' },
    });
    // 可能因为没有真实 Engine 而失败，但不应是 404 或路由错误
    // 预期：200（开始SSE）或 500（Engine 创建失败）或 400（content 相关）
    expect([200, 400, 500]).toContain(res.statusCode);
  });

  test('GET /agents/:agentId/history — 返回最近 Thread 历史（兼容）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${agentId}/history`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
  });
});
```

- [ ] **Step 2: 确保 session.ts 的旧导出仍然可用**

`src/services/session.ts` 中的 `queryDispatcher` 被现有的 sessions 路由引用。改造方式：
- 保留 `queryDispatcher` 作为 thin wrapper，内部委托给 `threadManager`
- 或者直接在 sessions 路由中改为引用 `threadManager`

推荐方案：在 `session.ts` 中保留 `queryDispatcher` 对象，但方法实现改为委托：

```typescript
import { threadManager } from './thread-manager.js';
import type { DispatchParams, QueryUsageResult } from './types.js';

// 保持导出名称不变，向后兼容
export const queryDispatcher = {
  dispatch: (params: DispatchParams) => threadManager.dispatchToAgent(
    params.tenantId, params.userId, params.agentId, params.content
  ),
  getUsage: (): QueryUsageResult | null => threadManager.getLastUsage(),
  // 注意：list 签名需要传递 tenantId，因为现有 sessions 路由查询时会传 tenantId
  list: (filters: { tenantId?: string; userId?: string; agentId?: string; status?: string; limit?: number }) =>
    threadManager.listByFilters(filters),
  get: (sessionId: string) => threadManager.get(sessionId),
  getSessionWorkspace: (sessionId: string) => threadManager.getWorkspace(sessionId),
};
```

ThreadManager 需要新增 `listByFilters()` 方法来兼容旧的 filters 对象接口，内部根据 filters 查询 sessions 表。

同时需要新增 `getWorkspace()` 方法返回 Thread 的 workspace 路径。

- [ ] **Step 3: 运行兼容性测试**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun test test/threads-compat.test.ts`
Expected: ALL PASS

- [ ] **Step 4: 运行全部测试**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/session.ts test/threads-compat.test.ts
git commit -m "feat(threads): 旧接口兼容 + session.ts 委托给 ThreadManager"
```

---

## Task 6: 更新 API 文档

**Files:**
- Create: `docs/api/threads.md`
- Modify: `docs/api/README.md`（添加 threads 模块链接）
- Modify: `docs/api/sessions.md`（标注接口变更）

- [ ] **Step 1: 创建 threads.md API 文档**

按照 `docs/api/auth.md` 等现有文档的格式，为 Threads 模块编写完整的 API 文档。包含：
- 接口总览表
- 每个接口的请求参数、响应示例、错误码
- Thread 状态说明
- SSE 对话接口的特殊行为（409 Conflict 等）

- [ ] **Step 2: 更新 README.md 模块索引**

在 `docs/api/README.md` 的模块文档表格中添加：

```markdown
| Threads | [threads.md](./threads.md) | Thread CRUD、对话、历史记录 |
```

- [ ] **Step 3: 更新 sessions.md 标注变更**

在 `docs/api/sessions.md` 顶部添加变更说明：

```markdown
> **注意**：sessions 接口已升级为 Threads 概念。旧接口保持兼容，推荐使用新的 Threads API。
> 详见 [threads.md](./threads.md)。
```

- [ ] **Step 4: Commit**

```bash
git add docs/api/
git commit -m "docs: 新增 Threads API 文档"
```

---

## Task 7: 前端 Thread 类型 + API 客户端

**Files:**
- Modify: `web/src/types/chat.ts`
- Create: `web/src/api/threads.ts`（需先确认 `web/src/api/` 目录是否存在，不存在则创建）

- [ ] **Step 1: 确认 web/src/api/ 目录**

Run: `ls /Users/terrence_tan/startups/neptune-lab/neptune-ai/web/src/api/ 2>/dev/null || mkdir -p /Users/terrence_tan/startups/neptune-lab/neptune-ai/web/src/api`

- [ ] **Step 2: 在 types/chat.ts 中新增 Thread 类型**

```typescript
export interface Thread {
  id: string;
  agentId: string;
  title: string | null;
  summary: string | null;
  status: 'running' | 'idle' | 'completed' | 'error';
  lastActiveAt: string;
  createdAt: string;
}
```

- [ ] **Step 3: 创建 api/threads.ts — Thread API 客户端**

实现以下函数：
- `listThreads(agentId: string)` → GET
- `createThread(agentId: string, title?: string)` → POST
- `getThread(agentId: string, threadId: string)` → GET
- `updateThread(agentId: string, threadId: string, data)` → PATCH
- `deleteThread(agentId: string, threadId: string)` → DELETE
- `getThreadHistory(agentId: string, threadId: string)` → GET
- `sendThreadMessage(agentId: string, threadId: string, content: string)` → POST (SSE fetch)

参考现有前端代码的 fetch 模式。

- [ ] **Step 4: Commit**

```bash
git add web/src/types/chat.ts web/src/api/threads.ts
git commit -m "feat(web): Thread 类型和 API 客户端"
```

---

## Task 8: 前端 ThreadList 组件 + useThreads hook

**Files:**
- Create: `web/src/components/thread/ThreadList.tsx`
- Create: `web/src/components/thread/ThreadItem.tsx`
- Create: `web/src/hooks/useThreads.ts`

- [ ] **Step 1: 创建 useThreads hook**

实现 Thread 列表的加载、切换、轮询逻辑：
- 加载指定 Agent 的 Thread 列表
- 当前选中的 ThreadId（前端状态）
- 定时轮询刷新（5 秒间隔）
- 创建新 Thread
- 切换 Thread

- [ ] **Step 2: 创建 ThreadItem 组件**

展示单个 Thread 条目：
- 标题
- 状态指示器（running: 绿色脉冲动画，idle: 灰色圆点，completed: 绿色对勾，error: 红色）
- 摘要文本
- 相对时间

- [ ] **Step 3: 创建 ThreadList 组件**

使用 useThreads hook + ThreadItem 组件渲染 Thread 列表，包含 "New Thread" 按钮。

- [ ] **Step 4: Commit**

```bash
git add web/src/components/thread/ web/src/hooks/useThreads.ts
git commit -m "feat(web): ThreadList 组件 + useThreads hook"
```

---

## Task 9: 前端 Collaborate 页面集成

**Files:**
- Modify: `web/src/pages/Collaborate.tsx`
- Modify: `web/src/hooks/useChatMessages.ts`
- Modify: `web/src/App.tsx`（路由变更）

- [ ] **Step 1: 改造 Collaborate.tsx**

将左侧栏从 Agent 列表替换为 ThreadList 组件。路由改为 `agentId` 必填。

- [ ] **Step 2: 改造 useChatMessages.ts**

- 移除 Mock 数据
- `sendMessage` 改为调用 `sendThreadMessage` API（真实 SSE）
- 消息按 threadId 隔离
- 解析 SSE 事件流更新消息列表

- [ ] **Step 3: 更新 App.tsx 路由**

将 `/collaborate/:id?` 改为 `/collaborate/:agentId`（agentId 必填）。

- [ ] **Step 4: 启动前后端联调验证**

Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/server && bun run dev`
Run: `cd /Users/terrence_tan/startups/neptune-lab/neptune-ai/web && bun run dev`

验证：
1. 登录 → 进入 Home → 选择 Agent → 跳转 Collaborate
2. Collaborate 显示 Thread 列表（初始为空）
3. 发送消息 → 自动创建 Thread → SSE 流式响应
4. Thread 列表显示新 Thread（状态 running → idle）
5. 创建新 Thread → 切换 → 发消息 → 切回原 Thread

- [ ] **Step 5: Commit**

```bash
git add web/src/
git commit -m "feat(web): Collaborate 集成 Thread 系统"
```

---

## 依赖关系

```
Task 1 (Schema)
  ↓
Task 2 (EnginePool) ← 无依赖，可与 Task 1 并行
  ↓
Task 3 (ThreadManager + Routes) ← 依赖 Task 1 + Task 2
  ↓
Task 4 (Sessions 改造) ← 依赖 Task 3
  ↓
Task 5 (兼容性验证) ← 依赖 Task 4
  ↓
Task 6 (API 文档) ← 依赖 Task 3
  ↓
Task 7-9 (前端) ← 依赖 Task 3（后端 API 可用后）
```

**可并行的任务**：Task 1 和 Task 2 可以并行执行。Task 6 可以与 Task 4-5 并行。Task 7-8 可以与 Task 4-5 并行。
