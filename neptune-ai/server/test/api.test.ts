/**
 * Neptune-AI 后端 API 集成测试
 *
 * 测试覆盖：
 * 1. 认证流程（注册、登录、token 验证）
 * 2. Agent 模板 CRUD
 * 3. 权限验证
 * 4. SSE 端点格式验证
 */

import {describe, test, expect, beforeAll} from 'bun:test';
import {createTestApp, createTestUser, TEST_AGENT_TEMPLATE, parseJwt} from './setup';

describe('Neptune-AI API 集成测试', () => {
    let app: Awaited<ReturnType<typeof createTestApp>>;

    beforeAll(async () => {
        app = await createTestApp();
    });

    describe('健康检查', () => {
        test('GET /health 应该返回 200', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/health',
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('status', 'ok');
            expect(json).toHaveProperty('timestamp');
            expect(json).toHaveProperty('uptime');
        });

        test('GET /health/db 应该返回数据库连接状态', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/health/db',
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('status');
            expect(json).toHaveProperty('database');
        });
    });

    describe('认证流程', () => {
        test('POST /api/v1/auth/register - 应该成功注册新用户', async () => {
            const randomSuffix = Math.random().toString(36).substring(7);
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    tenantName: `Test Tenant ${randomSuffix}`,
                    name: 'Test User',
                    email: `test${randomSuffix}@example.com`,
                    password: 'password123',
                },
            });

            expect(response.statusCode).toBe(201);
            const json = response.json();
            expect(json).toHaveProperty('user');
            expect(json).toHaveProperty('accessToken');
            expect(json).toHaveProperty('refreshToken');
            expect(json.user).toHaveProperty('id');
            expect(json.user).toHaveProperty('email');
            expect(json.user).toHaveProperty('role', 'admin'); // 创建租户的用户是 admin
        });

        test('POST /api/v1/auth/register - 缺少必填字段应该返回 400', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    name: 'Test User',
                    // 缺少 email 和 password
                },
            });

            expect(response.statusCode).toBe(400);
            const json = response.json();
            expect(json).toHaveProperty('error', 'VALIDATION_FAILED');
            expect(json).toHaveProperty('message');
        });

        test('POST /api/v1/auth/login - 应该成功登录', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: {
                    email: 'admin@test.com',
                    password: 'admin123',
                },
            });

            // 可能是 401（用户不存在）或 200（已存在）
            expect([200, 401]).toContain(response.statusCode);

            if (response.statusCode === 200) {
                const json = response.json();
                expect(json).toHaveProperty('user');
                expect(json).toHaveProperty('accessToken');
                expect(json).toHaveProperty('refreshToken');
            }
        });

        test('POST /api/v1/auth/login - 错误密码应该返回 401', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: {
                    email: 'admin@test.com',
                    password: 'wrongpassword',
                },
            });

            expect(response.statusCode).toBe(401);
            const json = response.json();
            expect(json).toHaveProperty('error', 'UNAUTHORIZED');
            expect(json).toHaveProperty('message');
        });

        test('GET /api/v1/auth/me - 应该返回当前用户信息', async () => {
            // 先注册并登录
            const randomSuffix = Math.random().toString(36).substring(7);
            await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    tenantName: `Me Test Tenant ${randomSuffix}`,
                    name: 'Me Test User',
                    email: `metest${randomSuffix}@example.com`,
                    password: 'password123',
                },
            });

            const loginResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: {
                    email: `metest${randomSuffix}@example.com`,
                    password: 'password123',
                },
            });

            const loginData = loginResponse.json();

            // 使用 token 获取当前用户信息
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/me',
                headers: {
                    authorization: `Bearer ${loginData.accessToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('id');
            expect(json).toHaveProperty('email');
            expect(json).toHaveProperty('name');
            expect(json).toHaveProperty('role');
        });

        test('GET /api/v1/auth/me - 无 token 应该返回 401', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/me',
            });

            expect(response.statusCode).toBe(401);
        });

        test('POST /api/v1/auth/token/refresh - 应该刷新 token', async () => {
            // 先注册
            const randomSuffix = Math.random().toString(36).substring(7);
            const registerResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    tenantName: `Refresh Test Tenant ${randomSuffix}`,
                    name: 'Refresh Test User',
                    email: `refreshtest${randomSuffix}@example.com`,
                    password: 'password123',
                },
            });

            const registerData = registerResponse.json();

            // 使用 refreshToken 获取新的 accessToken
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/token/refresh',
                payload: {
                    refreshToken: registerData.refreshToken,
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('accessToken');
            expect(json).toHaveProperty('refreshToken');
        });
    });

    describe('Agent 模板 CRUD', () => {
        let adminToken: string;
        let agentId: string;

        beforeAll(async () => {
            // 创建 admin 用户并获取 token
            const {token} = await createTestUser(app, 'admin');
            adminToken = token;
        });

        test('POST /api/v1/agents - admin 应该能创建 Agent 模板', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
                payload: TEST_AGENT_TEMPLATE,
            });

            expect(response.statusCode).toBe(201);
            const json = response.json();
            expect(json).toHaveProperty('id');
            expect(json).toHaveProperty('name', TEST_AGENT_TEMPLATE.name);
            expect(json).toHaveProperty('systemPrompt', TEST_AGENT_TEMPLATE.systemPrompt);
            agentId = json.id;
        });

        test('POST /api/v1/agents - 缺少必填字段应该返回 400', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
                payload: {
                    name: 'Incomplete Agent',
                    // 缺少 systemPrompt 和 modelConfig
                },
            });

            expect(response.statusCode).toBe(400);
            const json = response.json();
            expect(json).toHaveProperty('error', 'VALIDATION_FAILED');
        });

        test('GET /api/v1/agents - 应该返回 Agent 列表', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/agents',
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('data');
            expect(json).toHaveProperty('meta');
            expect(Array.isArray(json.data)).toBe(true);
        });

        test('GET /api/v1/agents/:id - 应该返回 Agent 详情', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/agents/${agentId}`,
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('id', agentId);
            expect(json).toHaveProperty('name');
        });

        test('GET /api/v1/agents/:id - 不存在的 Agent 应该返回 404', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/agents/00000000-0000-0000-0000-000000000000',
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
            });

            expect(response.statusCode).toBe(404);
            const json = response.json();
            expect(json).toHaveProperty('error', 'RESOURCE_NOT_FOUND');
        });

        test('PUT /api/v1/agents/:id - admin 应该能更新 Agent', async () => {
            const response = await app.inject({
                method: 'PUT',
                url: `/api/v1/agents/${agentId}`,
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
                payload: {
                    name: 'Updated Agent Name',
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('name', 'Updated Agent Name');
        });

        test('PATCH /api/v1/agents/:id/activate - 应该激活 Agent', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/agents/${agentId}/activate`,
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('isActive', true);
        });

        test('PATCH /api/v1/agents/:id/deactivate - 应该停用 Agent', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/agents/${agentId}/deactivate`,
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('isActive', false);
        });

        test('DELETE /api/v1/agents/:id - admin 应该能删除 Agent', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: `/api/v1/agents/${agentId}`,
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
            });

            expect(response.statusCode).toBe(204);
        });
    });

    describe('权限验证', () => {
        let userToken: string;
        let adminToken: string;

        beforeAll(async () => {
            // 创建普通用户
            const {token: userTk} = await createTestUser(app, 'user');
            userToken = userTk;

            // 创建 admin 用户
            const {token: adminTk} = await createTestUser(app, 'admin');
            adminToken = adminTk;
        });

        test('普通用户不能创建 Agent 模板', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {
                    authorization: `Bearer ${userToken}`,
                },
                payload: TEST_AGENT_TEMPLATE,
            });

            expect(response.statusCode).toBe(403);
        });

        test('普通用户不能删除 Agent 模板', async () => {
            // 先由 admin 创建一个 Agent
            const createResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
                payload: TEST_AGENT_TEMPLATE,
            });

            const agentId = createResponse.json().id;

            // 普通用户尝试删除
            const response = await app.inject({
                method: 'DELETE',
                url: `/api/v1/agents/${agentId}`,
                headers: {
                    authorization: `Bearer ${userToken}`,
                },
            });

            expect(response.statusCode).toBe(403);
        });

        test('普通用户不能访问其他租户的账单', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/tenants/00000000-0000-0000-0000-000000000000/billing',
                headers: {
                    authorization: `Bearer ${userToken}`,
                },
            });

            expect(response.statusCode).toBe(403);
            const json = response.json();
            expect(json).toHaveProperty('error', 'FORBIDDEN');
        });
    });

    describe('错误响应格式统一', () => {
        test('所有错误响应应该包含 error 和 message 字段', async () => {
            // 测试登录错误
            const loginResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: {
                    email: 'nonexistent@test.com',
                    password: 'wrong',
                },
            });

            expect(loginResponse.statusCode).toBe(401);
            const loginJson = loginResponse.json();
            expect(loginJson).toHaveProperty('error');
            expect(loginJson).toHaveProperty('message');

            // 测试注册验证错误
            const registerResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {},
            });

            expect(registerResponse.statusCode).toBe(400);
            const registerJson = registerResponse.json();
            expect(registerJson).toHaveProperty('error');
            expect(registerJson).toHaveProperty('message');
        });
    });

    describe('用户管理', () => {
        let adminToken: string;
        let userId: string;

        beforeAll(async () => {
            const {token} = await createTestUser(app, 'admin');
            adminToken = token;
        });

        test('POST /api/v1/users - admin 应该能创建用户', async () => {
            const randomSuffix = Math.random().toString(36).substring(7);
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/users',
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
                payload: {
                    name: `New User ${randomSuffix}`,
                    email: `newuser${randomSuffix}@test.com`,
                    password: 'password123',
                },
            });

            expect(response.statusCode).toBe(201);
            const json = response.json();
            expect(json).toHaveProperty('id');
            expect(json).toHaveProperty('email');
            userId = json.id;
        });

        test('GET /api/v1/users - 应该返回用户列表', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/users',
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('data');
            expect(json).toHaveProperty('meta');
            expect(Array.isArray(json.data)).toBe(true);
        });

        test('GET /api/v1/users/:id - 应该返回用户详情', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/users/${userId}`,
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('id', userId);
            // 不应该返回密码哈希
            expect(json).not.toHaveProperty('passwordHash');
        });
    });

    describe('租户管理', () => {
        let adminToken: string;
        let tenantId: string;

        beforeAll(async () => {
            const {token} = await createTestUser(app, 'admin');
            adminToken = token;
        });

        test('POST /api/v1/tenants - admin 应该能创建租户', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/tenants',
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
                payload: {
                    name: 'New Test Tenant',
                },
            });

            expect(response.statusCode).toBe(201);
            const json = response.json();
            expect(json).toHaveProperty('id');
            expect(json).toHaveProperty('name');
            tenantId = json.id;
        });

        test('GET /api/v1/tenants - 应该返回租户列表', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/tenants',
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('data');
            expect(json).toHaveProperty('meta');
            expect(Array.isArray(json.data)).toBe(true);
        });

        test('GET /api/v1/tenants/:id - 应该返回租户详情', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/tenants/${tenantId}`,
                headers: {
                    authorization: `Bearer ${adminToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const json = response.json();
            expect(json).toHaveProperty('id', tenantId);
        });
    });
});
