/**
 * 测试辅助工具
 *
 * 提供测试 app 实例创建和测试工具函数
 */

import {createApp} from '../src/index';
import type {FastifyInstance} from 'fastify';
import {db, tenants} from '../src/db';

/**
 * 测试配置
 */
export const TEST_CONFIG = {
    server: {
        host: '127.0.0.1',
        port: 0, // 随机端口，避免冲突
    },
};

/**
 * 创建测试 app 实例
 *
 * 注意：此函数创建的 app 不会自动监听端口，
 * 测试代码需要使用 app.inject() 方法发送请求
 *
 * 重要：在创建 app 前重置 ThreadManager 单例，
 * 确保测试设置的 DATA_ROOT 环境变量生效
 */
export async function createTestApp(): Promise<FastifyInstance> {
    // 重置 ThreadManager 单例，确保使用新的 DATA_ROOT
    const {resetThreadManager} = await import('../src/services/thread-manager');
    resetThreadManager();

    const app = await createApp();
    return app;
}

/**
 * 测试用户数据
 */
export const TEST_USERS = {
    admin: {
        name: 'Test Admin',
        email: 'admin@test.com',
        password: 'admin123',
        role: 'admin',
    },
    user: {
        name: 'Test User',
        email: 'user@test.com',
        password: 'user123',
        role: 'user',
    },
};

/**
 * 测试租户数据
 */
export const TEST_TENANT = {
    name: 'Test Tenant',
};

/**
 * 测试 Agent 模板数据
 */
export const TEST_AGENT_TEMPLATE = {
    name: 'Test Agent',
    description: 'A test agent for integration testing',
    systemPrompt: 'You are a helpful test assistant.',
    modelConfig: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        temperature: 0.7,
        maxTokens: 4096,
    },
    tools: [],
    skills: [],
    mcpServers: [],
    constraints: {
        maxTokensPerTurn: 10000,
        maxTurnsPerSession: 100,
        maxConcurrentSessions: 10,
    },
};

/**
 * 创建测试用户并返回 token
 *
 * 如果用户已存在，直接登录返回 token
 */
export async function createTestUser(
    app: FastifyInstance,
    role: 'admin' | 'user' = 'user'
): Promise<{ user: Record<string, unknown>; token: string }> {
    const baseUserData = role === 'admin' ? TEST_USERS.admin : TEST_USERS.user;
    const suffix = Math.random().toString(36).slice(2, 10);
    const userData = {
        ...baseUserData,
        name: `${baseUserData.name} ${suffix}`,
        email: `${role}-${suffix}@test.com`,
    };

    const tenantPayload = role === 'admin'
        ? {tenantName: `${TEST_TENANT.name} ${suffix}`}
        : {
            tenantId: (await db.insert(tenants)
                .values({name: `${TEST_TENANT.name} ${suffix}`})
                .returning())[0].id,
        };

    // 先尝试注册用户
    const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
            ...tenantPayload,
            ...userData,
        },
    });

    // 如果注册失败（邮箱已存在），直接登录
    if (registerResponse.statusCode !== 201) {
        const loginResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                email: userData.email,
                password: userData.password,
            },
        });

        if (loginResponse.statusCode !== 200) {
            throw new Error(`Failed to login test user: ${loginResponse.payload}`);
        }

        const loginData = loginResponse.json();

        // 获取用户信息
        const meResponse = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/me',
            headers: {
                authorization: `Bearer ${loginData.accessToken}`,
            },
        });

        return {
            user: meResponse.json(),
            token: loginData.accessToken,
        };
    }

    const registerData = registerResponse.json();

    // 登录获取 token
    const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
            email: userData.email,
            password: userData.password,
        },
    });

    if (loginResponse.statusCode !== 200) {
        throw new Error(`Failed to login test user: ${loginResponse.payload}`);
    }

    const loginData = loginResponse.json();

    return {
        user: registerData.user,
        token: loginData.accessToken,
    };
}

/**
 * 解析 JWT token 获取 payload（用于测试验证）
 */
export function parseJwt(token: string): Record<string, unknown> {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
        atob(base64)
            .split('')
            .map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
            .join('')
    );
    return JSON.parse(jsonPayload);
}

/**
 * 清理测试数据的辅助函数
 * 注意：这需要在测试结束后手动调用
 */
export async function cleanupTestData(app: FastifyInstance): Promise<void> {
    // 这里可以添加清理逻辑，比如删除测试用户、租户等
    // 由于数据库操作的复杂性，建议使用测试数据库事务回滚
}
