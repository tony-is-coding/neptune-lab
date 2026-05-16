import {describe, it, expect, beforeAll, afterAll} from 'bun:test';
import {agentTemplateService} from '../src/services/agent-template';
import {db, agentTemplates, sessions, tenants, users} from '../src/db';
import {eq} from 'drizzle-orm';
import {randomUUID} from 'crypto';

describe('AgentTemplateService - listWithThreadSummary', () => {
    let tenantId: string;
    let userId: string;
    let agentId: string;
    let threadId1: string;
    let threadId2: string;

    beforeAll(async () => {
        // 创建测试租户
        tenantId = randomUUID();
        await db.insert(tenants).values({
            id: tenantId,
            name: 'Test Tenant',
        });

        // 创建测试用户
        userId = randomUUID();
        await db.insert(users).values({
            id: userId,
            tenantId,
            name: 'Test User',
            email: 'test@example.com',
            passwordHash: 'hash',
        });

        // 创建测试 Agent
        const [agent] = await db.insert(agentTemplates).values({
            tenantId,
            name: 'Test Agent',
            description: 'An agent for testing',
            icon: 'smart_toy',
            systemPrompt: 'You are a test agent.',
            modelConfig: {
                provider: 'anthropic',
                model: 'claude-sonnet-4-6',
                temperature: 0.7,
                maxTokens: 4096,
            },
        }).returning();
        agentId = agent.id;

        // 创建测试 Threads
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        [threadId1, threadId2] = [randomUUID(), randomUUID()];

        await db.insert(sessions).values([
            {
                id: threadId1,
                tenantId,
                userId,
                templateId: agentId,
                status: 'idle',
                title: 'First Thread',
                summary: 'Discussion about project requirements',
                workspace: `/data/tenants/${tenantId}/agents/${agentId}/threads/${threadId1}`,
                lastActiveAt: now,
                createdAt: yesterday,
                updatedAt: now,
            },
            {
                id: threadId2,
                tenantId,
                userId,
                templateId: agentId,
                status: 'running',
                title: 'Second Thread',
                summary: 'Bug fixing session',
                workspace: `/data/tenants/${tenantId}/agents/${agentId}/threads/${threadId2}`,
                lastActiveAt: yesterday,
                createdAt: yesterday,
                updatedAt: yesterday,
            },
        ]);
    });

    afterAll(async () => {
        // 清理测试数据
        await db.delete(sessions).where(eq(sessions.templateId, agentId));
        await db.delete(agentTemplates).where(eq(agentTemplates.tenantId, tenantId));
        await db.delete(users).where(eq(users.id, userId));
        await db.delete(tenants).where(eq(tenants.id, tenantId));
    });

    it('应返回包含 threadSummary 聚合对象的 Agent 列表', async () => {
        const result = await agentTemplateService.listWithThreadSummary(tenantId, {userId});

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);

        const testAgent = result.find(a => a.id === agentId);
        expect(testAgent).toBeDefined();

        if (testAgent) {
            expect(testAgent.threadSummary).toBeDefined();

            // 验证 threadSummary 结构（聚合对象）
            expect(testAgent.threadSummary).toHaveProperty('totalThreads');
            expect(testAgent.threadSummary).toHaveProperty('latestStatus');
            expect(testAgent.threadSummary).toHaveProperty('latestThreadTitle');
            expect(testAgent.threadSummary).toHaveProperty('lastActiveAt');

            // 验证值
            expect(testAgent.threadSummary?.totalThreads).toBe(2);
            // 最新的是 threadId1（lastActiveAt 是 now）
            expect(testAgent.threadSummary?.latestStatus).toBe('idle');
            expect(testAgent.threadSummary?.latestThreadTitle).toBe('First Thread');
            // lastActiveAt 现在是 ISO 字符串
            expect(testAgent.threadSummary?.lastActiveAt).toBeTruthy();
            expect(typeof testAgent.threadSummary?.lastActiveAt).toBe('string');
            expect(testAgent.threadSummary?.lastActiveAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        }
    });

    it('应返回 null 当 Agent 没有 Thread 时', async () => {
        // 创建没有 thread 的 agent
        const [agentNoThread] = await db.insert(agentTemplates).values({
            tenantId,
            name: 'Agent No Thread',
            systemPrompt: 'You are a test agent.',
            modelConfig: {
                provider: 'anthropic',
                model: 'claude-sonnet-4-6',
                temperature: 0.7,
                maxTokens: 4096,
            },
        }).returning();

        const result = await agentTemplateService.listWithThreadSummary(tenantId, {userId});

        const agent = result.find(a => a.id === agentNoThread.id);
        expect(agent?.threadSummary).toBeNull();

        // 清理
        await db.delete(agentTemplates).where(eq(agentTemplates.id, agentNoThread.id));
    });

    it('应正确统计 totalThreads', async () => {
        const result = await agentTemplateService.listWithThreadSummary(tenantId, {userId});

        const testAgent = result.find(a => a.id === agentId);
        expect(testAgent?.threadSummary?.totalThreads).toBe(2);
    });

    it('应获取最新 Thread 的状态（按 lastActiveAt 降序）', async () => {
        const result = await agentTemplateService.listWithThreadSummary(tenantId, {userId});

        const testAgent = result.find(a => a.id === agentId);
        expect(testAgent?.threadSummary?.latestStatus).toBe('idle'); // threadId1 的状态
        expect(testAgent?.threadSummary?.latestThreadTitle).toBe('First Thread');
    });

    it('应支持 activeOnly 参数', async () => {
        // 停用测试 agent
        await db.update(agentTemplates)
            .set({isActive: false})
            .where(eq(agentTemplates.id, agentId));

        const resultActiveOnly = await agentTemplateService.listWithThreadSummary(tenantId, {
            userId,
            activeOnly: true,
        });
        const agentActiveOnly = resultActiveOnly.find(a => a.id === agentId);
        expect(agentActiveOnly).toBeUndefined();

        const resultAll = await agentTemplateService.listWithThreadSummary(tenantId, {
            userId,
            activeOnly: false,
        });
        const agentAll = resultAll.find(a => a.id === agentId);
        expect(agentAll).toBeDefined();

        // 恢复
        await db.update(agentTemplates)
            .set({isActive: true})
            .where(eq(agentTemplates.id, agentId));
    });

    it('应支持 limit 和 offset 参数', async () => {
        // 创建另一个 agent
        const [agent2] = await db.insert(agentTemplates).values({
            tenantId,
            name: 'Test Agent 2',
            systemPrompt: 'You are a test agent.',
            modelConfig: {
                provider: 'anthropic',
                model: 'claude-sonnet-4-6',
                temperature: 0.7,
                maxTokens: 4096,
            },
        }).returning();

        const result = await agentTemplateService.listWithThreadSummary(tenantId, {
            userId,
            limit: 1,
            offset: 0,
        });

        expect(result.length).toBe(1);

        // 清理
        await db.delete(agentTemplates).where(eq(agentTemplates.id, agent2.id));
    });
});
