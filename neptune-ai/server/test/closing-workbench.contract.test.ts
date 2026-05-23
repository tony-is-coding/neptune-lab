process.env.DATA_ROOT = `/tmp/neptune-closing-workbench-${Date.now()}`;

import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import type {FastifyInstance} from 'fastify';
import {and, eq} from 'drizzle-orm';
import {FormData, File} from 'undici';
import {createTestApp} from './setup';
import {db} from '../src/db';
import {
    accountingPeriods,
    auditEvents,
    artifacts,
    billingRecords,
    checklistItems,
    closeReports,
    closeWorkspaces,
    evidenceArtifacts,
    findings,
    humanReviews,
    policyDecisions,
    runs,
    tenants,
} from '../src/db/schema';

async function createClosingUser(app: FastifyInstance): Promise<{token: string; tenantId: string; userId: string}> {
    const suffix = Math.random().toString(36).slice(2, 8);
    const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
            tenantName: `Closing ${suffix}`,
            name: `Closing User ${suffix}`,
            email: `closing-${suffix}@test.com`,
            password: 'password123',
        },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();

    return {
        token: body.accessToken,
        tenantId: body.user.tenantId,
        userId: body.user.id,
    };
}

describe('关账工作台 MVP contract', () => {
    let app: FastifyInstance;
    let token: string;
    let tenantId: string;
    let userId: string;
    let otherToken: string;

    beforeAll(async () => {
        app = await createTestApp();
        const user = await createClosingUser(app);
        token = user.token;
        tenantId = user.tenantId;
        userId = user.userId;

        const otherUser = await createClosingUser(app);
        otherToken = otherUser.token;
    });

    afterAll(async () => {
        await app.close();
    });

    test('创建工作区、生成检查、提交复核、生成报告并留下审计链', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/closing/workspaces',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: '华东共享中心 2026-04 月结',
                scope: {
                    organizationName: '华东共享中心',
                    ledgerName: '总账账套 A',
                    bookCode: 'CN-GL-A',
                    currency: 'CNY',
                },
                period: {
                    periodKey: '2026-04',
                    startsAt: '2026-04-01T00:00:00.000Z',
                    endsAt: '2026-04-30T23:59:59.000Z',
                },
            },
        });

        expect(createRes.statusCode).toBe(201);
        const created = createRes.json();
        const workspaceId = created.workspace.id;
        const periodId = created.currentPeriod.id;
        expect(created.workspace).toMatchObject({
            id: expect.any(String),
            tenantId,
            name: '华东共享中心 2026-04 月结',
            status: 'active',
            createdBy: userId,
            createdAt: expect.any(String),
        });
        expect(created.workspace.scope).toMatchObject({
            ledgerName: '总账账套 A',
            bookCode: 'CN-GL-A',
        });
        expect(created.currentPeriod).toMatchObject({
            tenantId,
            workspaceId: created.workspace.id,
            periodKey: '2026-04',
            status: 'open',
        });

        const workspaceRows = await db
            .select()
            .from(closeWorkspaces)
            .where(and(
                eq(closeWorkspaces.tenantId, tenantId),
                eq(closeWorkspaces.id, workspaceId),
            ));
        expect(workspaceRows).toHaveLength(1);

        const periodRows = await db
            .select()
            .from(accountingPeriods)
            .where(and(
                eq(accountingPeriods.tenantId, tenantId),
                eq(accountingPeriods.id, periodId),
            ));
        expect(periodRows).toHaveLength(1);
        expect(periodRows[0].status).toBe('open');

        const generateRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/checks:generate`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                periodId,
                mockDataset: 'general-ledger-basic',
            },
        });
        expect(generateRes.statusCode).toBe(200);
        const generated = generateRes.json();
        expect(generated.summary).toMatchObject({
            totalChecks: 3,
            passedCount: 2,
            findingCount: 1,
            evidenceCount: 1,
        });
        expect(generated.checklistItems).toHaveLength(3);
        expect(generated.findings).toHaveLength(1);
        expect(generated.findings[0]).toMatchObject({
            tenantId,
            workspaceId: created.workspace.id,
            periodId,
            status: 'open',
            severity: 'blocking',
            evidenceCount: 1,
            reviewStatus: null,
        });
        expect(JSON.stringify(generated.findings[0])).not.toContain('credential');
        expect(JSON.stringify(generated.findings[0])).not.toContain('voucher body');

        const periodAfterChecks = await db
            .select()
            .from(accountingPeriods)
            .where(eq(accountingPeriods.id, periodId));
        expect(periodAfterChecks[0].status).toBe('review_pending');

        const checklistRows = await db
            .select()
            .from(checklistItems)
            .where(eq(checklistItems.periodId, periodId));
        expect(checklistRows).toHaveLength(3);
        expect(checklistRows.some(row => row.status === 'failed')).toBe(true);

        const findingRows = await db
            .select()
            .from(findings)
            .where(eq(findings.periodId, periodId));
        expect(findingRows).toHaveLength(1);

        const evidenceRows = await db
            .select()
            .from(evidenceArtifacts)
            .where(eq(evidenceArtifacts.tenantId, tenantId));
        expect(evidenceRows.some(row => row.id === generated.findings[0].evidenceArtifactIds[0])).toBe(true);

        const reviewRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/findings/${generated.findings[0].id}/submit-review`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                reason: '阻塞项需要财务负责人复核。',
            },
        });
        expect(reviewRes.statusCode).toBe(201);
        const reviewBody = reviewRes.json();
        expect(reviewBody.finding).toMatchObject({
            id: generated.findings[0].id,
            status: 'review_pending',
            reviewStatus: 'pending',
        });
        expect(reviewBody.review).toMatchObject({
            tenantId,
            subjectType: 'closing_finding',
            subjectId: generated.findings[0].id,
            status: 'pending',
            requestedBy: userId,
        });

        const reviewRows = await db
            .select()
            .from(humanReviews)
            .where(eq(humanReviews.id, reviewBody.review.id));
        expect(reviewRows).toHaveLength(1);

        const approveRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/reviews/${reviewBody.review.id}/approve`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                reason: '已确认影响范围，允许进入报告。',
            },
        });
        expect(approveRes.statusCode).toBe(200);
        expect(approveRes.json()).toMatchObject({
            review: {
                id: reviewBody.review.id,
                status: 'approved',
                decision: 'approve',
                decidedBy: userId,
            },
            finding: {
                id: generated.findings[0].id,
                status: 'approved',
                reviewStatus: 'approved',
            },
        });

        const periodAfterApproval = await db
            .select()
            .from(accountingPeriods)
            .where(eq(accountingPeriods.id, periodId));
        expect(periodAfterApproval[0].status).toBe('approved');

        const reportRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/report-snapshots`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                periodId,
            },
        });
        expect(reportRes.statusCode).toBe(201);
        const report = reportRes.json();
        const reportId = report.id;
        const snapshotHash = report.snapshotHash;
        expect(report).toMatchObject({
            id: expect.any(String),
            tenantId,
            workspaceId,
            periodId,
            status: 'generated',
            title: '2026-04 关账就绪报告',
            generatedBy: userId,
            snapshotHash: expect.any(String),
            generatedAt: expect.any(String),
            summary: {
                totalChecks: 3,
                passedCount: 2,
                findingCount: 1,
                pendingReviewCount: 0,
                evidenceCount: 1,
            },
        });
        expect(JSON.stringify(report.snapshot)).not.toContain('voucher body');
        expect(JSON.stringify(report.snapshot)).not.toContain('secret');

        const periodAfterReport = await db
            .select()
            .from(accountingPeriods)
            .where(eq(accountingPeriods.id, periodId));
        expect(periodAfterReport[0].status).toBe('closed');

        const reportRows = await db
            .select()
            .from(closeReports)
            .where(eq(closeReports.id, reportId));
        expect(reportRows).toHaveLength(1);
        expect(reportRows[0].snapshotHash).toBe(snapshotHash);

        const auditRows = await db
            .select()
            .from(auditEvents)
            .where(eq(auditEvents.tenantId, tenantId));
        const actions = auditRows.map(row => row.action);
        expect(actions).toContain('closing.workspace.created');
        expect(actions).toContain('closing.check_run.completed');
        expect(actions).toContain('human_review.requested');
        expect(actions).toContain('human_review.approved');
        expect(actions).toContain('closing.period.transitioned');
        expect(actions).toContain('closing.report_snapshot.generated');

        const detailRes = await app.inject({
            method: 'GET',
            url: `/api/v1/closing/report-snapshots/${reportId}`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(detailRes.statusCode).toBe(200);
        const detail = detailRes.json();
        const reportAuditIds = detail.report.auditEventIds;
        expect(detail.report).toMatchObject({
            id: reportId,
            tenantId,
            workspaceId,
            periodId,
            snapshotHash,
        });
        expect(Array.isArray(reportAuditIds)).toBe(true);
        expect(detail.facts.runs).toHaveLength(1);
        expect(detail.facts.evidenceArtifacts).toHaveLength(1);
        expect(detail.facts.findings).toHaveLength(1);
        expect(detail.facts.humanReviews).toHaveLength(1);
        expect(detail.facts.auditEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                action: 'closing.period.transitioned',
                resourceType: 'accounting_period',
                resourceId: periodId,
                outcome: 'success',
            }),
            expect.objectContaining({
                action: 'closing.report_snapshot.generated',
                resourceType: 'closing_report',
                resourceId: reportId,
                outcome: 'success',
            }),
        ]));
        expect(reportAuditIds).toContain(
            detail.facts.auditEvents.find((event: {action: string}) => event.action === 'closing.report_snapshot.generated')?.id,
        );
        expect(JSON.stringify(detail)).not.toContain('voucher body');
        expect(JSON.stringify(detail)).not.toContain('secret');

        const otherDetailRes = await app.inject({
            method: 'GET',
            url: `/api/v1/closing/report-snapshots/${reportId}`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherDetailRes.statusCode).toBe(404);
        expect(otherDetailRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应关账资源，或你没有权限访问。',
            requestId: expect.any(String),
            details: {},
        });
    });

    test('CSV 证据导入沉淀 artifact/evidence 并可追加到关账异常证据链', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/closing/workspaces',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: 'CSV 证据导入工作区',
                period: {
                    periodKey: '2026-08',
                    startsAt: '2026-08-01T00:00:00.000Z',
                    endsAt: '2026-08-31T23:59:59.000Z',
                },
            },
        });
        expect(createRes.statusCode).toBe(201);
        const workspaceId = createRes.json().workspace.id;
        const periodId = createRes.json().currentPeriod.id;

        const generateRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/checks:generate`,
            headers: {authorization: `Bearer ${token}`},
            payload: {periodId, mockDataset: 'general-ledger-basic'},
        });
        expect(generateRes.statusCode).toBe(200);
        const findingId = generateRes.json().findings[0].id;
        const existingEvidenceIds = generateRes.json().findings[0].evidenceArtifactIds;
        const requestId = `req-close-csv-import-${Date.now()}`;
        const csvBody = [
            'account,amount,password',
            '1001,1200,super-secret',
            '2001,-1200,another-secret',
        ].join('\n');
        const formData = new FormData();
        formData.append('periodId', periodId);
        formData.append('findingId', findingId);
        formData.append('sourceSystem', 'mock-erp');
        formData.append('ledgerName', '总账账套 A');
        formData.append('accountSet', '华东共享中心');
        formData.append('file', new File([csvBody], 'trial-balance-2026-08.csv', {type: 'text/csv'}));

        const importRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/evidence-imports:csv`,
            headers: {authorization: `Bearer ${token}`, 'x-request-id': requestId},
            payload: formData,
        });

        expect(importRes.statusCode).toBe(201);
        const imported = importRes.json();
        expect(imported).toMatchObject({
            artifact: {
                tenantId,
                runId: null,
                requestId,
                artifactType: 'dataset',
                title: 'trial-balance-2026-08.csv',
                mimeType: 'text/csv',
                sourceType: 'upload',
                sourceRef: 'mock-erp',
                createdBy: userId,
            },
            evidence: {
                tenantId,
                runId: null,
                requestId,
                evidenceType: 'source_file',
                sourceSystem: 'mock-erp',
                importedBy: userId,
            },
            summary: {
                rowCount: 2,
                columnCount: 3,
                schemaStatus: 'valid',
                linkedFindingCount: 1,
            },
        });
        expect(imported.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(imported.evidence.sourceHash).toBe(imported.artifact.sha256);
        expect(imported.linkedFindings[0]).toMatchObject({
            id: findingId,
            evidenceArtifactIds: [...existingEvidenceIds, imported.evidence.id],
            evidenceCount: existingEvidenceIds.length + 1,
        });
        expect(JSON.stringify(imported)).not.toContain('super-secret');
        expect(JSON.stringify(imported)).not.toContain('another-secret');

        const artifactRows = await db.select().from(artifacts).where(eq(artifacts.id, imported.artifact.id));
        expect(artifactRows).toHaveLength(1);
        expect(artifactRows[0]).toMatchObject({
            tenantId,
            runId: null,
            requestId,
            artifactType: 'dataset',
            mimeType: 'text/csv',
            sourceType: 'upload',
            sourceRef: 'mock-erp',
        });
        expect(artifactRows[0].metadataSummary).toMatchObject({
            periodId,
            rowCount: 2,
            columnCount: 3,
            ledgerName: '总账账套 A',
            accountSet: '华东共享中心',
        });
        expect(JSON.stringify(artifactRows[0].metadataSummary)).not.toContain('super-secret');

        const evidenceRows = await db.select().from(evidenceArtifacts).where(eq(evidenceArtifacts.id, imported.evidence.id));
        expect(evidenceRows).toHaveLength(1);
        expect(evidenceRows[0]).toMatchObject({
            tenantId,
            artifactId: imported.artifact.id,
            runId: null,
            requestId,
            evidenceType: 'source_file',
            sourceSystem: 'mock-erp',
            sourceHash: imported.artifact.sha256,
            importedBy: userId,
        });

        const refreshedFindings = await db.select().from(findings).where(eq(findings.id, findingId));
        expect(refreshedFindings).toHaveLength(1);
        expect(refreshedFindings[0].evidenceArtifactIds).toEqual([...existingEvidenceIds, imported.evidence.id]);

        const auditRows = await db.select().from(auditEvents).where(and(
            eq(auditEvents.tenantId, tenantId),
            eq(auditEvents.requestId, requestId),
        ));
        expect(auditRows.map(row => row.action)).toEqual(expect.arrayContaining([
            'artifact.created',
            'evidence.created',
            'closing.evidence_imported',
        ]));

        const listRes = await app.inject({
            method: 'GET',
            url: `/api/v1/closing/workspaces/${workspaceId}/evidence-artifacts`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(listRes.statusCode).toBe(200);
        expect(listRes.json()).toMatchObject({
            data: expect.arrayContaining([
                expect.objectContaining({
                    id: imported.evidence.id,
                    artifactId: imported.artifact.id,
                    evidenceType: 'source_file',
                    sourceSystem: 'mock-erp',
                    sourceHash: imported.artifact.sha256,
                    runId: null,
                    metadataSummary: expect.objectContaining({
                        workspaceId,
                        periodId,
                        rowCount: 2,
                        columnCount: 3,
                    }),
                }),
            ]),
            meta: expect.objectContaining({count: expect.any(Number), limit: 50, offset: 0}),
        });
        expect(JSON.stringify(listRes.json())).not.toContain('super-secret');
    });

    test('工作流时间线按会计期间串联检查、证据、复核、报告和审计事实', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/closing/workspaces',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: '工作流时间线工作区',
                period: {
                    periodKey: '2026-10',
                    startsAt: '2026-10-01T00:00:00.000Z',
                    endsAt: '2026-10-31T23:59:59.000Z',
                },
            },
        });
        expect(createRes.statusCode).toBe(201);
        const workspaceId = createRes.json().workspace.id;
        const periodId = createRes.json().currentPeriod.id;

        const generateRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/checks:generate`,
            headers: {authorization: `Bearer ${token}`},
            payload: {periodId, mockDataset: 'general-ledger-basic'},
        });
        expect(generateRes.statusCode).toBe(200);
        const findingId = generateRes.json().findings[0].id;

        const importRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/evidence-imports:csv`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                periodId,
                findingId,
                fileName: 'workflow-evidence.csv',
                content: 'account,amount\n1001,1',
                sourceSystem: 'manual-upload',
            },
        });
        expect(importRes.statusCode).toBe(201);

        const reviewRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/findings/${findingId}/submit-review`,
            headers: {authorization: `Bearer ${token}`},
            payload: {reason: '进入时间线复核。'},
        });
        expect(reviewRes.statusCode).toBe(201);
        const reviewId = reviewRes.json().review.id;

        const approveRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/reviews/${reviewId}/approve`,
            headers: {authorization: `Bearer ${token}`},
            payload: {reason: '时间线复核批准。'},
        });
        expect(approveRes.statusCode).toBe(200);

        const reportRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/report-snapshots`,
            headers: {authorization: `Bearer ${token}`},
            payload: {periodId},
        });
        expect(reportRes.statusCode).toBe(201);

        const timelineRes = await app.inject({
            method: 'GET',
            url: `/api/v1/closing/workspaces/${workspaceId}/workflow-timeline`,
            headers: {authorization: `Bearer ${token}`},
        });
        expect(timelineRes.statusCode).toBe(200);
        const timeline = JSON.parse(timelineRes.body);
        const timelineItems: Array<{kind: string; [key: string]: unknown}> = [...(timeline.data ?? [])];
        expect(timeline).toMatchObject({
            period: {
                id: periodId,
                status: 'closed',
            },
            data: expect.any(Array),
            meta: {
                count: expect.any(Number),
                limit: 100,
                offset: 0,
            },
        });
        expect(timelineItems.length >= 8).toBe(true);
        expect(timelineItems.map((item: {kind: string}) => item.kind)).toEqual(expect.arrayContaining([
            'workspace_created',
            'period_transition',
            'check_run',
            'evidence',
            'review',
            'report',
        ]));
        expect(timelineItems).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: 'check_run',
                title: '关账检查完成',
                resourceType: 'closing_workspace',
                resourceId: workspaceId,
                status: 'success',
                auditEventId: expect.any(Number),
            }),
            expect.objectContaining({
                kind: 'evidence',
                title: 'CSV 证据已导入',
                summary: expect.stringContaining('1 行'),
                resourceType: 'closing_workspace',
                resourceId: workspaceId,
            }),
            expect.objectContaining({
                kind: 'review',
                title: '复核已批准',
                resourceType: 'human_review',
                resourceId: reviewId,
            }),
            expect.objectContaining({
                kind: 'period_transition',
                title: '会计期间已关账',
                resourceType: 'accounting_period',
                resourceId: periodId,
            }),
            expect.objectContaining({
                kind: 'report',
                title: '关账报告已生成',
                resourceType: 'closing_report',
                resourceId: reportRes.json().id,
            }),
        ]));
        expect(JSON.stringify(timeline)).not.toContain('credential');
        expect(JSON.stringify(timeline)).not.toContain('workflow-evidence.csv');

        const otherTimelineRes = await app.inject({
            method: 'GET',
            url: `/api/v1/closing/workspaces/${workspaceId}/workflow-timeline`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherTimelineRes.statusCode).toBe(404);
        expect(otherTimelineRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应关账资源，或你没有权限访问。',
            requestId: expect.any(String),
            details: {},
        });
    });

    test('CSV 证据导入遵守租户隔离并返回标准错误信封', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/closing/workspaces',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: 'CSV 隔离工作区',
                period: {
                    periodKey: '2026-09',
                    startsAt: '2026-09-01T00:00:00.000Z',
                    endsAt: '2026-09-30T23:59:59.000Z',
                },
            },
        });
        expect(createRes.statusCode).toBe(201);
        const workspaceId = createRes.json().workspace.id;
        const periodId = createRes.json().currentPeriod.id;

        const otherImportRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/evidence-imports:csv`,
            headers: {authorization: `Bearer ${otherToken}`},
            payload: {
                periodId,
                fileName: 'trial-balance.csv',
                content: 'account,amount\n1001,1',
            },
        });
        expect(otherImportRes.statusCode).toBe(404);
        expect(otherImportRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应关账资源，或你没有权限访问。',
            requestId: expect.any(String),
            details: {},
        });

        const invalidRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/evidence-imports:csv`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                periodId,
                fileName: 'empty.csv',
                content: '',
            },
        });
        expect(invalidRes.statusCode).toBe(400);
        expect(invalidRes.json()).toMatchObject({
            error: 'VALIDATION_FAILED',
            message: 'CSV 证据导入失败：期间、文件名和 CSV 内容不能为空，且文件必须为 .csv。',
            requestId: expect.any(String),
            details: {},
        });

        const otherListRes = await app.inject({
            method: 'GET',
            url: `/api/v1/closing/workspaces/${workspaceId}/evidence-artifacts`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherListRes.statusCode).toBe(404);
        expect(otherListRes.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应关账资源，或你没有权限访问。',
            requestId: expect.any(String),
            details: {},
        });
    });

    test('关账工作台资源按租户隔离', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/closing/workspaces',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: '跨租户隔离工作区',
                period: {
                    periodKey: '2026-05',
                    startsAt: '2026-05-01T00:00:00.000Z',
                    endsAt: '2026-05-31T23:59:59.000Z',
                },
            },
        });
        expect(createRes.statusCode).toBe(201);
        const workspaceId = createRes.json().workspace.id;
        const periodId = createRes.json().currentPeriod.id;

        const otherGetRes = await app.inject({
            method: 'GET',
            url: `/api/v1/closing/workspaces/${workspaceId}`,
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherGetRes.statusCode).toBe(404);

        const otherGenerateRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/checks:generate`,
            headers: {authorization: `Bearer ${otherToken}`},
            payload: {periodId},
        });
        expect(otherGenerateRes.statusCode).toBe(404);

        const otherListRes = await app.inject({
            method: 'GET',
            url: '/api/v1/closing/workspaces',
            headers: {authorization: `Bearer ${otherToken}`},
        });
        expect(otherListRes.statusCode).toBe(200);
        expect(otherListRes.json().data.some((workspace: {id: string}) => workspace.id === workspaceId)).toBe(false);
    });

    test('关账检查运行被租户配额硬门禁拒绝且不创建 synthetic run', async () => {
        const quotaUser = await createClosingUser(app);
        await db.update(tenants)
            .set({quota: {maxTokensPerDay: 0, maxConcurrentSessions: 10}})
            .where(eq(tenants.id, quotaUser.tenantId));

        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/closing/workspaces',
            headers: {authorization: `Bearer ${quotaUser.token}`},
            payload: {
                name: '配额门禁关账工作区',
                period: {
                    periodKey: '2026-07',
                    startsAt: '2026-07-01T00:00:00.000Z',
                    endsAt: '2026-07-31T23:59:59.000Z',
                },
            },
        });
        expect(createRes.statusCode).toBe(201);
        const workspaceId = createRes.json().workspace.id;
        const periodId = createRes.json().currentPeriod.id;
        const requestId = `req-close-quota-denied-${Date.now()}`;

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/checks:generate`,
            headers: {authorization: `Bearer ${quotaUser.token}`, 'x-request-id': requestId},
            payload: {
                periodId,
                mockDataset: 'general-ledger-basic',
            },
        });

        expect(res.statusCode).toBe(429);
        expect(res.json()).toMatchObject({
            error: 'QUOTA_EXCEEDED',
            message: '租户配额不足',
            requestId,
            details: {
                reason: 'TOKEN_QUOTA_EXCEEDED',
                quota: {maxTokensPerDay: 0, maxConcurrentSessions: 10},
            },
        });

        const runRows = await db.select().from(runs).where(and(
            eq(runs.tenantId, quotaUser.tenantId),
            eq(runs.requestId, requestId),
        ));
        expect(runRows).toHaveLength(0);

        const billingRows = await db.select().from(billingRecords).where(and(
            eq(billingRecords.tenantId, quotaUser.tenantId),
            eq(billingRecords.sessionId, requestId),
        ));
        expect(billingRows).toHaveLength(0);

        const policyRows = await db.select().from(policyDecisions).where(and(
            eq(policyDecisions.tenantId, quotaUser.tenantId),
            eq(policyDecisions.requestId, requestId),
            eq(policyDecisions.policyType, 'quota'),
        ));
        expect(policyRows).toHaveLength(1);
        expect(policyRows[0]).toMatchObject({
            decision: 'deny',
            reason: '租户 token 配额不足',
            subjectType: 'thread',
        });

        const auditRows = await db.select().from(auditEvents).where(and(
            eq(auditEvents.tenantId, quotaUser.tenantId),
            eq(auditEvents.requestId, requestId),
            eq(auditEvents.action, 'quota.blocked'),
        ));
        expect(auditRows).toHaveLength(1);
        expect(auditRows[0]).toMatchObject({
            outcome: 'failure',
        });
    });

    test('报告快照不能绕过检查和复核门禁', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/closing/workspaces',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: '报告门禁工作区',
                period: {
                    periodKey: '2026-06',
                    startsAt: '2026-06-01T00:00:00.000Z',
                    endsAt: '2026-06-30T23:59:59.000Z',
                },
            },
        });
        expect(createRes.statusCode).toBe(201);
        const workspaceId = createRes.json().workspace.id;
        const periodId = createRes.json().currentPeriod.id;

        const beforeChecksRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/report-snapshots`,
            headers: {authorization: `Bearer ${token}`},
            payload: {periodId},
        });
        expect(beforeChecksRes.statusCode).toBe(409);
        expect(beforeChecksRes.json()).toMatchObject({
            error: 'CLOSE_REPORT_NOT_READY',
            message: expect.stringContaining('请先发起关账检查'),
        });

        const generateRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/checks:generate`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                periodId,
                mockDataset: 'general-ledger-basic',
            },
        });
        expect(generateRes.statusCode).toBe(200);
        const findingId = generateRes.json().findings[0].id;

        const beforeReviewRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/report-snapshots`,
            headers: {authorization: `Bearer ${token}`},
            payload: {periodId},
        });
        expect(beforeReviewRes.statusCode).toBe(409);
        expect(beforeReviewRes.json()).toMatchObject({
            error: 'CLOSE_REPORT_NOT_READY',
            message: expect.stringContaining('阻塞异常尚未提交复核'),
        });

        const reviewRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/findings/${findingId}/submit-review`,
            headers: {authorization: `Bearer ${token}`},
            payload: {
                reason: '阻塞项需要复核。',
            },
        });
        expect(reviewRes.statusCode).toBe(201);

        const pendingReviewRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/report-snapshots`,
            headers: {authorization: `Bearer ${token}`},
            payload: {periodId},
        });
        expect(pendingReviewRes.statusCode).toBe(409);
        expect(pendingReviewRes.json()).toMatchObject({
            error: 'CLOSE_REPORT_NOT_READY',
            message: expect.stringContaining('阻塞异常等待复核决策'),
        });
    });

    test('报告快照必须等待会计期间进入已批准状态', async () => {
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/v1/closing/workspaces',
            headers: {authorization: `Bearer ${token}`},
            payload: {
                name: '期间状态门禁工作区',
                period: {
                    periodKey: '2026-10',
                    startsAt: '2026-10-01T00:00:00.000Z',
                    endsAt: '2026-10-31T23:59:59.000Z',
                },
            },
        });
        expect(createRes.statusCode).toBe(201);
        const workspaceId = createRes.json().workspace.id;
        const periodId = createRes.json().currentPeriod.id;

        const generateRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/checks:generate`,
            headers: {authorization: `Bearer ${token}`},
            payload: {periodId, mockDataset: 'general-ledger-basic'},
        });
        expect(generateRes.statusCode).toBe(200);

        const reviewRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/findings/${generateRes.json().findings[0].id}/submit-review`,
            headers: {authorization: `Bearer ${token}`},
            payload: {reason: '阻塞项需要复核。'},
        });
        expect(reviewRes.statusCode).toBe(201);

        const approveRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/reviews/${reviewRes.json().review.id}/approve`,
            headers: {authorization: `Bearer ${token}`},
            payload: {reason: '允许进入报告。'},
        });
        expect(approveRes.statusCode).toBe(200);

        await db
            .update(accountingPeriods)
            .set({status: 'review_pending', updatedAt: new Date()})
            .where(eq(accountingPeriods.id, periodId));

        const reportRes = await app.inject({
            method: 'POST',
            url: `/api/v1/closing/workspaces/${workspaceId}/report-snapshots`,
            headers: {authorization: `Bearer ${token}`},
            payload: {periodId},
        });
        expect(reportRes.statusCode).toBe(409);
        expect(reportRes.json()).toMatchObject({
            error: 'CLOSE_REPORT_NOT_READY',
            message: expect.stringContaining('会计期间尚未批准'),
        });
    });

    test('报告详情不存在时返回标准错误信封', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/closing/report-snapshots/missing-report',
            headers: {authorization: `Bearer ${token}`},
        });

        expect(res.statusCode).toBe(404);
        expect(res.headers['x-request-id']).toEqual(expect.any(String));
        expect(res.json()).toMatchObject({
            error: 'RESOURCE_NOT_FOUND',
            message: '未找到对应关账资源，或你没有权限访问。',
            requestId: expect.any(String),
            details: {},
        });
    });
});
