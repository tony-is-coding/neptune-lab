/**
 * ThreadManager 集成测试
 *
 * 测试覆盖：
 * 1. Thread CRUD（创建、列表、获取、更新、删除）
 * 2. Chat 端点错误处理（400/404/409）
 * 3. 权限验证
 *
 * 注意：不测试实际 Engine 执行（SSE 流），因为 Engine SDK 不可用于测试环境。
 */

// 在 import createTestApp 之前设置 DATA_ROOT，避免单例使用 /data（只读文件系统）
process.env.DATA_ROOT = `/tmp/neptune-test-data-${Date.now()}`;

import { describe, test, expect, beforeAll } from 'bun:test';
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
    test('缺少 content 应该返回 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads/${threadId}/chat`,
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
        url: `/api/v1/agents/${agentId}/threads/${threadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'running',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads/${threadId}/chat`,
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

      // 恢复状态
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/${threadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'idle',
        },
      });
    });

    test('Thread 状态 completed 应该返回 400', async () => {
      // 先把 thread 状态改为 completed
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/${threadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'completed',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads/${threadId}/chat`,
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

      // 恢复状态
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/${threadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'idle',
        },
      });
    });

    test('Thread 状态 error 也应该返回 400', async () => {
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/${threadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'error',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/agents/${agentId}/threads/${threadId}/chat`,
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          content: '测试消息',
        },
      });

      expect(response.statusCode).toBe(400);

      // 恢复状态
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/agents/${agentId}/threads/${threadId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          status: 'idle',
        },
      });
    });
  });

  // ===== 7. History 端点 =====
  describe('GET /:agentId/threads/:threadId/history — 获取历史', () => {
    test('应该返回历史记录（空列表）', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/agents/${agentId}/threads/${threadId}/history`,
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
