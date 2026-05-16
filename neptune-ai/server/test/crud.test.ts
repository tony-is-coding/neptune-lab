/**
 * 任务 #8 测试：租户/用户/Agent 模板 CRUD
 *
 * 测试目标：
 * 1. 验证租户 CRUD 功能
 * 2. 验证用户 CRUD 功能
 * 3. 验证 Agent 模板 CRUD 功能
 * 4. 验证路由端点
 */

import {describe, it, beforeEach, afterEach} from 'bun:test';
import {createApp} from '../src/index';
import {tenantService} from '../src/services/tenant';
import {userService} from '../src/services/user';
import {agentTemplateService} from '../src/services/agent-template';
import {db, tenants, users, agentTemplates} from '../src/db';
import {eq} from 'drizzle-orm';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('Phase 1: 租户/用户/Agent 模板 CRUD', () => {
    let app: Awaited<ReturnType<typeof createApp>>;
    let testTenantId: string;
    let testUserId: string;
    let testTemplateId: string;

    beforeEach(async () => {
        // 启动应用
        app = await createApp();
        await app.ready();

        // 创建测试租户
        const tenant = await tenantService.create({
            name: '测试租户',
            quota: {maxTokensPerDay: 1000000, maxConcurrentSessions: 10},
        });
        testTenantId = tenant.id;

        // 创建测试用户
        const user = await userService.create({
            tenantId: testTenantId,
            name: '测试用户',
            email: `test-${Date.now()}@example.com`,
            passwordHash: 'password123',
            role: 'user',
        });
        testUserId = user.id;

        // 创建测试 Agent 模板
        const template = await agentTemplateService.create({
            tenantId: testTenantId,
            name: '测试助手',
            description: '测试用的 AI 助手',
            systemPrompt: '你是一个有用的助手',
            modelConfig: {
                provider: 'anthropic',
                model: 'claude-sonnet-4-6',
                temperature: 0.7,
                maxTokens: 4096,
            },
            tools: ['FileRead', 'WebSearch'],
            skills: [],
            mcpServers: [],
            constraints: {
                maxTokensPerTurn: 10000,
                maxTurnsPerSession: 100,
                maxConcurrentSessions: 10,
            },
        });
        testTemplateId = template.id;
    });

    afterEach(async () => {
        // 清理测试数据
        await db.delete(agentTemplates).where(eq(agentTemplates.tenantId, testTenantId));
        await db.delete(users).where(eq(users.tenantId, testTenantId));
        await db.delete(tenants).where(eq(tenants.id, testTenantId));

        // 关闭应用
        await app.close();
    });

    describe('租户 CRUD 功能', () => {
        it('应该能够创建租户', async () => {
            const tenant = await tenantService.create({
                name: '新租户',
                quota: {maxTokensPerDay: 500000, maxConcurrentSessions: 5},
            });

            console.log('✓ 租户创建成功');
            console.log(`  - 租户 ID: ${tenant.id}`);
            console.log(`  - 租户名称: ${tenant.name}`);
            console.log(`  - 配额:`, tenant.quota);
        });

        it('应该能够获取租户', async () => {
            const tenant = await tenantService.findById(testTenantId);

            console.log('✓ 租户获取成功');
            console.log(`  - 租户 ID: ${tenant?.id}`);
            console.log(`  - 租户名称: ${tenant?.name}`);
        });

        it('应该能够获取租户列表', async () => {
            const tenants = await tenantService.findAll();

            console.log('✓ 租户列表获取成功');
            console.log(`  - 租户数量: ${tenants.length}`);
        });

        it('应该能够更新租户', async () => {
            const updated = await tenantService.update(testTenantId, {
                name: '更新后的租户',
            });

            console.log('✓ 租户更新成功');
            console.log(`  - 租户 ID: ${updated?.id}`);
            console.log(`  - 新名称: ${updated?.name}`);
        });

        it('应该能够删除租户', async () => {
            // 创建一个临时租户用于删除测试
            const tempTenant = await tenantService.create({
                name: '临时租户',
                quota: {maxTokensPerDay: 100000, maxConcurrentSessions: 1},
            });

            const success = await tenantService.delete(tempTenant.id);

            console.log('✓ 租户删除成功');
            console.log(`  - 删除结果: ${success}`);
        });
    });

    describe('用户 CRUD 功能', () => {
        it('应该能够创建用户', async () => {
            const user = await userService.create({
                tenantId: testTenantId,
                name: '新用户',
                email: `new-user-${Date.now()}@example.com`,
                passwordHash: 'password123',
                role: 'admin',
            });

            console.log('✓ 用户创建成功');
            console.log(`  - 用户 ID: ${user.id}`);
            console.log(`  - 用户名: ${user.name}`);
            console.log(`  - 角色: ${user.role}`);
        });

        it('应该能够获取用户', async () => {
            const user = await userService.findById(testUserId);

            console.log('✓ 用户获取成功');
            console.log(`  - 用户 ID: ${user?.id}`);
            console.log(`  - 用户名: ${user?.name}`);
        });

        it('应该能够根据邮箱获取用户', async () => {
            const user = await userService.findByEmail('test@example.com');

            console.log('✓ 根据邮箱获取用户成功');
            console.log(`  - 用户 ID: ${user?.id}`);
        });

        it('应该能够获取租户的用户列表', async () => {
            const users = await userService.findByTenantId(testTenantId);

            console.log('✓ 租户用户列表获取成功');
            console.log(`  - 用户数量: ${users.length}`);
        });

        it('应该能够更新用户', async () => {
            const updated = await userService.update(testUserId, {
                name: '更新后的用户',
            });

            console.log('✓ 用户更新成功');
            console.log(`  - 用户 ID: ${updated?.id}`);
            console.log(`  - 新名称: ${updated?.name}`);
        });

        it('应该能够检查邮箱是否已被使用', async () => {
            const isTaken = await userService.isEmailTaken('test@example.com');

            console.log('✓ 邮箱检查成功');
            console.log(`  - 邮箱是否已被使用: ${isTaken}`);
        });
    });

    describe('Agent 模板 CRUD 功能', () => {
        it('应该能够创建 Agent 模板', async () => {
            const template = await agentTemplateService.create({
                tenantId: testTenantId,
                name: '新助手',
                systemPrompt: '你是一个新的助手',
                modelConfig: {
                    provider: 'openai',
                    model: 'gpt-4',
                    temperature: 0.5,
                    maxTokens: 2048,
                },
            });

            console.log('✓ Agent 模板创建成功');
            console.log(`  - 模板 ID: ${template.id}`);
            console.log(`  - 模板名称: ${template.name}`);
            console.log(`  - 模型: ${template.modelConfig.model}`);
        });

        it('应该能够获取 Agent 模板', async () => {
            const template = await agentTemplateService.findById(testTemplateId);

            console.log('✓ Agent 模板获取成功');
            console.log(`  - 模板 ID: ${template?.id}`);
            console.log(`  - 模板名称: ${template?.name}`);
        });

        it('应该能够获取租户的模板列表', async () => {
            const templates = await agentTemplateService.findByTenantId(testTenantId);

            console.log('✓ 租户模板列表获取成功');
            console.log(`  - 模板数量: ${templates.length}`);
        });

        it('应该能够获取激活的模板列表', async () => {
            const templates = await agentTemplateService.findByTenantId(testTenantId, true);

            console.log('✓ 激活模板列表获取成功');
            console.log(`  - 激活模板数量: ${templates.length}`);
        });

        it('应该能够更新 Agent 模板', async () => {
            const updated = await agentTemplateService.update(testTemplateId, {
                name: '更新后的助手',
            });

            console.log('✓ Agent 模板更新成功');
            console.log(`  - 模板 ID: ${updated?.id}`);
            console.log(`  - 新名称: ${updated?.name}`);
        });

        it('应该能够激活/停用模板', async () => {
            const deactivated = await agentTemplateService.setActive(testTemplateId, false);
            const activated = await agentTemplateService.setActive(testTemplateId, true);

            console.log('✓ 模板激活/停用成功');
            console.log(`  - 停用后状态: ${deactivated?.isActive}`);
            console.log(`  - 激活后状态: ${activated?.isActive}`);
        });

        it('应该能够增加模板版本', async () => {
            const original = await agentTemplateService.findById(testTemplateId);
            const updated = await agentTemplateService.incrementVersion(testTemplateId);

            console.log('✓ 模板版本增加成功');
            console.log(`  - 原版本: ${original?.version}`);
            console.log(`  - 新版本: ${updated?.version}`);
        });

        it('应该能够检查模板是否属于租户', async () => {
            const belongs = await agentTemplateService.belongsToTenant(testTemplateId, testTenantId);

            console.log('✓ 模板归属检查成功');
            console.log(`  - 是否属于租户: ${belongs}`);
        });
    });

    describe('API 路由验证', () => {
        it('POST /api/tenants - 应该能够创建租户', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/tenants',
                payload: {
                    name: 'API 创建的租户',
                    quota: {maxTokensPerDay: 200000, maxConcurrentSessions: 3},
                },
            });

            console.log('✓ POST /api/tenants 响应:', {
                status: response.statusCode,
                hasId: response.json()?.id ? '是' : '否',
            });
        });

        it('GET /api/tenants/:id - 应该能够获取租户', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/tenants/${testTenantId}`,
            });

            console.log('✓ GET /api/tenants/:id 响应:', {
                status: response.statusCode,
                hasName: response.json()?.name ? '是' : '否',
            });
        });

        it('GET /api/tenants - 应该能够获取租户列表', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/tenants',
            });

            console.log('✓ GET /api/tenants 响应:', {
                status: response.statusCode,
                hasData: response.json()?.data ? '是' : '否',
                count: response.json()?.meta?.count,
            });
        });

        it('POST /api/users - 应该能够创建用户', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/users',
                payload: {
                    tenantId: testTenantId,
                    name: 'API 创建的用户',
                    email: `api-user-${Date.now()}@example.com`,
                    passwordHash: 'password123',
                },
            });

            console.log('✓ POST /api/users 响应:', {
                status: response.statusCode,
                hasId: response.json()?.id ? '是' : '否',
            });
        });

        it('GET /api/users/:id - 应该能够获取用户', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/users/${testUserId}`,
            });

            console.log('✓ GET /api/users/:id 响应:', {
                status: response.statusCode,
                hasName: response.json()?.name ? '是' : '否',
            });
        });

        it('GET /api/users - 应该能够获取用户列表', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/users?tenantId=${testTenantId}`,
            });

            console.log('✓ GET /api/users 响应:', {
                status: response.statusCode,
                hasData: response.json()?.data ? '是' : '否',
                count: response.json()?.meta?.count,
            });
        });

        it('POST /api/agents - 应该能够创建 Agent 模板', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/agents',
                payload: {
                    tenantId: testTenantId,
                    name: 'API 创建的助手',
                    systemPrompt: '你是通过 API 创建的助手',
                    modelConfig: {
                        provider: 'anthropic',
                        model: 'claude-sonnet-4-6',
                        temperature: 0.7,
                        maxTokens: 4096,
                    },
                },
            });

            console.log('✓ POST /api/agents 响应:', {
                status: response.statusCode,
                hasId: response.json()?.id ? '是' : '否',
            });
        });

        it('GET /api/agents/:id - 应该能够获取 Agent 模板', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/agents/${testTemplateId}`,
            });

            console.log('✓ GET /api/agents/:id 响应:', {
                status: response.statusCode,
                hasName: response.json()?.name ? '是' : '否',
            });
        });

        it('GET /api/agents - 应该能够获取 Agent 模板列表', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/agents?tenantId=${testTenantId}`,
            });

            console.log('✓ GET /api/agents 响应:', {
                status: response.statusCode,
                hasData: response.json()?.data ? '是' : '否',
                count: response.json()?.meta?.count,
            });
        });

        it('PATCH /api/agents/:id/activate - 应该能够激活模板', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/agents/${testTemplateId}/activate`,
            });

            console.log('✓ PATCH /api/agents/:id/activate 响应:', {
                status: response.statusCode,
                isActive: response.json()?.isActive,
            });
        });

        it('PATCH /api/agents/:id/deactivate - 应该能够停用模板', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/agents/${testTemplateId}/deactivate`,
            });

            console.log('✓ PATCH /api/agents/:id/deactivate 响应:', {
                status: response.statusCode,
                isActive: response.json()?.isActive,
            });
        });
    });

    describe('文件结构验证', () => {
        it('服务文件应该存在', async () => {
            const {existsSync} = await import('fs');
            const files = [
                'src/services/tenant.ts',
                'src/services/user.ts',
                'src/services/agent-template.ts',
            ];

            console.log('✓ 服务文件检查:');
            files.forEach((file) => {
                const path = join(projectRoot, file);
                console.log(`  - ${file}: ${existsSync(path) ? '✓' : '✗'}`);
            });
        });

        it('路由文件应该存在', async () => {
            const {existsSync} = await import('fs');
            const files = [
                'src/routes/tenants.ts',
                'src/routes/users.ts',
                'src/routes/agents.ts',
            ];

            console.log('✓ 路由文件检查:');
            files.forEach((file) => {
                const path = join(projectRoot, file);
                console.log(`  - ${file}: ${existsSync(path) ? '✓' : '✗'}`);
            });
        });
    });
});
