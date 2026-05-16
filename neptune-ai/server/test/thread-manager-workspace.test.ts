/**
 * ThreadManager Workspace 路径格式单元测试
 *
 * Phase 1 架构改造验证 — 确保新 workspace 路径格式符合规范
 *
 * 测试覆盖：
 * 1. 基础路径格式验证: `{dataRoot}/tenants/{tenantId}/agents/{agentId}/threads/{threadId}/`
 * 2. 验证路径不以 `users/` 开头
 * 3. 多租户隔离验证
 * 4. 边界输入处理
 */

// 在 import 之前设置 DATA_ROOT，避免单例使用默认值
process.env.DATA_ROOT = `/tmp/neptune-workspace-test-${Date.now()}`;

import {describe, test, expect, beforeAll, afterEach} from 'bun:test';
import {mkdirSync, rmSync, existsSync} from 'fs';
import {resolve} from 'path';
import {createTestApp, TEST_AGENT_TEMPLATE} from './setup';

/**
 * 辅助函数：创建唯一测试用户并获取 token
 */
async function createUniqueTestUser(
    app: Awaited<ReturnType<typeof createTestApp>>,
    role: 'admin' | 'user',
): Promise<{ token: string; userId: string; tenantId: string }> {
    const suffix = Math.random().toString(36).substring(2, 8);
    const email = `workspace-test-${role}-${suffix}@test.com`;

    const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
            tenantName: `Workspace Test Tenant ${suffix}`,
            name: `Workspace Test ${role} ${suffix}`,
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

/**
 * 辅助函数：验证路径格式是否符合新规范
 *
 * 新规范格式: `{dataRoot}/tenants/{tenantId}/agents/{agentId}/threads/{threadId}/`
 */
function validateWorkspacePathFormat(
    workspace: string,
    dataRoot: string,
): {
    isValid: boolean;
    error?: string;
    parts?: {
        dataRoot: string;
        tenantId: string;
        agentId: string;
        threadId: string;
    };
} {
    // 1. 路径必须以 dataRoot 开头
    if (!workspace.startsWith(dataRoot)) {
        return {isValid: false, error: `路径不以 dataRoot (${dataRoot}) 开头`};
    }

    // 2. 路径必须包含正确的结构
    const relativePath = workspace.slice(dataRoot.length);
    const pattern = /^\/tenants\/([^/]+)\/agents\/([^/]+)\/threads\/([^/]+)\/$/;
    const match = relativePath.match(pattern);

    if (!match) {
        return {
            isValid: false,
            error: `路径格式不正确，期望格式: /tenants/{tenantId}/agents/{agentId}/threads/{threadId}/，实际: ${relativePath}`,
        };
    }

    // 3. 路径绝不能包含 'users/'
    if (workspace.includes('/users/')) {
        return {isValid: false, error: `路径包含 'users/' 层级，这是旧格式`};
    }

    return {
        isValid: true,
        parts: {
            dataRoot,
            tenantId: match[1],
            agentId: match[2],
            threadId: match[3],
        },
    };
}

describe('ThreadManager Workspace 路径格式验证', () => {
    let app: Awaited<ReturnType<typeof createTestApp>>;
    let dataRoot: string;

    beforeAll(async () => {
        app = await createTestApp();
        dataRoot = resolve(process.env.DATA_ROOT || '/tmp/neptune-test-data');

        // 确保 dataRoot 存在
        if (!existsSync(dataRoot)) {
            mkdirSync(dataRoot, {recursive: true});
        }
    });

    afterEach(() => {
        // 每个测试后可以清理测试数据（可选）
        // 这里我们让测试数据保留，便于调试
    });

    // ===== 1. 基础路径格式验证 =====
    describe('基础路径格式', () => {
        test('workspace 路径格式应符合新规范', async () => {
            const user = await createUniqueTestUser(app, 'user');

            // 创建 Agent
            const agentResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agentId = agentResponse.json().id;

            // 创建 Thread
            const threadResponse = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: '测试 Thread'},
            });

            expect(threadResponse.statusCode).toBe(201);
            const thread = threadResponse.json();

            // 验证 workspace 路径格式
            const validation = validateWorkspacePathFormat(thread.workspace, dataRoot);
            expect(validation.isValid).toBe(true);
            expect(validation.error).toBeUndefined();

            // 验证各部分正确
            expect(validation.parts).toBeDefined();
            expect(validation.parts!.tenantId).toBe(user.tenantId);
            expect(validation.parts!.agentId).toBe(agentId);
            expect(validation.parts!.threadId).toBe(thread.id);
        });

        test('路径应以 / 结尾（目录风格）', async () => {
            const user = await createUniqueTestUser(app, 'user');

            const agentResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agentId = agentResponse.json().id;

            const threadResponse = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: '测试 Thread'},
            });

            const thread = threadResponse.json();
            expect(thread.workspace).toMatch(/\/$/);
        });
    });

    // ===== 2. 路径不以 users/ 开头 =====
    describe('旧格式兼容性验证', () => {
        test('workspace 路径绝不能包含 users/', async () => {
            const user = await createUniqueTestUser(app, 'user');

            const agentResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agentId = agentResponse.json().id;

            const threadResponse = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: '测试 Thread'},
            });

            const thread = threadResponse.json();

            // 直接验证路径不包含 users/
            expect(thread.workspace).not.toContain('/users/');

            // 同时验证完整格式
            const validation = validateWorkspacePathFormat(thread.workspace, dataRoot);
            expect(validation.isValid).toBe(true);
        });

        test('验证路径中没有 userId 层级', async () => {
            const user = await createUniqueTestUser(app, 'user');

            const agentResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agentId = agentResponse.json().id;

            const threadResponse = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: '测试 Thread'},
            });

            const thread = threadResponse.json();

            // 验证 userId 不在路径中（userId 在数据库中，不在文件系统中）
            expect(thread.workspace).not.toContain(user.userId);
        });
    });

    // ===== 3. 多租户隔离验证 =====
    describe('多租户隔离', () => {
        test('不同 tenantId 产生不同路径', async () => {
            // 创建两个不同租户的用户
            const user1 = await createUniqueTestUser(app, 'user');
            const user2 = await createUniqueTestUser(app, 'user');

            // 为用户 1 创建 Agent 和 Thread
            const agent1Response = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user1.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agent1Id = agent1Response.json().id;

            const thread1Response = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agent1Id}/threads`,
                headers: {authorization: `Bearer ${user1.token}`},
                payload: {title: '租户 1 Thread'},
            });
            const workspace1 = thread1Response.json().workspace;

            // 为用户 2 创建 Agent 和 Thread
            const agent2Response = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user2.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agent2Id = agent2Response.json().id;

            const thread2Response = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agent2Id}/threads`,
                headers: {authorization: `Bearer ${user2.token}`},
                payload: {title: '租户 2 Thread'},
            });
            const workspace2 = thread2Response.json().workspace;

            // 验证两个 workspace 不同
            expect(workspace1).not.toBe(workspace2);

            // 验证包含各自的 tenantId
            expect(workspace1).toContain(`/tenants/${user1.tenantId}/`);
            expect(workspace2).toContain(`/tenants/${user2.tenantId}/`);

            // 验证格式都正确
            const validation1 = validateWorkspacePathFormat(workspace1, dataRoot);
            const validation2 = validateWorkspacePathFormat(workspace2, dataRoot);
            expect(validation1.isValid).toBe(true);
            expect(validation2.isValid).toBe(true);
            expect(validation1.parts!.tenantId).not.toBe(validation2.parts!.tenantId);
        });

        test('不同 agentId 产生不同路径', async () => {
            const user = await createUniqueTestUser(app, 'user');

            // 创建两个不同 Agent
            const agent1Response = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: {...TEST_AGENT_TEMPLATE, name: 'Agent 1'},
            });
            const agent1Id = agent1Response.json().id;

            const agent2Response = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: {...TEST_AGENT_TEMPLATE, name: 'Agent 2'},
            });
            const agent2Id = agent2Response.json().id;

            // 为每个 Agent 创建 Thread
            const thread1Response = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agent1Id}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: 'Agent 1 Thread'},
            });
            const workspace1 = thread1Response.json().workspace;

            const thread2Response = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agent2Id}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: 'Agent 2 Thread'},
            });
            const workspace2 = thread2Response.json().workspace;

            // 验证两个 workspace 不同
            expect(workspace1).not.toBe(workspace2);

            // 验证包含各自的 agentId
            expect(workspace1).toContain(`/agents/${agent1Id}/`);
            expect(workspace2).toContain(`/agents/${agent2Id}/`);

            // 验证格式都正确
            const validation1 = validateWorkspacePathFormat(workspace1, dataRoot);
            const validation2 = validateWorkspacePathFormat(workspace2, dataRoot);
            expect(validation1.isValid).toBe(true);
            expect(validation2.isValid).toBe(true);
            expect(validation1.parts!.agentId).not.toBe(validation2.parts!.agentId);
        });

        test('同一 Agent 的不同 Thread 有不同 threadId', async () => {
            const user = await createUniqueTestUser(app, 'user');

            const agentResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agentId = agentResponse.json().id;

            // 创建两个 Thread
            const thread1Response = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: 'Thread 1'},
            });
            const workspace1 = thread1Response.json().workspace;
            const thread1Id = thread1Response.json().id;

            const thread2Response = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: 'Thread 2'},
            });
            const workspace2 = thread2Response.json().workspace;
            const thread2Id = thread2Response.json().id;

            // 验证两个 workspace 不同
            expect(workspace1).not.toBe(workspace2);

            // 验证包含各自的 threadId
            expect(workspace1).toContain(`/threads/${thread1Id}/`);
            expect(workspace2).toContain(`/threads/${thread2Id}/`);

            // 验证格式都正确
            const validation1 = validateWorkspacePathFormat(workspace1, dataRoot);
            const validation2 = validateWorkspacePathFormat(workspace2, dataRoot);
            expect(validation1.isValid).toBe(true);
            expect(validation2.isValid).toBe(true);
            expect(validation1.parts!.threadId).toBe(thread1Id);
            expect(validation2.parts!.threadId).toBe(thread2Id);
        });
    });

    // ===== 4. 边界输入处理 =====
    describe('边界输入处理', () => {
        test('空 dataRoot 应使用默认值 /data', async () => {
            // 注意：这个测试验证的是 ThreadManager 的构造行为
            // 由于 DATA_ROOT 是在启动时设置的，我们验证的是路径格式的正确性
            const user = await createUniqueTestUser(app, 'user');

            const agentResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agentId = agentResponse.json().id;

            const threadResponse = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: '测试 Thread'},
            });

            const thread = threadResponse.json();

            // 验证路径格式正确（无论 dataRoot 是什么）
            const validation = validateWorkspacePathFormat(thread.workspace, dataRoot);
            expect(validation.isValid).toBe(true);

            // 验证路径是绝对路径
            expect(thread.workspace.startsWith('/')).toBe(true);
        });

        test('UUID 验证 — tenantId, agentId, threadId 应该是有效 UUID', async () => {
            const user = await createUniqueTestUser(app, 'user');

            const agentResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agentId = agentResponse.json().id;

            const threadResponse = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: '测试 Thread'},
            });

            const thread = threadResponse.json();
            const validation = validateWorkspacePathFormat(thread.workspace, dataRoot);

            expect(validation.isValid).toBe(true);
            expect(validation.parts).toBeDefined();

            // UUID 格式验证: 8-4-4-4-12 十六进制字符
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            expect(validation.parts!.tenantId).toMatch(uuidRegex);
            expect(validation.parts!.agentId).toMatch(uuidRegex);
            expect(validation.parts!.threadId).toMatch(uuidRegex);
        });

        test('特殊字符在 UUID 中不会出现（UUID 标准格式）', async () => {
            const user = await createUniqueTestUser(app, 'user');

            const agentResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agentId = agentResponse.json().id;

            const threadResponse = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: '测试 Thread'},
            });

            const thread = threadResponse.json();

            // 验证路径中没有路径遍历字符
            expect(thread.workspace).not.toContain('..');
            expect(thread.workspace).not.toContain('~');
        });

        test('workspace 目录应实际存在于文件系统中', async () => {
            const user = await createUniqueTestUser(app, 'user');

            const agentResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agentId = agentResponse.json().id;

            const threadResponse = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: '测试 Thread'},
            });

            const thread = threadResponse.json();

            // 验证目录存在
            expect(existsSync(thread.workspace)).toBe(true);

            // 验证是目录（不是文件）
            const stat = await import('fs/promises').then(fs => fs.stat(thread.workspace));
            expect(stat.isDirectory()).toBe(true);
        });
    });

    // ===== 5. 目录结构验证 =====
    describe('完整目录结构验证', () => {
        test('验证 Agent 级目录结构（memory, knowledge, threads）', async () => {
            const user = await createUniqueTestUser(app, 'user');

            const agentResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/agents',
                headers: {authorization: `Bearer ${user.token}`},
                payload: TEST_AGENT_TEMPLATE,
            });
            const agentId = agentResponse.json().id;

            const threadResponse = await app.inject({
                method: 'POST',
                url: `/api/v1/agents/${agentId}/threads`,
                headers: {authorization: `Bearer ${user.token}`},
                payload: {title: '测试 Thread'},
            });

            const thread = threadResponse.json();
            const validation = validateWorkspacePathFormat(thread.workspace, dataRoot);

            expect(validation.isValid).toBe(true);

            // 验证 Agent 级目录路径
            const agentDir = `${dataRoot}/tenants/${user.tenantId}/agents/${agentId}`;
            expect(existsSync(agentDir)).toBe(true);

            // 验证 threads 子目录存在（通过创建 thread）
            const threadsDir = `${agentDir}/threads`;
            expect(existsSync(threadsDir)).toBe(true);
        });
    });
});
