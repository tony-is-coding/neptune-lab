import {afterAll, beforeAll, describe, expect, it} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import bcrypt from 'bcrypt';
import {mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import {createApp} from '../src/index';
import {agentTemplates, auditEvents, db, documents, tenants, users} from '../src/db';
import {and, eq} from 'drizzle-orm';

describe('Agent 文档与记忆治理 API', () => {
    let app: FastifyInstance;
    let dataRoot: string;
    let tenantId: string;
    let adminToken: string;
    let agentId: string;
    let otherTenantId: string;
    let otherAgentId: string;

    beforeAll(async () => {
        dataRoot = await mkdtemp(path.join(tmpdir(), 'neptune-documents-test-'));
        process.env.DATA_ROOT = dataRoot;

        app = await createApp();
        await app.ready();

        const [tenant] = await db.insert(tenants).values({name: 'Documents Governance Tenant'}).returning();
        tenantId = tenant.id;

        const passwordHash = await bcrypt.hash('admin123', 10);
        const [adminUser] = await db.insert(users).values({
            tenantId,
            name: 'Documents Admin',
            email: `documents-admin-${Date.now()}@test.com`,
            passwordHash,
            role: 'admin',
        }).returning();

        const login = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {email: adminUser.email, password: 'admin123'},
        });
        adminToken = login.json().accessToken;

        const [agent] = await db.insert(agentTemplates).values({
            tenantId,
            name: '文档治理智能体',
            description: 'Document governance agent',
            systemPrompt: 'test',
            modelConfig: {provider: 'anthropic', model: 'test', temperature: 0.7, maxTokens: 100},
            tools: [],
            skills: [],
            mcpServers: [],
        }).returning();
        agentId = agent.id;

        const [otherTenant] = await db.insert(tenants).values({name: 'Other Documents Tenant'}).returning();
        otherTenantId = otherTenant.id;
        const [otherAgent] = await db.insert(agentTemplates).values({
            tenantId: otherTenantId,
            name: '其他租户智能体',
            description: 'Cross tenant document agent',
            systemPrompt: 'test',
            modelConfig: {provider: 'anthropic', model: 'test', temperature: 0.7, maxTokens: 100},
            tools: [],
            skills: [],
            mcpServers: [],
        }).returning();
        otherAgentId = otherAgent.id;
    });

    afterAll(async () => {
        await db.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId)).catch(() => {});
        await db.delete(auditEvents).where(eq(auditEvents.tenantId, otherTenantId)).catch(() => {});
        await db.delete(documents).where(eq(documents.tenantId, tenantId)).catch(() => {});
        await db.delete(documents).where(eq(documents.tenantId, otherTenantId)).catch(() => {});
        await db.delete(agentTemplates).where(eq(agentTemplates.tenantId, tenantId)).catch(() => {});
        await db.delete(agentTemplates).where(eq(agentTemplates.tenantId, otherTenantId)).catch(() => {});
        await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
        await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
        await db.delete(tenants).where(eq(tenants.id, otherTenantId)).catch(() => {});
        await app.close();
        await rm(dataRoot, {recursive: true, force: true});
    });

    it('上传时应该保留 memory/knowledge 分类，列表过滤只返回对应分类', async () => {
        const memoryRequestId = `req-memory-upload-${Date.now()}`;
        const memoryRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/documents`,
            headers: {authorization: `Bearer ${adminToken}`, 'x-request-id': memoryRequestId},
            payload: {
                name: '月结偏好.md',
                type: 'text/markdown',
                size: 12,
                content: Buffer.from('prefer memo').toString('base64'),
                category: 'memory',
            },
        });
        expect(memoryRes.statusCode).toBe(201);
        expect(memoryRes.json().category).toBe('memory');
        const memoryDocId = memoryRes.json().id;

        const knowledgeRequestId = `req-knowledge-upload-${Date.now()}`;
        const knowledgeRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${agentId}/documents`,
            headers: {authorization: `Bearer ${adminToken}`, 'x-request-id': knowledgeRequestId},
            payload: {
                name: '关账制度.pdf',
                type: 'application/pdf',
                size: 20,
                content: Buffer.from('close policy').toString('base64'),
                category: 'knowledge',
            },
        });
        expect(knowledgeRes.statusCode).toBe(201);
        expect(knowledgeRes.json().category).toBe('knowledge');

        const uploadedAuditRows = await db.select().from(auditEvents).where(and(
            eq(auditEvents.tenantId, tenantId),
            eq(auditEvents.resourceType, 'agent_document'),
        ));
        const uploadActions = uploadedAuditRows.map(row => row.action);
        expect(uploadActions).toContain('agent_document.uploaded');
        expect(uploadedAuditRows.some(row => row.requestId === memoryRequestId && row.resourceId === memoryDocId)).toBe(true);

        const memoryList = await app.inject({
            method: 'GET',
            url: `/api/v1/agents/${agentId}/documents?category=memory`,
            headers: {authorization: `Bearer ${adminToken}`},
        });
        expect(memoryList.statusCode).toBe(200);
        expect(memoryList.json().data.map((doc: {category: string}) => doc.category)).toEqual(['memory']);

        const knowledgeList = await app.inject({
            method: 'GET',
            url: `/api/v1/agents/${agentId}/documents?category=knowledge`,
            headers: {authorization: `Bearer ${adminToken}`},
        });
        expect(knowledgeList.statusCode).toBe(200);
        expect(knowledgeList.json().data.map((doc: {category: string}) => doc.category)).toEqual(['knowledge']);

        const deleteRequestId = `req-memory-delete-${Date.now()}`;
        const deleteRes = await app.inject({
            method: 'DELETE',
            url: `/api/v1/agents/${agentId}/documents/${memoryDocId}`,
            headers: {authorization: `Bearer ${adminToken}`, 'x-request-id': deleteRequestId},
        });
        expect(deleteRes.statusCode).toBe(204);

        const deleteAuditRows = await db.select().from(auditEvents).where(and(
            eq(auditEvents.tenantId, tenantId),
            eq(auditEvents.requestId, deleteRequestId),
            eq(auditEvents.resourceType, 'agent_document'),
            eq(auditEvents.resourceId, memoryDocId),
        ));
        expect(deleteAuditRows.map(row => row.action)).toContain('agent_document.deleted');
    });

    it('不能读取或上传其他租户 Agent 的文档', async () => {
        const listRes = await app.inject({
            method: 'GET',
            url: `/api/v1/agents/${otherAgentId}/documents`,
            headers: {authorization: `Bearer ${adminToken}`},
        });
        expect(listRes.statusCode).toBe(404);
        expect(listRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: 'Agent 不存在',
        });

        const uploadRes = await app.inject({
            method: 'POST',
            url: `/api/v1/agents/${otherAgentId}/documents`,
            headers: {authorization: `Bearer ${adminToken}`},
            payload: {
                name: '跨租户.md',
                type: 'text/markdown',
                size: 8,
                content: Buffer.from('blocked').toString('base64'),
                category: 'memory',
            },
        });
        expect(uploadRes.statusCode).toBe(404);
        expect(uploadRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: 'Agent 不存在',
        });
    });
});
