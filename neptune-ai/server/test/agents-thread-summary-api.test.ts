/**
 * Agents API - thread_summary 参数集成测试
 *
 * 测试目标：
 * 1. 验证 GET /api/v1/agents?include=thread_summary 端点
 * 2. 验证返回的 threadSummary 聚合对象数据结构
 * 3. 验证权限隔离（租户隔离）
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApp } from '../src/index';
import { db, tenants, users, agentTemplates, sessions } from '../src/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';

describe('Agents API - thread_summary 参数集成测试', () => {
  let app: FastifyInstance;
  let testTenantId: string;
  let testUserId: string;
  let adminToken: string;
  let testAgentId: string;
  let threadId1: string;
  let threadId2: string;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();

    // 创建测试租户
    const [tenant] = await db.insert(tenants).values({
      name: 'Thread Summary Test Tenant',
    }).returning();
    testTenantId = tenant.id;

    // 创建测试用户
    const passwordHash = await bcrypt.hash('test123', 10);
    const [user] = await db.insert(users).values({
      tenantId: testTenantId,
      name: 'Test Admin',
      email: `thread-summary-admin-${Date.now()}@test.com`,
      passwordHash,
      role: 'admin',
    }).returning();
    testUserId = user.id;

    // 登录获取 token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: 'test123' },
    });
    expect(loginRes.statusCode).toBe(200);
    adminToken = loginRes.json().accessToken;

    // 创建测试 Agent
    const [agent] = await db.insert(agentTemplates).values({
      tenantId: testTenantId,
      name: 'Test Agent',
      description: 'Agent for thread summary testing',
      icon: 'smart_toy',
      systemPrompt: 'You are a test agent.',
      modelConfig: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        temperature: 0.7,
        maxTokens: 4096,
      },
    }).returning();
    testAgentId = agent.id;

    // 创建测试 Threads
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    [threadId1, threadId2] = [randomUUID(), randomUUID()];

    await db.insert(sessions).values([
      {
        id: threadId1,
        tenantId: testTenantId,
        userId: testUserId,
        templateId: testAgentId,
        status: 'idle',
        title: 'First Thread',
        summary: 'Discussion about project requirements',
        workspace: `/data/tenants/${testTenantId}/agents/${testAgentId}/threads/${threadId1}`,
        lastActiveAt: now,
        createdAt: yesterday,
        updatedAt: now,
      },
      {
        id: threadId2,
        tenantId: testTenantId,
        userId: testUserId,
        templateId: testAgentId,
        status: 'running',
        title: 'Second Thread',
        summary: 'Bug fixing session',
        workspace: `/data/tenants/${testTenantId}/agents/${testAgentId}/threads/${threadId2}`,
        lastActiveAt: yesterday,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
    ]);
  });

  afterAll(async () => {
    // 清理测试数据
    await db.delete(sessions).where(eq(sessions.templateId, testAgentId));
    await db.delete(agentTemplates).where(eq(agentTemplates.tenantId, testTenantId));
    await db.delete(users).where(eq(users.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
    await app.close();
  });

  // ===== GET /api/v1/agents?include=thread_summary =====

  describe('GET /api/v1/agents?include=thread_summary', () => {
    it('应该返回包含 threadSummary 聚合对象的 Agent 列表', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents?include=thread_summary',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.meta).toBeDefined();
      expect(body.meta.include).toBe('thread_summary');

      const testAgent = body.data.find((a: any) => a.id === testAgentId);
      expect(testAgent).toBeDefined();
      expect(testAgent.threadSummary).toBeDefined();
      expect(testAgent.threadSummary).not.toBeNull();
    });

    it('threadSummary 聚合对象应该包含正确的字段', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents?include=thread_summary',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = res.json();
      const testAgent = body.data.find((a: any) => a.id === testAgentId);
      const summary = testAgent.threadSummary;

      // 验证聚合对象结构
      expect(summary).toHaveProperty('totalThreads');
      expect(summary).toHaveProperty('latestStatus');
      expect(summary).toHaveProperty('latestThreadTitle');
      expect(summary).toHaveProperty('lastActiveAt');

      // 验证值
      expect(summary.totalThreads).toBe(2);
      // 最新的是 threadId1（lastActiveAt 是 now）
      expect(summary.latestStatus).toBe('idle');
      expect(summary.latestThreadTitle).toBe('First Thread');
      expect(summary.lastActiveAt).not.toBeNull();
    });

    it('未认证请求应返回 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents?include=thread_summary',
      });

      expect(res.statusCode).toBe(401);
    });

    it('应该只返回当前租户的 Agents', async () => {
      // 创建另一个租户
      const [otherTenant] = await db.insert(tenants).values({
        name: 'Other Tenant',
      }).returning();

      const [otherAgent] = await db.insert(agentTemplates).values({
        tenantId: otherTenant.id,
        name: 'Other Agent',
        systemPrompt: 'Other agent',
        modelConfig: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          temperature: 0.7,
          maxTokens: 4096,
        },
      }).returning();

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents?include=thread_summary',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = res.json();
      const otherAgentInList = body.data.find((a: any) => a.id === otherAgent.id);
      expect(otherAgentInList).toBeUndefined();

      // 清理
      await db.delete(agentTemplates).where(eq(agentTemplates.id, otherAgent.id));
      await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
    });
  });

  // ===== 无 Thread 的 Agent =====

  describe('Agent 无 Thread 时的行为', () => {
    it('应该返回 null 作为 threadSummary', async () => {
      // 创建没有 thread 的 agent
      const [agentNoThread] = await db.insert(agentTemplates).values({
        tenantId: testTenantId,
        name: 'Agent No Thread',
        systemPrompt: 'You are a test agent.',
        modelConfig: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          temperature: 0.7,
          maxTokens: 4096,
        },
      }).returning();

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents?include=thread_summary',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = res.json();
      const agent = body.data.find((a: any) => a.id === agentNoThread.id);
      expect(agent.threadSummary).toBeNull();

      // 清理
      await db.delete(agentTemplates).where(eq(agentTemplates.id, agentNoThread.id));
    });
  });

  // ===== 参数组合测试 =====

  describe('参数组合测试', () => {
    it('应该同时支持 active 和 include 参数', async () => {
      // 停用测试 Agent
      await db.update(agentTemplates)
        .set({ isActive: false })
        .where(eq(agentTemplates.id, testAgentId));

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents?active=true&include=thread_summary',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = res.json();
      const testAgent = body.data.find((a: any) => a.id === testAgentId);
      expect(testAgent).toBeUndefined();

      // 恢复 Agent 状态
      await db.update(agentTemplates)
        .set({ isActive: true })
        .where(eq(agentTemplates.id, testAgentId));
    });

    it('应该同时支持 limit 和 include 参数', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents?limit=1&include=thread_summary',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = res.json();
      expect(body.data.length).toBe(1);
      expect(body.meta.limit).toBe(1);
    });
  });

  // ===== 用户隔离测试 =====

  describe('用户 Thread 隔离', () => {
    it('应该只统计当前用户的 Threads', async () => {
      // 创建另一个用户
      const passwordHash = await bcrypt.hash('test123', 10);
      const [otherUser] = await db.insert(users).values({
        tenantId: testTenantId,
        name: 'Other User',
        email: `other-user-${Date.now()}@test.com`,
        passwordHash,
        role: 'user',
      }).returning();

      // 为其他用户创建 Thread
      const otherThreadId = randomUUID();
      await db.insert(sessions).values({
        id: otherThreadId,
        tenantId: testTenantId,
        userId: otherUser.id,
        templateId: testAgentId,
        status: 'idle',
        title: 'Other User Thread',
        summary: 'Other user discussion',
        workspace: `/data/tenants/${testTenantId}/agents/${testAgentId}/threads/${otherThreadId}`,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 使用 admin 用户请求
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agents?include=thread_summary',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = res.json();
      const testAgent = body.data.find((a: any) => a.id === testAgentId);

      // 应该只统计 admin 用户的 2 个 Threads，不包括其他用户的 Thread
      expect(testAgent.threadSummary.totalThreads).toBe(2);

      // 清理
      await db.delete(sessions).where(eq(sessions.id, otherThreadId));
      await db.delete(users).where(eq(users.id, otherUser.id));
    });
  });
});
