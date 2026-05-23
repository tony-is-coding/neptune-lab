process.env.DATA_ROOT = `/tmp/neptune-quota-status-${Date.now()}`;

import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import {eq} from 'drizzle-orm';
import {createTestApp, createTestUser} from './setup';
import {db} from '../src/db';
import {billingRecords, sessions, tenants} from '../src/db/schema';

async function createTenantUser(app: FastifyInstance): Promise<{token: string; tenantId: string; userId: string}> {
    const created = await createTestUser(app, 'admin');
    const user = created.user as {id: string; tenantId: string};

    return {
        token: created.token,
        tenantId: user.tenantId,
        userId: user.id,
    };
}

describe('Quota status API', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await createTestApp();
    });

    afterAll(async () => {
        await app.close();
    });

    test('未认证请求返回标准错误信封', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/platform-facts/quota/status',
        });

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({
            error: 'UNAUTHORIZED',
            requestId: expect.any(String),
        });
    });

    test('默认租户配额允许发起新运行，并返回剩余额度', async () => {
        const user = await createTenantUser(app);

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/platform-facts/quota/status',
            headers: {authorization: `Bearer ${user.token}`},
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({
            tenantId: user.tenantId,
            allowed: true,
            reason: null,
            quota: {
                maxTokensPerDay: 1000000,
                maxConcurrentSessions: 10,
            },
            usage: {
                totalTokensToday: 0,
                runningSessions: 0,
            },
            remaining: {
                tokensToday: 1000000,
                concurrentSessions: 10,
            },
            message: '当前租户配额允许发起新的运行',
            updatedAt: expect.any(String),
        });
    });

    test('今日 token 达到上限时拒绝新运行，并且历史用量不计入今日', async () => {
        const user = await createTenantUser(app);
        await db.update(tenants)
            .set({quota: {maxTokensPerDay: 10, maxConcurrentSessions: 10}})
            .where(eq(tenants.id, user.tenantId));

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        await db.insert(billingRecords).values([
            {
                tenantId: user.tenantId,
                sessionId: 'quota-token-today',
                userId: user.userId,
                inputTokens: 4,
                outputTokens: 6,
                model: 'quota-status-test',
                costCents: 1,
            },
            {
                tenantId: user.tenantId,
                sessionId: 'quota-token-yesterday',
                userId: user.userId,
                inputTokens: 100,
                outputTokens: 100,
                model: 'quota-status-test',
                costCents: 1,
                createdAt: yesterday,
            },
        ]);

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/platform-facts/quota/status',
            headers: {authorization: `Bearer ${user.token}`},
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({
            tenantId: user.tenantId,
            allowed: false,
            reason: 'TOKEN_QUOTA_EXCEEDED',
            usage: {
                totalTokensToday: 10,
                runningSessions: 0,
            },
            remaining: {
                tokensToday: 0,
                concurrentSessions: 10,
            },
            message: '租户 token 配额不足',
        });
    });

    test('运行中 session 达到并发上限时拒绝新运行', async () => {
        const user = await createTenantUser(app);
        await db.update(tenants)
            .set({quota: {maxTokensPerDay: 100, maxConcurrentSessions: 1}})
            .where(eq(tenants.id, user.tenantId));

        await db.insert(sessions).values({
            id: `quota-running-${Date.now()}`,
            tenantId: user.tenantId,
            userId: user.userId,
            status: 'running',
            title: 'Running quota thread',
            workspace: `/tmp/neptune/quota/${user.tenantId}/running`,
        });

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/platform-facts/quota/status',
            headers: {authorization: `Bearer ${user.token}`},
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({
            tenantId: user.tenantId,
            allowed: false,
            reason: 'CONCURRENT_SESSION_LIMIT',
            usage: {
                totalTokensToday: 0,
                runningSessions: 1,
            },
            remaining: {
                tokensToday: 100,
                concurrentSessions: 0,
            },
            message: '租户并发运行数已达到上限',
        });
    });

    test('短路径与平台事实路径同源，并且不泄漏其他租户用量', async () => {
        const owner = await createTenantUser(app);
        const other = await createTenantUser(app);

        await db.update(tenants)
            .set({quota: {maxTokensPerDay: 5, maxConcurrentSessions: 10}})
            .where(eq(tenants.id, owner.tenantId));
        await db.insert(billingRecords).values({
            tenantId: owner.tenantId,
            sessionId: 'quota-owner-today',
            userId: owner.userId,
            inputTokens: 5,
            outputTokens: 0,
            model: 'quota-status-test',
            costCents: 1,
        });

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/quota/status',
            headers: {authorization: `Bearer ${other.token}`},
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({
            tenantId: other.tenantId,
            allowed: true,
            reason: null,
            usage: {
                totalTokensToday: 0,
                runningSessions: 0,
            },
            message: '当前租户配额允许发起新的运行',
        });
    });
});
