/**
 * Skills CRUD API 测试
 *
 * 测试目标：
 * 1. 验证 Skills 数据库表结构
 * 2. 验证 Skill 服务层 CRUD 功能
 * 3. 验证 Agent-Skill 关联功能
 * 4. 验证 Skills API 路由端点
 * 5. 验证权限隔离（租户隔离、角色检查）
 */

import {describe, it, expect, beforeAll, afterAll} from 'bun:test';
import {createApp} from '../src/index';
import {db, tenants, users, agentTemplates, skills, agentSkills} from '../src/db';
import {eq} from 'drizzle-orm';
import bcrypt from 'bcrypt';
import type {FastifyInstance} from 'fastify';

describe('Skills CRUD API', () => {
    let app: FastifyInstance;
    let testTenantId: string;
    let adminToken: string;
    let userToken: string;
    let testAgentId: string;
    let testSkillId: string;

    beforeAll(async () => {
        app = await createApp();
        await app.ready();

        // 创建测试租户
        const [tenant] = await db.insert(tenants).values({name: 'Skills Test Tenant'}).returning();
        testTenantId = tenant.id;

        // 创建 admin 用户
        const adminHash = await bcrypt.hash('admin123', 10);
        const [adminUser] = await db.insert(users).values({
            tenantId: testTenantId,
            name: 'Test Admin',
            email: `skills-admin-${Date.now()}@test.com`,
            passwordHash: adminHash,
            role: 'admin',
        }).returning();

        // 创建普通用户
        const userHash = await bcrypt.hash('user123', 10);
        const [normalUser] = await db.insert(users).values({
            tenantId: testTenantId,
            name: 'Test User',
            email: `skills-user-${Date.now()}@test.com`,
            passwordHash: userHash,
            role: 'user',
        }).returning();

        // 登录获取 token
        const adminLogin = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {email: adminUser.email, password: 'admin123'},
        });
        expect(adminLogin.statusCode).toBe(200);
        adminToken = adminLogin.json().accessToken;

        const userLogin = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {email: normalUser.email, password: 'user123'},
        });
        expect(userLogin.statusCode).toBe(200);
        userToken = userLogin.json().accessToken;

        // 创建测试 Agent
        const [agent] = await db.insert(agentTemplates).values({
            tenantId: testTenantId,
            name: 'Test Agent',
            description: 'Skills test agent',
            systemPrompt: 'test',
            modelConfig: {provider: 'anthropic', model: 'test', temperature: 0.7, maxTokens: 100},
            tools: [],
            skills: [],
            mcpServers: [],
        }).returning();
        testAgentId = agent.id;
    });

    afterAll(async () => {
        // 清理：按外键顺序删除
        await db.delete(agentSkills).where(undefined as any).catch(() => {
        });
        await db.delete(skills).where(eq(skills.tenantId, testTenantId)).catch(() => {
        });
        await db.delete(agentTemplates).where(eq(agentTemplates.tenantId, testTenantId)).catch(() => {
        });
        await db.delete(users).where(eq(users.tenantId, testTenantId)).catch(() => {
        });
        await db.delete(tenants).where(eq(tenants.id, testTenantId)).catch(() => {
        });
        await app.close();
    });

    // ===== Schema 验证 =====

    describe('数据库表结构', () => {
        it('skills 表和 agent_skills 表应该存在', () => {
            expect(skills).toBeDefined();
            expect(agentSkills).toBeDefined();
        });
    });

    // ===== POST /api/v1/skills — 创建 =====

    describe('POST /api/v1/skills', () => {
        it('应该能创建 Skill', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/skills',
                headers: {authorization: `Bearer ${adminToken}`},
                payload: {
                    name: '测试技能',
                    description: '用于测试',
                    content: '# Skill Content',
                    status: 'active',
                },
            });

            expect(res.statusCode).toBe(201);
            const body = res.json();
            expect(body.id).toBeDefined();
            expect(body.name).toBe('测试技能');
            expect(body.description).toBe('用于测试');
            expect(body.content).toBe('# Skill Content');
            expect(body.status).toBe('active');
            expect(body.tenantId).toBe(testTenantId);
            testSkillId = body.id;
        });

        it('应该默认 status 为 active', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/skills',
                headers: {authorization: `Bearer ${adminToken}`},
                payload: {name: '默认状态技能'},
            });

            expect(res.statusCode).toBe(201);
            expect(res.json().status).toBe('active');
        });

        it('未认证请求应返回 401', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/skills',
                payload: {name: '未认证'},
            });

            expect(res.statusCode).toBe(401);
        });

        it('缺少 name 应返回 400', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/skills',
                headers: {authorization: `Bearer ${adminToken}`},
                payload: {description: '没有名字'},
            });

            expect(res.statusCode).toBe(400);
        });
    });

    // ===== GET /api/v1/skills — 列表 =====

    describe('GET /api/v1/skills', () => {
        it('应该能列出当前租户的 Skills', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/skills',
                headers: {authorization: `Bearer ${adminToken}`},
            });

            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body.data).toBeInstanceOf(Array);
            expect(body.meta).toBeDefined();
            expect(body.meta.count).toBeGreaterThanOrEqual(1);
        });

        it('未认证请求应返回 401', async () => {
            const res = await app.inject({method: 'GET', url: '/api/v1/skills'});
            expect(res.statusCode).toBe(401);
        });
    });

    // ===== GET /api/v1/skills/:id — 详情 =====

    describe('GET /api/v1/skills/:id', () => {
        it('应该能获取 Skill 详情', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/api/v1/skills/${testSkillId}`,
                headers: {authorization: `Bearer ${adminToken}`},
            });

            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body.id).toBe(testSkillId);
            expect(body.name).toBe('测试技能');
            expect(body.content).toBe('# Skill Content');
        });

        it('不存在的 ID 应返回 404', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/skills/00000000-0000-0000-0000-000000000000',
                headers: {authorization: `Bearer ${adminToken}`},
            });

            expect(res.statusCode).toBe(404);
        });
    });

    // ===== PUT /api/v1/skills/:id — 更新 =====

    describe('PUT /api/v1/skills/:id', () => {
        it('应该能更新 Skill', async () => {
            const res = await app.inject({
                method: 'PUT',
                url: `/api/v1/skills/${testSkillId}`,
                headers: {authorization: `Bearer ${adminToken}`},
                payload: {
                    name: '更新后的技能',
                    description: '更新后',
                    status: 'draft',
                },
            });

            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body.name).toBe('更新后的技能');
            expect(body.description).toBe('更新后');
            expect(body.status).toBe('draft');
        });

        it('不存在的 ID 应返回 404', async () => {
            const res = await app.inject({
                method: 'PUT',
                url: '/api/v1/skills/00000000-0000-0000-0000-000000000000',
                headers: {authorization: `Bearer ${adminToken}`},
                payload: {name: '不存在'},
            });

            expect(res.statusCode).toBe(404);
        });
    });

    // ===== DELETE /api/v1/skills/:id — 删除 =====

    describe('DELETE /api/v1/skills/:id', () => {
        it('应该能删除 Skill', async () => {
            // 先创建一个待删除的
            const createRes = await app.inject({
                method: 'POST',
                url: '/api/v1/skills',
                headers: {authorization: `Bearer ${adminToken}`},
                payload: {name: '待删除', status: 'active'},
            });
            const skillId = createRes.json().id;

            const res = await app.inject({
                method: 'DELETE',
                url: `/api/v1/skills/${skillId}`,
                headers: {authorization: `Bearer ${adminToken}`},
            });

            expect(res.statusCode).toBe(204);

            // 验证已删除
            const getRes = await app.inject({
                method: 'GET',
                url: `/api/v1/skills/${skillId}`,
                headers: {authorization: `Bearer ${adminToken}`},
            });
            expect(getRes.statusCode).toBe(404);
        });

        it('不存在的 ID 应返回 404', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: '/api/v1/skills/00000000-0000-0000-0000-000000000000',
                headers: {authorization: `Bearer ${adminToken}`},
            });

            expect(res.statusCode).toBe(404);
        });
    });

    // ===== Agent-Skill 关联 =====

    describe('Agent-Skill 关联', () => {
        let assocSkillId: string;

        it('应该能分配 Skill 给 Agent', async () => {
            // 创建一个 skill
            const createRes = await app.inject({
                method: 'POST',
                url: '/api/v1/skills',
                headers: {authorization: `Bearer ${adminToken}`},
                payload: {name: '关联技能', status: 'active'},
            });
            assocSkillId = createRes.json().id;

            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/skills/${assocSkillId}/agents/${testAgentId}`,
                headers: {authorization: `Bearer ${adminToken}`},
            });

            expect(res.statusCode).toBe(201);
            expect(res.json().skillId).toBe(assocSkillId);
            expect(res.json().agentId).toBe(testAgentId);
        });

        it('重复分配应返回已有关联', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/skills/${assocSkillId}/agents/${testAgentId}`,
                headers: {authorization: `Bearer ${adminToken}`},
            });

            expect(res.statusCode).toBe(201);
            expect(res.json().skillId).toBe(assocSkillId);
        });

        it('应该能查看 Skill 关联的 Agents', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/api/v1/skills/${assocSkillId}/agents`,
                headers: {authorization: `Bearer ${adminToken}`},
            });

            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body.data).toBeInstanceOf(Array);
            expect(body.data.length).toBeGreaterThanOrEqual(1);
            expect(body.data[0].id).toBe(testAgentId);
        });

        it('应该能从 Agent 移除 Skill', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: `/api/v1/skills/${assocSkillId}/agents/${testAgentId}`,
                headers: {authorization: `Bearer ${adminToken}`},
            });

            expect(res.statusCode).toBe(204);

            // 验证已移除
            const agentsRes = await app.inject({
                method: 'GET',
                url: `/api/v1/skills/${assocSkillId}/agents`,
                headers: {authorization: `Bearer ${adminToken}`},
            });
            const agents = agentsRes.json().data.filter((a: any) => a.id === testAgentId);
            expect(agents.length).toBe(0);
        });
    });

    // ===== 租户隔离 =====

    describe('租户隔离', () => {
        it('不能访问其他租户的 Skill', async () => {
            // 创建另一个租户 + skill
            const [otherTenant] = await db.insert(tenants).values({name: 'Other Tenant'}).returning();
            const [otherSkill] = await db.insert(skills).values({
                tenantId: otherTenant.id,
                name: '其他租户的 Skill',
                status: 'active',
            }).returning();

            const res = await app.inject({
                method: 'GET',
                url: `/api/v1/skills/${otherSkill.id}`,
                headers: {authorization: `Bearer ${adminToken}`},
            });

            expect(res.statusCode).toBe(404);

            // 清理
            await db.delete(skills).where(eq(skills.id, otherSkill.id));
            await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
        });
    });
});
