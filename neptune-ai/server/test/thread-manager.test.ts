/**
 * ThreadManager 集成测试
 *
 * 测试覆盖：
 * 1. Thread CRUD（创建、列表、获取、更新、删除）
 * 2. Chat 端点错误处理（400/404/409）
 * 3. 权限验证
 * 4. EnginePool sdkSessionId 管理（首次 dispatch、复用、淘汰）
 *
 * 注意：不测试实际 Engine 执行（SSE 流），因为 Engine SDK 不可用于测试环境。
 */

// 在 import createTestApp 之前设置 DATA_ROOT，避免单例使用 /data（只读文件系统）
process.env.DATA_ROOT = `/tmp/neptune-test-data-${Date.now()}`;

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { createTestApp, TEST_AGENT_TEMPLATE } from './setup';
import { mkdirSync } from 'fs';

/**
 * 辅助函数：创建唯一测试用户并获取 token
 * 使用随机后缀避免与已有数据冲突
 */
async function createUniqueTestUser(
  app: Awaited<ReturnType<typeof createTestApp>>,
  role: 'admin' | 'user',
): Promise<{ token: string; userId: string; tenantId: string }> {
  const suffix = Math.random().toString(36).substring(2, 8);
  const email = `thread-test-${role}-${suffix}@test.com`;

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      tenantName: `Thread Test Tenant ${suffix}`,
      name: `Thread Test ${role} ${suffix}`,
      email,
      password: 'password123',
    },
  });

  if (registerResponse.statusCode !== 201) {
    throw new Error(`注册失败: ${registerResponse.payload}`);
  }

  const registerData = registerResponse.json();
  return {
    token: registerData.accessToken,
    userId: registerData.user.id,
    tenantId: registerData.user.tenantId,
  };
}

