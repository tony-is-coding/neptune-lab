process.env.DATA_ROOT = `/tmp/neptune-projects-${Date.now()}`;

import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import {and, eq} from 'drizzle-orm';
import {createTestApp} from './setup';
import {db} from '../src/db';
import {auditEvents} from '../src/db/schema';

async function createProjectTestUser(app: FastifyInstance, label: string) {
    const suffix = `${label}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
            tenantName: `项目租户 ${suffix}`,
            name: `项目用户 ${suffix}`,
            email: `project-${suffix}@test.com`,
            password: 'password123',
        },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();

    return {
        token: body.accessToken as string,
        tenantId: body.user.tenantId as string,
        userId: body.user.id as string,
    };
}

describe('CustomerProject API', () => {
    let app: FastifyInstance;
    let token: string;
    let tenantId: string;
    let userId: string;
    let otherToken: string;

    beforeAll(async () => {
        app = await createTestApp();
        const user = await createProjectTestUser(app, 'owner');
        token = user.token;
        tenantId = user.tenantId;
        userId = user.userId;

        const otherUser = await createProjectTestUser(app, 'other');
        otherToken = otherUser.token;
    });

    afterAll(async () => {
        await app.close();
    });

    test('creates, lists, reads and archives projects inside the authenticated tenant', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: '华东共享服务中心月结项目',
                description: '用于验证受控运行、证据和关账工作台的客户项目。',
                environment: 'sandbox',
                solutionPack: 'close_readiness',
                metadataSummary: {
                    region: '华东',
                    erp: '用友 U8',
                },
            },
        });

        expect(createRes.statusCode).toBe(201);
        expect(createRes.headers['x-request-id']).toBeTruthy();
        const created = createRes.json();
        const projectId = created.id as string;
        expect(projectId).toEqual(expect.any(String));
        expect(created).toMatchObject({
            id: projectId,
            tenantId,
            name: '华东共享服务中心月结项目',
            description: '用于验证受控运行、证据和关账工作台的客户项目。',
            status: 'active',
            environment: 'sandbox',
            solutionPack: 'close_readiness',
            createdBy: userId,
            metadataSummary: {
                region: '华东',
                erp: '用友 U8',
            },
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        });

        const listRes = await app.inject({
            method: 'GET',
            url: '/api/v1/projects?status=active&limit=10&offset=0',
            headers: {authorization: `Bearer ${token}`},
        });
        expect(listRes.statusCode).toBe(200);
        const listBody = listRes.json();
        expect(listBody.data.map((project: {id: string}) => project.id)).toContain(projectId);
        expect(listBody.data.every((project: {tenantId: string}) => project.tenantId === tenantId)).toBe(true);
        expect(listBody.meta).toMatchObject({
            count: expect.any(Number),
            limit: 10,
            offset: 0,
        });

        const detailRes = await app.inject({
            method: 'GET',
            url: `/api/v1/projects/${projectId}`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(detailRes.statusCode).toBe(200);
        expect(detailRes.json()).toMatchObject({
            id: projectId,
            tenantId,
            status: 'active',
        });

        const archiveRes = await app.inject({
            method: 'POST',
            url: `/api/v1/projects/${projectId}/archive`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(archiveRes.statusCode).toBe(200);
        expect(archiveRes.json()).toMatchObject({
            id: projectId,
            status: 'archived',
            archivedAt: expect.any(String),
        });

        const auditRows = await db
            .select()
            .from(auditEvents)
            .where(and(
                eq(auditEvents.tenantId, tenantId),
                eq(auditEvents.resourceType, 'project'),
                eq(auditEvents.resourceId, projectId),
            ));

        expect(auditRows.map(row => row.action)).toContain('project.created');
        expect(auditRows.map(row => row.action)).toContain('project.archived');
        expect(auditRows.every(row => row.userId === userId)).toBe(true);
    });

    test('hides cross-tenant projects behind a resource-not-found error envelope', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: '跨租户不可见项目',
                environment: 'sandbox',
            },
        });
        expect(createRes.statusCode).toBe(201);
        const projectId = createRes.json().id;

        const otherListRes = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherListRes.statusCode).toBe(200);
        expect(otherListRes.json().data.map((project: {id: string}) => project.id)).not.toContain(projectId);

        const otherDetailRes = await app.inject({
            method: 'GET',
            url: `/api/v1/projects/${projectId}`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherDetailRes.statusCode).toBe(404);
        expect(otherDetailRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应客户项目，或你没有权限访问。',
            requestId: expect.any(String),
            details: {},
        });
    });

    test('requires authentication and returns the standard error envelope', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/projects',
        });

        expect(res.statusCode).toBe(401);
        expect(res.json()).toMatchObject({
            error: 'UNAUTHORIZED',
            message: expect.any(String),
            requestId: expect.any(String),
            details: {},
        });
    });

    test('validates project name with a Chinese error envelope', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/projects',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: ' ',
                environment: 'sandbox',
            },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({
            error: 'VALIDATION_FAILED',
            message: '客户项目名称不能为空',
            requestId: expect.any(String),
            details: {
                field: 'name',
            },
        });
    });
});
