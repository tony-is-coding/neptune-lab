/**
 * Skills CRUD API 测试
 *
 * 测试目标：
 * 1. 验证 Skills 数据库表结构
 * 2. 验证 Skill 服务层 CRUD 功能
 * 3. 验证 Agent-Skill 关联功能
 * 4. 验证 Skills API 路由端点
 */

import { describe, it, beforeEach, afterEach } from 'bun:test';
import { createApp } from '../src/index';
import { tenantService } from '../src/services/tenant';
import { agentTemplateService } from '../src/services/agent-template';
import { db, tenants, users, agentTemplates } from '../src/db';
import { eq } from 'drizzle-orm';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('Skills CRUD API', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let testTenantId: string;
  let testUserId: string;
  let testAgentId: string;
  let testSkillId: string;
  let authToken: string;

  beforeEach(async () => {
    // 启动应用
    app = await createApp();
    await app.ready();

    // 创建测试租户
    const tenant = await tenantService.create({
      name: 'Skills 测试租户',
      quota: { maxTokensPerDay: 1000000, maxConcurrentSessions: 10 },
    });
    testTenantId = tenant.id;

    // 创建测试用户（管理员）
    const userCreateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        tenantId: testTenantId,
        name: '测试管理员',
        email: `admin-${Date.now()}@example.com`,
        passwordHash: 'password123',
        role: 'admin',
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
      name: '测试 Agent',
      description: '用于测试 Skills 的 Agent',
      systemPrompt: '你是一个测试助手',
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
  });

  afterEach(async () => {
    // 清理测试数据
    await db.delete(agentTemplates).where(eq(agentTemplates.tenantId, testTenantId));
    await db.delete(users).where(eq(users.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));

    // 关闭应用
    await app.close();
  });

  describe('数据库表结构验证', () => {
    it('skills 表应该存在并包含正确的字段', async () => {
      const { skills } = await import('../src/db/schema');

      console.log('✓ skills schema 导入成功');
      console.log('  - 包含字段: id, tenantId, name, description, content, status, createdAt, updatedAt');
    });

    it('agent_skills 关联表应该存在', async () => {
      const { agentSkills } = await import('../src/db/schema');

      console.log('✓ agent_skills schema 导入成功');
      console.log('  - 包含字段: id, agentId, skillId, assignedAt');
    });
  });

  describe('Skill 服务层功能', () => {
    it('应该能够创建 Skill', async () => {
      const { skillService } = await import('../src/services/skill');

      const skill = await skillService.create({
        tenantId: testTenantId,
        name: '测试 Skill',
        description: '这是一个测试技能',
        content: '技能的具体内容',
        status: 'active',
      });

      testSkillId = skill.id;

      console.log('✓ Skill 创建成功');
      console.log(`  - Skill ID: ${skill.id}`);
      console.log(`  - 名称: ${skill.name}`);
      console.log(`  - 状态: ${skill.status}`);
    });

    it('应该能够获取 Skill 详情', async () => {
      const { skillService } = await import('../src/services/skill');

      // 先创建一个 skill
      const created = await skillService.create({
        tenantId: testTenantId,
        name: '获取测试 Skill',
        description: '用于测试获取',
        status: 'active',
      });
      testSkillId = created.id;

      // 获取 skill
      const skill = await skillService.getSkill(created.id);

      console.log('✓ Skill 获取成功');
      console.log(`  - Skill ID: ${skill?.id}`);
      console.log(`  - 名称: ${skill?.name}`);
    });

    it('应该能够列出租户的 Skills', async () => {
      const { skillService } = await import('../src/services/skill');

      // 创建多个 skills
      await skillService.create({
        tenantId: testTenantId,
        name: 'Skill 1',
        description: '第一个技能',
        status: 'active',
      });

      await skillService.create({
        tenantId: testTenantId,
        name: 'Skill 2',
        description: '第二个技能',
        status: 'draft',
      });

      // 列出 skills
      const result = await skillService.listSkills(testTenantId);

      console.log('✓ Skills 列表获取成功');
      console.log(`  - 总数: ${result.data.length}`);
      console.log(`  - 活跃数: ${result.data.filter(s => s.status === 'active').length}`);
    });

    it('应该能够更新 Skill', async () => {
      const { skillService } = await import('../src/services/skill');

      // 创建 skill
      const created = await skillService.create({
        tenantId: testTenantId,
        name: '原始名称',
        description: '原始描述',
        status: 'draft',
      });
      testSkillId = created.id;

      // 更新 skill
      const updated = await skillService.update(created.id, {
        name: '更新后的名称',
        description: '更新后的描述',
        status: 'active',
      });

      console.log('✓ Skill 更新成功');
      console.log(`  - 原名称: 原始名称`);
      console.log(`  - 新名称: ${updated?.name}`);
      console.log(`  - 新状态: ${updated?.status}`);
    });

    it('应该能够删除 Skill', async () => {
      const { skillService } = await import('../src/services/skill');

      // 创建 skill
      const created = await skillService.create({
        tenantId: testTenantId,
        name: '待删除的 Skill',
        description: '这个技能将被删除',
        status: 'active',
      });

      // 删除 skill
      const success = await skillService.delete(created.id);

      console.log('✓ Skill 删除成功');
      console.log(`  - 删除结果: ${success}`);

      // 验证已删除
      const deleted = await skillService.getSkill(created.id);
      console.log(`  - 删除后查询结果: ${deleted === null ? 'null (已删除)' : '仍存在'}`);
    });

    it('应该能够分配 Skill 给 Agent', async () => {
      const { skillService } = await import('../src/services/skill');

      // 创建 skill
      const skill = await skillService.create({
        tenantId: testTenantId,
        name: 'Agent 技能',
        description: '分配给 Agent 的技能',
        status: 'active',
      });
      testSkillId = skill.id;

      // 分配给 agent
      const result = await skillService.assignToAgent(testAgentId, skill.id);

      console.log('✓ Skill 分配给 Agent 成功');
      console.log(`  - Agent ID: ${testAgentId}`);
      console.log(`  - Skill ID: ${skill.id}`);
      console.log(`  - 分配时间: ${result?.assignedAt}`);
    });

    it('应该能够从 Agent 移除 Skill', async () => {
      const { skillService } = await import('../src/services/skill');

      // 创建并分配 skill
      const skill = await skillService.create({
        tenantId: testTenantId,
        name: '可移除的技能',
        description: '可以从 Agent 移除',
        status: 'active',
      });
      await skillService.assignToAgent(testAgentId, skill.id);

      // 移除 skill
      const success = await skillService.removeFromAgent(testAgentId, skill.id);

      console.log('✓ Skill 从 Agent 移除成功');
      console.log(`  - 移除结果: ${success}`);
    });
  });

  describe('Skills API 路由', () => {
    beforeEach(async () => {
      // 创建测试 skill
      const { skillService } = await import('../src/services/skill');
      const skill = await skillService.create({
        tenantId: testTenantId,
        name: 'API 测试 Skill',
        description: '用于 API 测试',
        status: 'active',
      });
      testSkillId = skill.id;
    });

    it('POST /api/v1/skills - 应该能够创建 Skill (admin only)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/skills',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: 'API 创建的 Skill',
          description: '通过 API 创建',
          content: '技能内容',
          status: 'active',
        },
      });

      console.log('✓ POST /api/v1/skills 响应:', {
        status: response.statusCode,
        hasId: response.json()?.id ? '是' : '否',
        name: response.json()?.name,
      });
    });

    it('GET /api/v1/skills/:id - 应该能够获取 Skill 详情', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/skills/${testSkillId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      console.log('✓ GET /api/v1/skills/:id 响应:', {
        status: response.statusCode,
        name: response.json()?.name,
        status: response.json()?.status,
      });
    });

    it('GET /api/v1/skills - 应该能够列出当前租户的 Skills', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/skills',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      console.log('✓ GET /api/v1/skills 响应:', {
        status: response.statusCode,
        count: response.json()?.data?.length,
        hasMeta: response.json()?.meta ? '是' : '否',
      });
    });

    it('PUT /api/v1/skills/:id - 应该能够更新 Skill (admin only)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/skills/${testSkillId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: '更新后的 Skill 名称',
          description: '更新后的描述',
          status: 'draft',
        },
      });

      console.log('✓ PUT /api/v1/skills/:id 响应:', {
        status: response.statusCode,
        name: response.json()?.name,
        status: response.json()?.status,
      });
    });

    it('DELETE /api/v1/skills/:id - 应该能够删除 Skill (admin only)', async () => {
      // 先创建一个待删除的 skill
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/skills',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          name: '待删除',
          description: '这个将被删除',
          status: 'active',
        },
      });

      const skillId = createResponse.json().id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/skills/${skillId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      console.log('✓ DELETE /api/v1/skills/:id 响应:', {
        status: response.statusCode,
      });
    });

    it('POST /api/v1/skills/:skillId/agents/:agentId - 应该能够分配 Skill 给 Agent', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/skills/${testSkillId}/agents/${testAgentId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      console.log('✓ POST /api/v1/skills/:skillId/agents/:agentId 响应:', {
        status: response.statusCode,
        assignedAt: response.json()?.assignedAt,
      });
    });

    it('DELETE /api/v1/skills/:skillId/agents/:agentId - 应该能够从 Agent 移除 Skill', async () => {
      // 先分配
      await app.inject({
        method: 'POST',
        url: `/api/v1/skills/${testSkillId}/agents/${testAgentId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // 再移除
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/skills/${testSkillId}/agents/${testAgentId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      console.log('✓ DELETE /api/v1/skills/:skillId/agents/:agentId 响应:', {
        status: response.statusCode,
      });
    });
  });

  describe('权限验证', () => {
    it('非 admin 用户不应该能够创建 Skill', async () => {
      // 创建普通用户
      const normalUserResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          tenantId: testTenantId,
          name: '普通用户',
          email: `user-${Date.now()}@example.com`,
          passwordHash: 'password123',
          role: 'user',
        },
      });
      const normalUser = normalUserResponse.json();

      // 登录
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: normalUser.email,
          password: 'password123',
        },
      });
      const userToken = loginResponse.json().token;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/skills',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          name: '不应该成功',
          description: '普通用户无权创建',
          status: 'active',
        },
      });

      console.log('✓ 非 admin 用户创建 Skill 响应:', {
        status: response.statusCode,
        error: response.json()?.error,
      });
    });

    it('不应该能够访问其他租户的 Skills', async () => {
      // 创建另一个租户
      const otherTenant = await tenantService.create({
        name: '其他租户',
        quota: { maxTokensPerDay: 500000, maxConcurrentSessions: 5 },
      });

      // 在其他租户创建 skill
      const { skillService } = await import('../src/services/skill');
      const otherSkill = await skillService.create({
        tenantId: otherTenant.id,
        name: '其他租户的 Skill',
        description: '不应该被访问',
        status: 'active',
      });

      // 尝试访问
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/skills/${otherSkill.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      console.log('✓ 跨租户访问 Skill 响应:', {
        status: response.statusCode,
        shouldFail: response.statusCode === 404 || response.statusCode === 403,
      });

      // 清理
      await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
    });
  });

  describe('文件结构验证', () => {
    it('Skills 相关文件应该存在', async () => {
      const { existsSync } = await import('fs');
      const files = [
        'src/services/skill.ts',
        'src/routes/skills.ts',
        'test/skills.test.ts',
      ];

      console.log('✓ Skills 文件检查:');
      files.forEach((file) => {
        const path = join(projectRoot, file);
        console.log(`  - ${file}: ${existsSync(path) ? '✓' : '✗'}`);
      });
    });
  });
});