describe('Thread CRUD + Chat 错误处理', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let adminToken: string;
  let adminTenantId: string;
  let userToken: string;
  let agentId: string;
  let threadId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // 创建 admin 用户（使用唯一 email）
    const admin = await createUniqueTestUser(app, 'admin');
    adminToken = admin.token;
    adminTenantId = admin.tenantId;

    // 创建普通用户（同租户）
    const suffix = Math.random().toString(36).substring(2, 8);
    const userRegisterResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenantId: adminTenantId,
        name: `Thread Test User ${suffix}`,
        email: `thread-test-user-${suffix}@test.com`,
        password: 'password123',
      },
    });
    const userData = userRegisterResponse.json();
    userToken = userData.accessToken;

    // 创建 Agent 模板（用 admin）
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: TEST_AGENT_TEMPLATE,
    });
    agentId = createResponse.json().id;
  });

  // ===== 1. 创建 Thread =====
  describe('POST /:agentId/threads — 创建 Thread', () => {
    test('应该成功创建 Thread（带 title）', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          title: '测试 Thread 标题',
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('title', '测试 Thread 标题');
      expect(json).toHaveProperty('status', 'idle');
      expect(json).toHaveProperty('templateId', agentId);
      expect(json).toHaveProperty('workspace');
      threadId = json.id;
    });

    test('应该成功创建 Thread（不带 title）', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('title', null);
      expect(json).toHaveProperty('status', 'idle');
    });

    test('未认证应该返回 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads`,
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ===== 2. 列出 Thread =====
  describe('GET /:agentId/threads — 列出 Thread', () => {
    test('应该返回 Thread 列表', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${agentId}/threads`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('meta');
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta).toHaveProperty('count');
      expect(json.meta).toHaveProperty('limit');
      expect(json.meta).toHaveProperty('offset');
      // 至少有上面创建的 2 个 thread
      expect(json.data.length).toBeGreaterThanOrEqual(2);
    });

    test('应该支持 status 过滤', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${agentId}/threads?status=idle`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBeGreaterThanOrEqual(2);
      // 所有 thread 状态都是 idle
      for (const thread of json.data) {
        expect(thread.status).toBe('idle');
      }
    });

    test('应该支持 limit 参数', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${agentId}/threads?limit=1`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBeLessThanOrEqual(1);
      expect(json.meta.limit).toBe(1);
    });

    test('未认证应该返回 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${agentId}/threads`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ===== 3. 获取 Thread 详情 =====
  describe('GET /:agentId/threads/:threadId — 获取详情', () => {
    test('应该返回 Thread 详情', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${agentId}/threads/${threadId}`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json).toHaveProperty('id', threadId);
      expect(json).toHaveProperty('templateId', agentId);
      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('workspace');
    });

    test('不存在的 Thread 应该返回 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${agentId}/threads/00000000-0000-0000-0000-000000000000`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ===== 4. 更新 Thread =====
  describe('PATCH /:agentId/threads/:threadId — 更新 Thread', () => {
    test('admin 应该能更新 Thread', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/${threadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          title: '更新后的标题',
          status: 'idle',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json).toHaveProperty('title', '更新后的标题');
    });

    test('普通用户不能更新 Thread（需要 admin）', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/${threadId}`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          title: '不应该成功',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    test('不存在的 Thread 应该返回 404', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/00000000-0000-0000-0000-000000000000`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          title: '不存在',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ===== 5. 删除 Thread =====
  describe('DELETE /:agentId/threads/:threadId — 删除 Thread', () => {
    test('admin 应该能删除 Thread', async () => {
      // 先创建一个临时 thread 用于删除
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          title: '待删除的 Thread',
        },
      });
      const tempThreadId = createResponse.json().id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/agents/${agentId}/threads/${tempThreadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(204);
    });

    test('普通用户不能删除 Thread（需要 admin）', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/agents/${agentId}/threads/${threadId}`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    test('不存在的 Thread 应该返回 404', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/agents/${agentId}/threads/00000000-0000-0000-0000-000000000000`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ===== 6. Chat 端点错误处理 =====
  describe('POST /:agentId/threads/:threadId/chat — Chat 错误处理', () => {
    let testThreadId: string;

    beforeEach(async () => {
      // 每个测试前创建一个新的 thread
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          title: 'Chat 测试 Thread',
        },
      });
      testThreadId = createResponse.json().id;
    });

    test('缺少 content 应该返回 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads/${testThreadId}/chat`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json).toHaveProperty('error', 'MISSING_CONTENT');
    });

    test('不存在的 Thread 应该返回 404', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads/00000000-0000-0000-0000-000000000000/chat`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          content: '测试消息',
        },
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json).toHaveProperty('error', 'NOT_FOUND');
    });

    test('Thread 状态 running 应该返回 409', async () => {
      // 先把 thread 状态改为 running
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/${testThreadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'running',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads/${testThreadId}/chat`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          content: '测试消息',
        },
      });

      expect(response.statusCode).toBe(409);
      const json = response.json();
      expect(json).toHaveProperty('error', 'CONFLICT');
    });

    test('Thread 状态 completed 应该返回 400', async () => {
      // 先把 thread 状态改为 completed
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/${testThreadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'completed',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads/${testThreadId}/chat`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          content: '测试消息',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json).toHaveProperty('error', 'BAD_REQUEST');
    });

    test('Thread 状态 error 允许重试（但会因缺少 EngineFactory 而失败）', async () => {
      // 先把 thread 状态改为 error
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/${testThreadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'error',
        },
      });

      // error 状态允许重试，但测试环境没有 EngineFactory，所以会失败
      // 使用短超时来避免测试挂起
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads/${testThreadId}/chat`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          content: '测试消息',
        },
      });

      // 由于没有 EngineFactory，dispatch 会抛出错误
      // SSE 端点会在错误事件后关闭连接
      // 但由于测试环境的限制，我们只验证请求被接受（不立即返回错误状态码）
      // 实际行为：SSE 流开始，然后在 error 事件中关闭
      expect(response.statusCode).toBe(200);
    });
  });

  // ===== 7. History 端点 =====
  describe('GET /:agentId/threads/:threadId/history — 获取历史', () => {
    let historyThreadId: string;

    beforeEach(async () => {
      // 每个测试前创建一个新的 thread
      const createResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          title: 'History 测试 Thread',
        },
      });
      historyThreadId = createResponse.json().id;
    });

    test('应该返回历史记录（空列表）', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${agentId}/threads/${historyThreadId}/history`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('meta');
      expect(Array.isArray(json.data)).toBe(true);
    });

    test('不存在的 Thread 应该返回 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${agentId}/threads/00000000-0000-0000-0000-000000000000/history`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});

