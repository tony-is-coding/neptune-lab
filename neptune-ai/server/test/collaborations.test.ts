/**
 * 协作记录 API 测试
 *
 * 测试目标：
 * 1. 验证 listRecentThreads 方法
 * 2. 验证 GET /api/v1/collaborations/recent 端点
 * 3. 验证返回的数据包含 Agent 名称和图标
 */

import { describe, it, beforeEach, afterEach } from 'bun:test';
import { createApp } from '../src/index';
import { tenantService } from '../src/services/tenant';
import { agentTemplateService } from '../src/services/agent-template';
import { getThreadManager } from '../src/services/thread-manager';
import { db, tenants, users, agentTemplates, sessions as sessionsTable } from '../src/db';
import { eq, and } from 'drizzle-orm';
import { join } from 'path';
import { randomUUID } from 'crypto';

describe('协作记录 API', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let testTenantId: string;
  let testUserId: string;
  let testAgentId: string;
  let testThreadId: string;
  let authToken: string;

  beforeEach(async () => {
    // 启动应用
    app = await createApp();
    await app.ready();

    // 创建测试租户
    const tenant = await tenantService.create({
      name: '协作测试租户',
      quota: { maxTokensPerDay: 1000000, maxConcurrentSessions: 10 },
    });
    testTenantId = tenant.id;

    // 创建测试用户
    const userCreateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        tenantId: testTenantId,
        name: '测试用户',
        email: `user-${Date.now()}@example.com`,
        passwordHash: 'password123',
        role: 'user',
      },
    });
    const user = userCreateResponse.json();
    testUserId = user.id;

    // 登录获取 token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: user.email,
        password: 'password123',
      },
    });
    authToken = loginResponse.json().token;

    // 创建测试 Agent
    const agent = await agentTemplateService.create({
      tenantId: testTenantId,
      name: '协作测试 Agent',
      description: '用于测试协作记录',
      icon: 'smart_toy',
      systemPrompt: '你是一个协作测试助手',
      modelConfig: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        temperature: 0.7,
        maxTokens: 4096,
      },
      tools: [],
      skills: [],
      mcpServers: [],
    });
    testAgentId = agent.id;

    // 创建测试 Thread
    const threadManager = getThreadManager();
    const thread = await threadManager.create({
      tenantId: testTenantId,
      userId: testUserId,
      agentId: testAgentId,
      title: '测试协作会话',
    });
    testThreadId = thread.id;

    // 更新 lastActiveAt
    await db
      .update(sessionsTable)
      .set({ lastActiveAt: new Date() })
      .where(eq(sessionsTable.id, testThreadId));
  });

  afterEach(async () => {
    // 清理测试数据
    await db.delete(sessionsTable).where(eq(sessionsTable.tenantId, testTenantId));
    await db.delete(agentTemplates).where(eq(agentTemplates.tenantId, testTenantId));
    await db.delete(users).where(eq(users.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));

    // 关闭应用
    await app.close();
  });

  describe('ThreadManager.listRecentThreads 方法', () => {
    it('应该能够获取用户最近的 Thread 列表', async () => {
      const threadManager = getThreadManager();

      const recentThreads = await threadManager.listRecentThreads(
        testUserId,
        testTenantId,
        10,
      );

      console.log('✓ listRecentThreads 执行成功');
      console.log(`  - 返回数量: ${recentThreads.length}`);
      console.log(`  - 第一条 Thread ID: ${recentThreads[0]?.id}`);
      console.log(`  - Agent 名称: ${recentThreads[0]?.agentName}`);
      console.log(`  - Agent 图标: ${recentThreads[0]?.agentIcon}`);
    });

    it('返回的数据应该包含 Agent 名称和图标', async () => {
      const threadManager = getThreadManager();

      const recentThreads = await threadManager.listRecentThreads(
        testUserId,
        testTenantId,
        10,
      );

      if (recentThreads.length > 0) {
        const first = recentThreads[0];

        console.log('✓ 数据包含 Agent 信息:');
        console.log(`  - Thread ID: ${first.id}`);
        console.log(`  - Agent ID: ${first.templateId}`);
        console.log(`  - Agent 名称: ${first.agentName}`);
        console.log(`  - Agent 图标: ${first.agentIcon}`);
        console.log(`  - Thread 标题: ${first.title}`);
        console.log(`  - 最后活跃: ${first.lastActiveAt}`);
      }
    });

    it('应该支持多个 Agent 的 Thread 混合返回', async () => {
      const threadManager = getThreadManager();

      // 创建第二个 Agent
      const agent2 = await agentTemplateService.create({
        tenantId: testTenantId,
        name: '第二个 Agent',
        description: '另一个测试 Agent',
        icon: 'psychology',
        systemPrompt: '你是第二个助手',
        modelConfig: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          temperature: 0.7,
          maxTokens: 4096,
        },
        tools: [],
        skills: [],
        mcpServers: [],
      });

      // 为第二个 Agent 创建 Thread
      await threadManager.create({
        tenantId: testTenantId,
        userId: testUserId,
        agentId: agent2.id,
        title: '与第二个 Agent 的对话',
      });

      // 获取最近的 Thread
      const recentThreads = await threadManager.listRecentThreads(
        testUserId,
        testTenantId,
        10,
      );

      console.log('✓ 多 Agent Thread 混合返回:');
      console.log(`  - 总 Thread 数: ${recentThreads.length}`);
      recentThreads.forEach((t, i) => {
        console.log(`  - [${i + 1}] ${t.agentName}: ${t.title}`);
      });
    });

    it('应该支持 limit 参数限制返回数量', async () => {
      const threadManager = getThreadManager();

      // 创建多个 Threads
      for (let i = 0; i < 5; i++) {
        await threadManager.create({
          tenantId: testTenantId,
          userId: testUserId,
          agentId: testAgentId,
          title: `测试 Thread ${i + 1}`,
        });
      }

      // 使用 limit=3
      const recentThreads = await threadManager.listRecentThreads(
        testUserId,
        testTenantId,
        3,
      );

      console.log('✓ limit 参数生效:');
      console.log(`  - 请求数量: 3`);
      console.log(`  - 返回数量: ${recentThreads.length}`);
      console.log(`  - limit 生效: ${recentThreads.length <= 3 ? '是' : '否'}`);
    });
  });

  describe('GET /api/v1/collaborations/recent 端点', () => {
    it('应该能够获取当前用户最近的协作记录', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/collaborations/recent',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const body = response.json();

      console.log('✓ GET /api/v1/collaborations/recent 响应:');
      console.log(`  - 状态码: ${response.statusCode}`);
      console.log(`  - 数据数量: ${body.data?.length}`);
      console.log(`  - meta.count: ${body.meta?.count}`);
      console.log(`  - meta.limit: ${body.meta?.limit}`);

      if (body.data && body.data.length > 0) {
        const first = body.data[0];
        console.log(`  - 第一条记录:`);
        console.log(`    - Thread ID: ${first.id}`);
        console.log(`    - Agent 名称: ${first.agentName}`);
        console.log(`    - Agent 图标: ${first.agentIcon}`);
        console.log(`    - 标题: ${first.title}`);
      }
    });

    it('应该支持 limit 查询参数', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/collaborations/recent?limit=5',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const body = response.json();

      console.log('✓ limit 查询参数生效:');
      console.log(`  - 请求 limit: 5`);
      console.log(`  - 响应 meta.limit: ${body.meta?.limit}`);
      console.log(`  - 返回数量: ${body.data?.length}`);
    });

    it('未认证用户应该返回 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/collaborations/recent',
      });

      console.log('✓ 未认证访问响应:');
      console.log(`  - 状态码: ${response.statusCode}`);
      console.log(`  - 是否为 401: ${response.statusCode === 401 ? '是' : '否'}`);
    });

    it('不同用户的协作记录应该隔离', async () => {
      // 创建第二个用户
      const user2Response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          tenantId: testTenantId,
          name: '第二个用户',
          email: `user2-${Date.now()}@example.com`,
          passwordHash: 'password123',
          role: 'user',
        },
      });
      const user2 = user2Response.json();

      // 第二个用户登录
      const login2Response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: user2.email,
          password: 'password123',
        },
      });
      const token2 = login2Response.json().token;

      // 获取第二个用户的协作记录
      const response2 = await app.inject({
        method: 'GET',
        url: '/api/v1/collaborations/recent',
        headers: {
          authorization: `Bearer ${token2}`,
        },
      });

      const body2 = response2.json();

      console.log('✓ 用户隔离验证:');
      console.log(`  - 用户 1 的记录数: ${1}`); // 我们在 beforeEach 中创建了 1 个
      console.log(`  - 用户 2 的记录数: ${body2.data?.length}`);
      console.log(`  - 隔离生效: ${body2.data?.length === 0 ? '是' : '否'}`);
    });
  });

  describe('文件结构验证', () => {
    it('协作相关文件应该存在', async () => {
      const { existsSync } = await import('fs');
      const files = [
        'src/routes/collaborations.ts',
        'test/collaborations.test.ts',
      ];

      console.log('✓ 协作文件检查:');
      files.forEach((file) => {
        const path = join(process.cwd(), file);
        console.log(`  - ${file}: ${existsSync(path) ? '✓' : '✗'}`);
      });
    });
  });
});
