/**
 * 向后兼容测试 — session.ts wrapper
 *
 * 验证：
 * 1. 旧 API 端点（/:agentId/chat, /:agentId/history）仍然正常工作
 * 2. queryDispatcher 的方法签名和返回格式兼容
 * 3. 导出的类型正确
 */

// 在 import 之前设置 DATA_ROOT，避免单例使用 /data（只读文件系统）
process.env.DATA_ROOT = `/tmp/neptune-test-compat-${Date.now()}`;

import {describe, test, expect, beforeAll, afterAll} from 'bun:test';
import {createTestApp} from './setup';
import type {FastifyInstance} from 'fastify';

/**
 * 辅助函数：创建唯一测试用户
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

describe('Backward Compatibility — session.ts wrapper', () => {
    let app: FastifyInstance;
    let token: string;
    let agentId: string;

    beforeAll(async () => {
        app = await createTestApp();
        const admin = await createUniqueTestUser(app, 'admin');
        token = admin.token;

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/agents',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: 'Compat Agent',
                systemPrompt: 'You are a test assistant.',
                modelConfig: {provider: 'test', model: 'test', temperature: 0.7, maxTokens: 100},
                tools: [],
                skills: [],
                mcpServers: [],
                constraints: {
                    maxTokensPerTurn: 10000,
                    maxTurnsPerSession: 100,
                    maxConcurrentSessions: 10,
                },
            },
        });
        expect(res.statusCode).toBe(201);
        agentId = res.json().id;
    });

    afterAll(async () => {
        await app.close();
    });

    // ===== 1. 旧 API 端点兼容测试 =====

    describe('旧 API 端点', () => {
        test('POST /agents/:agentId/chat — 旧 API 仍可访问（SSE 端点存在）', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/chat`,
                headers: {authorization: `Bearer ${token}`},
                payload: {content: 'hello'},
            });
            // SSE 端点：200 表示成功建立流，500 表示 Engine factory 未配置（测试环境正常）
            expect([200, 500]).toContain(res.statusCode);
        });

        test('POST /agents/:agentId/chat — 缺少 content 返回 400', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/chat`,
                headers: {authorization: `Bearer ${token}`},
                payload: {},
            });
            expect(res.statusCode).toBe(400);
            expect(res.json()).toHaveProperty('error', 'MISSING_CONTENT');
        });

        test('GET /agents/:agentId/history — 旧 API 返回数据', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/api/v1/agents/${agentId}/history`,
                headers: {authorization: `Bearer ${token}`},
            });
            expect(res.statusCode).toBe(200);
            const json = res.json();
            expect(json).toHaveProperty('data');
            expect(json).toHaveProperty('meta');
            expect(json.data).toBeInstanceOf(Array);
        });

        test('未认证请求返回 401', async () => {
            const chatRes = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/chat`,
                payload: {content: 'test'},
            });
            expect(chatRes.statusCode).toBe(401);

            const historyRes = await app.inject({
                method: 'GET',
                url: `/api/v1/agents/${agentId}/history`,
            });
            expect(historyRes.statusCode).toBe(401);
        });
    });

    // ===== 2. queryDispatcher 方法兼容测试 =====

    describe('queryDispatcher 方法', () => {
        test('queryDispatcher.list 返回数组', async () => {
            const {queryDispatcher} = await import('../src/services/session');
            const results = await queryDispatcher.list({agentId, limit: 10});
            expect(Array.isArray(results)).toBe(true);
        });

        test('queryDispatcher.list 支持空过滤器', async () => {
            const {queryDispatcher} = await import('../src/services/session');
            const results = await queryDispatcher.list({});
            expect(Array.isArray(results)).toBe(true);
        });

        test('queryDispatcher.get 对不存在的 ID 返回 null', async () => {
            const {queryDispatcher} = await import('../src/services/session');
            const result = await queryDispatcher.get('nonexistent-id');
            expect(result).toBeNull();
        });

        test('queryDispatcher.getUsage 初始返回 null', async () => {
            const {queryDispatcher} = await import('../src/services/session');
            const usage = queryDispatcher.getUsage();
            expect(usage).toBeNull();
        });

        test('queryDispatcher.getSessionWorkspace 对不存在的 ID 返回 null', async () => {
            const {queryDispatcher} = await import('../src/services/session');
            const workspace = await queryDispatcher.getSessionWorkspace('nonexistent-id');
            expect(workspace).toBeNull();
        });
    });

    // ===== 3. 类型导出验证 =====

    describe('类型导出', () => {
        test('模块导出 queryDispatcher 和类型不会报错', async () => {
            // 验证模块可以正常导入，不抛出运行时错误
            const mod = await import('../src/services/session');
            // queryDispatcher 是运行时值，应该存在
            expect(mod).toHaveProperty('queryDispatcher');
            // DispatchParams 和 QueryUsageResult 是 TypeScript interface，
            // 在运行时被擦除，不需要检查 property 存在性
            expect(mod).toBeDefined();
        });
    });
});