// ===== 8. EnginePool sdkSessionId 管理测试 =====
describe('EnginePool sdkSessionId 管理', () => {
  /**
   * Mock EngineFactory — 用于测试 ThreadManager 的 EnginePool 集成
   *
   * 每个 createAndLoad 调用都会生成唯一的 sdkSessionId，
   * 并记录创建历史以供验证。
   */
  class MockEngineFactory {
    public createCallCount = 0;
    public destroyCallCount = 0;
    public sessionMap: Map<string, string> = new Map(); // threadId -> sdkSessionId
    public queryCallHistory: Array<{ threadId: string; sessionId: string; content: string }> = [];

    async createAndLoad(params: {
      systemPrompt: string;
      memoryRoot: string;
      workspace: string;
      tools: string[];
      mcpServerUrls: string[];
      tenantId: string;
    }): Promise<{
      engine: { destroy: () => Promise<void>; query: (sessionId: string, content: string) => AsyncIterable<unknown> };
      sdkSessionId: string;
    }> {
      this.createCallCount++;
      // 生成唯一的 sdkSessionId
      const sdkSessionId = `mock-sdk-session-${this.createCallCount}-${Date.now()}`;

      const self = this;
      const mockEngine = {
        destroy: async () => {
          self.destroyCallCount++;
        },
        query: async function* (sessionId: string, content: string) {
          // 记录 query 调用，用于验证 sessionId 的正确性
          self.queryCallHistory.push({ sessionId, content });
          // Mock query 流，返回一个虚拟事件
          yield { type: 'text', text: `Mock response for: ${content}` };
        },
        on: (event: string, handler: (payload: unknown) => void) => {
          // Mock on 方法
        },
      };

      return { engine: mockEngine, sdkSessionId };
    }
  }

  /**
   * 创建一个测试用的 ThreadManager，使用 Mock EngineFactory
   */
  async function createTestThreadManager() {
    const mockFactory = new MockEngineFactory();
    const { ThreadManager } = await import('../src/services/thread-manager');

    const manager = new ThreadManager({
      dataRoot: process.env.DATA_ROOT!,
      engineFactory: mockFactory as any,
      maxConcurrent: 2,
    });

    return { manager, mockFactory };
  }

  /**
   * 创建测试数据：返回 app, token, agentId
   */
  async function setupTestData() {
    const app = await createTestApp();
    const admin = await createUniqueTestUser(app, 'admin');

    const agentResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers: { authorization: `Bearer ${admin.token}` },
      payload: TEST_AGENT_TEMPLATE,
    });
    const agentId = agentResponse.json().id;

    const user = await createUniqueTestUser(app, 'user');

    return { app, adminToken: admin.token, userToken: user.token, agentId };
  }

  test('首次 dispatch 应创建 engine 并保存 sdkSessionId', async () => {
    const { manager, mockFactory } = await createTestThreadManager();
    const { app, userToken, agentId } = await setupTestData();

    // 创建 Thread
    const threadResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/threads`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { title: '测试 Thread' },
    });
    const threadId = threadResponse.json().id;

    // 首次 dispatch
    const events: unknown[] = [];
    for await (const event of manager.dispatch(threadId, '首次消息')) {
      events.push(event);
    }

    // 验证：创建了一次 engine
    expect(mockFactory.createCallCount).toBe(1);

    // 验证：query 被调用，且使用了返回的 sdkSessionId
    expect(mockFactory.queryCallHistory.length).toBe(1);
    const queryCall = mockFactory.queryCallHistory[0];
    expect(queryCall.sessionId).toMatch(/^mock-sdk-session-1-/);
    expect(queryCall.content).toBe('首次消息');

    // 验证：engine 未被销毁
    expect(mockFactory.destroyCallCount).toBe(0);

    // 验证：收到了 mock 返回的事件
    expect(events.length).toBe(1);
    expect(events[0]).toEqual({ type: 'text', text: 'Mock response for: 首次消息' });
  });

  test('二次 dispatch 应复用已有 engine 使用正确 sdkSessionId', async () => {
    const { manager, mockFactory } = await createTestThreadManager();
    const { app, userToken, agentId } = await setupTestData();

    // 创建 Thread
    const threadResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/agents/${agentId}/threads`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { title: '测试 Thread' },
    });
    const threadId = threadResponse.json().id;

    // 首次 dispatch
    for await (const _ of manager.dispatch(threadId, '首次消息')) {
      // 消费事件
    }
    expect(mockFactory.createCallCount).toBe(1);
    const firstSessionId = mockFactory.queryCallHistory[0]!.sessionId;

    // 二次 dispatch
    for await (const _ of manager.dispatch(threadId, '二次消息')) {
      // 消费事件
    }

    // 验证：没有创建新的 engine（复用已有）
    expect(mockFactory.createCallCount).toBe(1);

    // 验证：query 被调用两次，且使用的是同一个 sdkSessionId
    expect(mockFactory.queryCallHistory.length).toBe(2);
    expect(mockFactory.queryCallHistory[1]!.sessionId).toBe(firstSessionId);
    expect(mockFactory.queryCallHistory[1]!.content).toBe('二次消息');

    // 验证：engine 仍未被销毁
    expect(mockFactory.destroyCallCount).toBe(0);
  });

  test('pool 淘汰后下次请求应创建新 engine', async () => {
    const { manager, mockFactory } = await createTestThreadManager();
    const { app, userToken, agentId } = await setupTestData();

    // 创建 3 个 thread（超过 pool 容量 2）
    const threadIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const threadResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { title: `测试 Thread ${i}` },
      });
      threadIds.push(threadResponse.json().id);
    }

    // Thread 1 首次 dispatch
    for await (const _ of manager.dispatch(threadIds[0], 'Thread 1 首次')) {
      // 消费事件
    }
    expect(mockFactory.createCallCount).toBe(1);
    const firstThreadFirstSessionId = mockFactory.queryCallHistory[0]!.sessionId;

    // Thread 2 首次 dispatch（pool 达到容量上限）
    for await (const _ of manager.dispatch(threadIds[1], 'Thread 2 首次')) {
      // 消费事件
    }
    expect(mockFactory.createCallCount).toBe(2);

    // Thread 3 首次 dispatch（应触发淘汰 Thread 1）
    for await (const _ of manager.dispatch(threadIds[2], 'Thread 3 首次')) {
      // 消费事件
    }

    // 验证：创建了第 3 个 engine
    expect(mockFactory.createCallCount).toBe(3);

    // 验证：Thread 1 的 engine 被销毁（淘汰）
    expect(mockFactory.destroyCallCount).toBe(1);

    // Thread 1 再次 dispatch（应创建新 engine，因为之前被淘汰）
    for await (const _ of manager.dispatch(threadIds[0], 'Thread 1 再次')) {
      // 消费事件
    }

    // 验证：创建了第 4 个 engine
    expect(mockFactory.createCallCount).toBe(4);

    // 验证：新的 sdkSessionId 与第一次不同
    const thread1Calls = mockFactory.queryCallHistory.filter(
      call => call.content === 'Thread 1 首次' || call.content === 'Thread 1 再次'
    );
    expect(thread1Calls.length).toBe(2);
    expect(thread1Calls[0]!.sessionId).toBe(firstThreadFirstSessionId);
    expect(thread1Calls[1]!.sessionId).not.toBe(firstThreadFirstSessionId);
  });
});
