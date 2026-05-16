/**
 * 旧 API 兼容性测试
 *
 * 测试覆盖：
 * 1. POST /agents/:agentId/chat — 旧对话接口（自动创建/查找 Thread）
 * 2. GET /agents/:agentId/history — 旧历史接口（查找最新 Thread）
 * 3. 参数验证（400/401）
 *
 * 注意：不测试实际 SSE 流内容（Engine SDK 不可用于测试环境），
 * 只验证路由存在、参数验证和响应格式兼容。
 */

// 在 import createTestApp 之前设置 DATA_ROOT，避免单例使用 /data（只读文件系统）
process.env.DATA_ROOT = `/tmp/neptune-test-compat-${Date.now()}`;

import {describe, test, expect, beforeAll, afterAll} from 'bun:test';
import {createTestApp, TEST_AGENT_TEMPLATE} from './setup';
import type {FastifyInstance} from 'fastify';

/**
 * 辅助函数：创建唯一测试用户并获取 token
 */
async function createUniqueTestUser(
    app: FastifyInstance,
    role: 'admin' | 'user',
): Promise<{ token: string; userId: string; tenantId: string }> {
    const suffix = Math.random().toString(36).substring(2, 8);
    const email = `compat-test-${role}-${suffix}@test.com`;

    const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
            tenantName: `Compat Test Tenant ${suffix}`,
            name: `Compat Test ${role} ${suffix}`,
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

describe('旧 API 兼容性', () => {
    let app: FastifyInstance;
    let adminToken: string;
    let adminTenantId: string;
    let userToken: string;
    let agentId: string;

    beforeAll(async () => {
        app = await createTestApp();

        // 创建 admin 用户
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
                name: `Compat Test User ${suffix}`,
                email: `compat-test-user-${suffix}@test.com`,
                password: 'password123',
            },
        });
        const userData = userRegisterResponse.json();
        userToken = userData.accessToken;

        // 创建测试 Agent
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/agents',
            headers: {authorization: `Bearer ${adminToken}`},
            payload: TEST_AGENT_TEMPLATE,
        });
        agentId = res.json().id;
    });

    afterAll(async () => {
        await app.close();
    });

    // ===== POST /agents/:agentId/chat =====
    describe('POST /agents/:agentId/chat — 旧对话接口', () => {
        test('缺少 content 应该返回 400', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/chat`,
                headers: {authorization: `Bearer ${userToken}`},
                payload: {},
            });
            expect(res.statusCode).toBe(400);
            const body = res.json();
            expect(body).toHaveProperty('error', 'MISSING_CONTENT');
        });

        test('未认证应该返回 401', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/chat`,
                payload: {content: 'hello'},
            });
            expect(res.statusCode).toBe(401);
        });

        test('content 为空字符串应该返回 400', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/chat`,
                headers: {authorization: `Bearer ${userToken}`},
                payload: {content: ''},
            });
            expect(res.statusCode).toBe(400);
        });

        test('路由存在（有 Engine factory 时返回 SSE 流或 500，不是 404）', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/chat`,
                headers: {authorization: `Bearer ${userToken}`},
                payload: {content: 'hello'},
            });
            // 没有 real Engine，可能 200（SSE 错误流）或 500，但不应是 404
            expect(res.statusCode).not.toBe(404);
        });
    });

    // ===== GET /agents/:agentId/history =====
    describe('GET /agents/:agentId/history — 旧历史接口', () => {
        test('应该返回 200 和空历史（新用户无 Thread）', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/api/v1/agents/${agentId}/history`,
                headers: {authorization: `Bearer ${userToken}`},
            });
            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body).toHaveProperty('data');
            expect(body).toHaveProperty('meta');
            expect(Array.isArray(body.data)).toBe(true);
        });

        test('未认证应该返回 401', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/api/v1/agents/${agentId}/history`,
            });
            expect(res.statusCode).toBe(401);
        });

        test('无 Thread 时返回空 data 和 message 提示', async () => {
            // 创建新的用户，确保没有任何 Thread
            const freshUser = await createUniqueTestUser(app, 'user');

            const res = await app.inject({
                method: 'GET',
                url: `/api/v1/agents/${agentId}/history`,
                headers: {authorization: `Bearer ${freshUser.token}`},
            });
            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(body.data).toEqual([]);
            expect(body.meta).toHaveProperty('message', 'No thread found');
        });
    });

    // ===== 兼容性验证 =====
    describe('旧 API 与新 Thread API 共存', () => {
        test('旧 chat 路由和新 thread chat 路由都存在', async () => {
            // 旧路由: POST /agents/:agentId/chat
            const oldRes = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/chat`,
                headers: {authorization: `Bearer ${userToken}`},
                payload: {},
            });
            // 400 因为缺少 content，不是 404
            expect(oldRes.statusCode).toBe(400);

            // 新路由: POST /agents/:agentId/threads/:threadId/chat
            // 随机 threadId，应该是 404（不是路由不存在）
            const newRes = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads/00000000-0000-0000-0000-000000000000/chat`,
                headers: {authorization: `Bearer ${userToken}`},
                payload: {content: 'test'},
            });
            expect(newRes.statusCode).toBe(404);
        });

        test('旧 history 和新 thread history 都存在', async () => {
            // 旧路由: GET /agents/:agentId/history
            const oldRes = await app.inject({
                method: 'GET',
                url: `/api/v1/agents/${agentId}/history`,
                headers: {authorization: `Bearer ${userToken}`},
            });
            expect(oldRes.statusCode).toBe(200);

            // 新路由: GET /agents/:agentId/threads/:threadId/history
            const newRes = await app.inject({
                method: 'GET',
                url: `/api/v1/agents/${agentId}/threads/00000000-0000-0000-0000-000000000000/history`,
                headers: {authorization: `Bearer ${userToken}`},
            });
            expect(newRes.statusCode).toBe(404);
        });
    });
});
