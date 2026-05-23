import {createHash, randomUUID} from 'crypto';
import {and, desc, eq, inArray, sql, type SQL} from 'drizzle-orm';
import {
    accountingPeriods,
    agentTemplates,
    artifacts,
    auditEvents,
    checklistItems,
    closeReports,
    closeWorkspaces,
    db,
    evidenceArtifacts,
    findings,
    humanReviews,
    runs,
    sessions,
    type AccountingPeriod,
    type ChecklistItem,
    type CloseReport,
    type CloseWorkspace,
    type Finding,
    type HumanReview,
} from '../db';
import {artifactEvidenceService, toArtifactDto, toEvidenceArtifactDto} from './artifact-evidence';
import {auditEventService} from './audit';
import {humanReviewService} from './human-review';
import {runAdmissionService} from './run-admission';
import type {
    AccountingPeriodDto,
    AccountingPeriodStatus,
    ChecklistItemDto,
    CloseReportDetailResponse,
    CloseReportDto,
    CloseWorkflowTimelineItemDto,
    CloseWorkflowTimelineKind,
    CloseWorkflowTimelineResponse,
    CloseWorkspaceDto,
    CloseWorkspaceListResponse,
    CloseWorkspaceOverviewResponse,
    CreateCloseWorkspaceRequest,
    CreateCloseWorkspaceResponse,
    DecideCloseReviewResponse,
    FindingDto,
    GenerateCloseChecksRequest,
    GenerateCloseChecksResponse,
    GenerateCloseReportRequest,
    CloseEvidenceArtifactListResponse,
    ImportCloseCsvEvidenceRequest,
    ImportCloseCsvEvidenceResponse,
    SubmitFindingReviewResponse,
} from '@shared/neptune-ai';

interface ListFilters {
    limit?: number;
    offset?: number;
}

const periodTransitionMatrix: Record<AccountingPeriodStatus, AccountingPeriodStatus[]> = {
    draft: ['open'],
    open: ['checking'],
    checking: ['review_pending', 'approved'],
    review_pending: ['checking', 'approved'],
    approved: ['closed'],
    closed: [],
    locked: [],
};

export class ClosingWorkbenchService {
    async createWorkspace(params: {
        tenantId: string;
        userId: string;
        requestId?: string;
        input: CreateCloseWorkspaceRequest;
    }): Promise<CreateCloseWorkspaceResponse> {
        if (!params.input.name?.trim()) throw new Error('NAME_REQUIRED');
        if (!params.input.period?.periodKey?.trim()) throw new Error('PERIOD_REQUIRED');

        const [workspace] = await db.insert(closeWorkspaces).values({
            tenantId: params.tenantId,
            name: params.input.name.trim(),
            scope: sanitizeSummary(params.input.scope ?? {}),
            status: 'active',
            createdBy: params.userId,
        }).returning();

        const [period] = await db.insert(accountingPeriods).values({
            tenantId: params.tenantId,
            workspaceId: workspace.id,
            periodKey: params.input.period.periodKey,
            startsAt: new Date(params.input.period.startsAt),
            endsAt: new Date(params.input.period.endsAt),
            status: 'open',
            metadataSummary: {},
        }).returning();

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'closing.workspace.created',
            resourceType: 'closing_workspace',
            resourceId: workspace.id,
            metadata: {
                periodId: period.id,
                periodKey: period.periodKey,
            },
        });

        return {
            workspace: toCloseWorkspaceDto(workspace),
            currentPeriod: toAccountingPeriodDto(period),
        };
    }

    async listWorkspaces(tenantId: string, filters: ListFilters = {}): Promise<CloseWorkspaceListResponse> {
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(closeWorkspaces)
            .where(eq(closeWorkspaces.tenantId, tenantId));
        const data = await db
            .select()
            .from(closeWorkspaces)
            .where(eq(closeWorkspaces.tenantId, tenantId))
            .orderBy(desc(closeWorkspaces.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toCloseWorkspaceDto),
            meta: {count: toNumber(countResult[0]?.count), limit, offset},
        };
    }

    async getWorkspace(tenantId: string, workspaceId: string): Promise<CreateCloseWorkspaceResponse> {
        const workspace = await this.getWorkspaceOrThrow(tenantId, workspaceId);
        const [period] = await db
            .select()
            .from(accountingPeriods)
            .where(and(
                eq(accountingPeriods.tenantId, tenantId),
                eq(accountingPeriods.workspaceId, workspaceId),
            ))
            .orderBy(desc(accountingPeriods.createdAt))
            .limit(1);

        if (!period) throw new Error('PERIOD_NOT_FOUND');
        return {
            workspace: toCloseWorkspaceDto(workspace),
            currentPeriod: toAccountingPeriodDto(period),
        };
    }

    async getOverview(tenantId: string, workspaceId: string): Promise<CloseWorkspaceOverviewResponse> {
        const {workspace, currentPeriod} = await this.getWorkspace(tenantId, workspaceId);
        const checklist = currentPeriod
            ? await this.listChecklistRows(tenantId, currentPeriod.id)
            : [];
        const findingRows = currentPeriod
            ? await this.listFindingRows(tenantId, currentPeriod.id)
            : [];
        const [latestReport] = currentPeriod
            ? await db.select()
                .from(closeReports)
                .where(and(eq(closeReports.tenantId, tenantId), eq(closeReports.periodId, currentPeriod.id)))
                .orderBy(desc(closeReports.createdAt))
                .limit(1)
            : [];

        return {
            workspace,
            currentPeriod,
            checklistSummary: {
                total: checklist.length,
                passed: checklist.filter(item => item.status === 'passed').length,
                failed: checklist.filter(item => item.status === 'failed').length,
                blocking: checklist.filter(item => item.severity === 'blocking').length,
                reviewPending: checklist.filter(item => item.status === 'review_pending').length,
            },
            findingSummary: {
                open: findingRows.filter(item => item.status === 'open' || item.status === 'review_pending').length,
                resolved: findingRows.filter(item => item.status === 'approved' || item.status === 'resolved').length,
                waived: findingRows.filter(item => item.status === 'waived').length,
                blocking: findingRows.filter(item => item.severity === 'blocking').length,
            },
            latestReport: latestReport ? toCloseReportDto(latestReport) : null,
        };
    }

    async listChecklist(tenantId: string, workspaceId: string): Promise<{data: ChecklistItemDto[]; meta: {count: number; limit: number; offset: number}}> {
        const {currentPeriod} = await this.getWorkspace(tenantId, workspaceId);
        const rows = await this.listChecklistRows(tenantId, currentPeriod.id);
        return {
            data: rows.map(toChecklistItemDto),
            meta: {count: rows.length, limit: rows.length, offset: 0},
        };
    }

    async listFindings(tenantId: string, workspaceId: string): Promise<{data: FindingDto[]; meta: {count: number; limit: number; offset: number}}> {
        const {currentPeriod} = await this.getWorkspace(tenantId, workspaceId);
        const rows = await this.listFindingRows(tenantId, currentPeriod.id);
        const data = await this.toFindingDtos(rows);
        return {
            data,
            meta: {count: data.length, limit: data.length, offset: 0},
        };
    }

    async listReports(tenantId: string, workspaceId: string): Promise<{data: CloseReportDto[]; meta: {count: number; limit: number; offset: number}}> {
        await this.getWorkspaceOrThrow(tenantId, workspaceId);
        const rows = await db.select()
            .from(closeReports)
            .where(and(eq(closeReports.tenantId, tenantId), eq(closeReports.workspaceId, workspaceId)))
            .orderBy(desc(closeReports.createdAt));
        return {
            data: rows.map(toCloseReportDto),
            meta: {count: rows.length, limit: rows.length, offset: 0},
        };
    }

    async generateChecks(params: {
        tenantId: string;
        userId: string;
        requestId?: string;
        workspaceId: string;
        input: GenerateCloseChecksRequest;
    }): Promise<GenerateCloseChecksResponse> {
        const workspace = await this.getWorkspaceOrThrow(params.tenantId, params.workspaceId);
        let period = await this.getPeriodOrThrow(params.tenantId, params.input.periodId, workspace.id);

        period = await this.transitionPeriod({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            period,
            toStatus: 'checking',
            trigger: 'check_run_started',
        });

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'closing.check_run.started',
            resourceType: 'closing_workspace',
            resourceId: workspace.id,
            metadata: {periodId: period.id, mockDataset: params.input.mockDataset ?? 'general-ledger-basic'},
        });

        const existingChecklist = await this.listChecklistRows(params.tenantId, period.id);
        if (existingChecklist.length > 0) {
            await db.delete(findings).where(and(eq(findings.tenantId, params.tenantId), eq(findings.periodId, period.id)));
            await db.delete(checklistItems).where(and(eq(checklistItems.tenantId, params.tenantId), eq(checklistItems.periodId, period.id)));
        }

        const insertedChecklist = await db.insert(checklistItems).values(defaultChecklist(workspace.id, period.id, params.tenantId)).returning();
        const failedItem = insertedChecklist.find(item => item.code === 'unposted_vouchers') ?? insertedChecklist[0];
        const artifact = await artifactEvidenceService.recordRuntimeArtifact({
            tenantId: params.tenantId,
            runId: await this.ensureSyntheticRun(params.tenantId, params.userId, params.requestId, workspace.id, period.id),
            requestId: params.requestId,
            userId: params.userId,
            title: `${period.periodKey} 未过账凭证检查证据`,
            storageUri: `memory://closing/${workspace.id}/${period.periodKey}/unposted-vouchers`,
            content: `${period.periodKey}: 发现 3 张未过账凭证。`,
            mimeType: 'application/json',
            sourceRef: 'mock:general-ledger-basic',
            metadataSummary: {
                sourceSystem: 'mock-erp',
                rowCount: 3,
                amountCents: 1280000,
                credential: 'hidden',
            },
        });
        const evidence = await artifactEvidenceService.recordEvidenceForArtifact({
            tenantId: params.tenantId,
            artifactId: artifact.id,
            runId: artifact.runId!,
            requestId: params.requestId,
            userId: params.userId,
            evidenceType: 'generated_extract',
            sourceSystem: 'mock-erp',
            sourceUri: `mock://erp/${period.periodKey}/unposted-vouchers`,
            sourceHash: artifact.sha256,
            metadataSummary: {
                workspaceId: workspace.id,
                periodId: period.id,
                periodKey: period.periodKey,
                checklistCode: failedItem.code,
                voucherSampleCount: 3,
                body: 'voucher body should be redacted',
            },
        });

        const [finding] = await db.insert(findings).values({
            tenantId: params.tenantId,
            workspaceId: workspace.id,
            periodId: period.id,
            checklistItemId: failedItem.id,
            runId: artifact.runId,
            title: '存在未过账凭证',
            summary: '总账检查发现 3 张未过账凭证，可能阻塞本期关账。',
            severity: 'blocking',
            status: 'open',
            evidenceArtifactIds: [evidence.id],
            metadataSummary: {
                impactedVoucherCount: 3,
                amountCents: 1280000,
            },
        }).returning();

        await db.update(checklistItems)
            .set({status: 'failed', runId: artifact.runId, updatedAt: new Date()})
            .where(eq(checklistItems.id, failedItem.id));

        const refreshedChecklist = await this.listChecklistRows(params.tenantId, period.id);
        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'closing.check_run.completed',
            resourceType: 'closing_workspace',
            resourceId: workspace.id,
            metadata: {
                periodId: period.id,
                totalChecks: refreshedChecklist.length,
                findingCount: 1,
                evidenceArtifactId: evidence.id,
                findingId: finding.id,
            },
        });

        const findingDtos = await this.toFindingDtos([finding]);
        await this.transitionPeriod({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            period,
            toStatus: findingDtos.some(item => item.severity === 'blocking') ? 'review_pending' : 'approved',
            trigger: 'check_run_completed',
        });

        return {
            summary: {
                totalChecks: refreshedChecklist.length,
                passedCount: refreshedChecklist.filter(item => item.status === 'passed').length,
                findingCount: findingDtos.length,
                evidenceCount: 1,
            },
            checklistItems: refreshedChecklist.map(toChecklistItemDto),
            findings: findingDtos,
        };
    }

    async listEvidenceArtifacts(
        tenantId: string,
        workspaceId: string,
        filters: ListFilters = {},
    ): Promise<CloseEvidenceArtifactListResponse> {
        await this.getWorkspaceOrThrow(tenantId, workspaceId);
        return artifactEvidenceService.listEvidenceArtifactsByWorkspace(tenantId, workspaceId, filters);
    }

    async listWorkflowTimeline(
        tenantId: string,
        workspaceId: string,
        filters: ListFilters = {},
    ): Promise<CloseWorkflowTimelineResponse> {
        const {workspace, currentPeriod} = await this.getWorkspace(tenantId, workspaceId);
        const limit = filters.limit ?? 100;
        const offset = filters.offset ?? 0;
        const rows = await db.select()
            .from(auditEvents)
            .where(and(
                eq(auditEvents.tenantId, tenantId),
                sql`(
                    ${auditEvents.resourceId} = ${workspace.id}
                    or ${auditEvents.resourceId} = ${currentPeriod.id}
                    or ${auditEvents.metadata}->>'workspaceId' = ${workspace.id}
                    or ${auditEvents.metadata}->>'periodId' = ${currentPeriod.id}
                )`,
            ))
            .orderBy(auditEvents.createdAt, auditEvents.id);

        const data = rows.map(row => toCloseWorkflowTimelineItem(row, workspace.id, currentPeriod.id));
        return {
            workspace,
            period: currentPeriod,
            data: data.slice(offset, offset + limit),
            meta: {count: data.length, limit, offset},
        };
    }

    async importCsvEvidence(params: {
        tenantId: string;
        userId: string;
        requestId?: string;
        workspaceId: string;
        input: ImportCloseCsvEvidenceRequest;
    }): Promise<ImportCloseCsvEvidenceResponse> {
        const workspace = await this.getWorkspaceOrThrow(params.tenantId, params.workspaceId);
        const period = await this.getPeriodOrThrow(params.tenantId, params.input.periodId, workspace.id);
        const fileName = params.input.fileName?.trim();
        const content = params.input.content ?? '';
        if (!fileName || !params.input.periodId || !content.trim() || !fileName.toLowerCase().endsWith('.csv')) {
            throw new Error('CSV_IMPORT_INVALID');
        }

        const summary = summarizeCsv(content);
        const sourceSystem = params.input.sourceSystem?.trim() || 'manual-upload';
        const storageUri = `memory://closing/${workspace.id}/${period.periodKey}/imports/${sha256Hex(`${fileName}:${content}`)}.csv`;
        const artifact = await artifactEvidenceService.recordUploadedArtifact({
            tenantId: params.tenantId,
            requestId: params.requestId,
            userId: params.userId,
            title: fileName,
            storageUri,
            content,
            artifactType: 'dataset',
            mimeType: 'text/csv',
            sourceRef: sourceSystem,
            metadataSummary: {
                workspaceId: workspace.id,
                periodId: period.id,
                periodKey: period.periodKey,
                rowCount: summary.rowCount,
                columnCount: summary.columnCount,
                ledgerName: params.input.ledgerName ?? null,
                accountSet: params.input.accountSet ?? null,
            },
        });
        const evidence = await artifactEvidenceService.recordUploadedEvidenceForArtifact({
            tenantId: params.tenantId,
            artifactId: artifact.id,
            requestId: params.requestId,
            userId: params.userId,
            evidenceType: 'source_file',
            sourceSystem,
            sourceUri: storageUri,
            sourceHash: artifact.sha256,
            metadataSummary: {
                workspaceId: workspace.id,
                periodId: period.id,
                periodKey: period.periodKey,
                fileName,
                rowCount: summary.rowCount,
                columnCount: summary.columnCount,
            },
        });

        const linkedRows: Finding[] = [];
        if (params.input.findingId) {
            const finding = await this.getFindingOrThrow(params.tenantId, params.input.findingId);
            if (finding.workspaceId !== workspace.id || finding.periodId !== period.id) {
                throw new Error('FINDING_NOT_FOUND');
            }
            const nextEvidenceIds = unique([...(finding.evidenceArtifactIds ?? []), evidence.id]);
            const [updated] = await db.update(findings)
                .set({
                    evidenceArtifactIds: nextEvidenceIds,
                    updatedAt: new Date(),
                })
                .where(and(eq(findings.tenantId, params.tenantId), eq(findings.id, finding.id)))
                .returning();
            linkedRows.push(updated);
        }

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'closing.evidence_imported',
            resourceType: 'closing_workspace',
            resourceId: workspace.id,
            metadata: {
                periodId: period.id,
                artifactId: artifact.id,
                evidenceArtifactId: evidence.id,
                linkedFindingIds: linkedRows.map(row => row.id),
                rowCount: summary.rowCount,
                columnCount: summary.columnCount,
            },
        });

        return {
            artifact: toArtifactDto(artifact),
            evidence: toEvidenceArtifactDto(evidence),
            linkedFindings: await this.toFindingDtos(linkedRows),
            summary: {
                ...summary,
                schemaStatus: 'valid',
                linkedFindingCount: linkedRows.length,
            },
        };
    }

    async submitFindingReview(params: {
        tenantId: string;
        userId: string;
        requestId?: string;
        findingId: string;
        reason: string;
    }): Promise<SubmitFindingReviewResponse> {
        const finding = await this.getFindingOrThrow(params.tenantId, params.findingId);
        const review = await humanReviewService.create({
            tenantId: params.tenantId,
            userId: params.userId,
            input: {
                runId: finding.runId,
                requestId: params.requestId,
                reviewType: 'close_finding',
                subjectType: 'closing_finding',
                subjectId: finding.id,
                title: `关账异常复核：${finding.title}`,
                reason: params.reason,
                metadataSummary: {
                    workspaceId: finding.workspaceId,
                    periodId: finding.periodId,
                    checklistItemId: finding.checklistItemId,
                },
            },
        });

        const [updated] = await db.update(findings)
            .set({
                status: 'review_pending',
                humanReviewId: review.id,
                updatedAt: new Date(),
            })
            .where(and(eq(findings.tenantId, params.tenantId), eq(findings.id, finding.id)))
            .returning();

        const [dto] = await this.toFindingDtos([updated]);
        return {finding: dto, review};
    }

    async decideReview(params: {
        tenantId: string;
        userId: string;
        requestId?: string;
        reviewId: string;
        decision: 'approve' | 'reject' | 'waive';
        reason: string;
    }): Promise<DecideCloseReviewResponse> {
        const existing = await this.getReviewOrThrow(params.tenantId, params.reviewId);
        const [finding] = await db.select()
            .from(findings)
            .where(and(
                eq(findings.tenantId, params.tenantId),
                eq(findings.id, existing.subjectId),
            ))
            .limit(1);
        if (!finding) throw new Error('FINDING_NOT_FOUND');

        const review = await humanReviewService.decide({
            tenantId: params.tenantId,
            userId: params.userId,
            reviewId: params.reviewId,
            input: {
                decision: params.decision,
                reason: params.reason,
                decisionSummary: {source: 'closing_workbench'},
            },
        });
        const nextStatus = params.decision === 'approve'
            ? 'approved'
            : params.decision === 'reject'
                ? 'rejected'
                : 'waived';

        const [updated] = await db.update(findings)
            .set({
                status: nextStatus,
                decisionReason: params.reason,
                updatedAt: new Date(),
            })
            .where(and(eq(findings.tenantId, params.tenantId), eq(findings.id, finding.id)))
            .returning();

        const [dto] = await this.toFindingDtos([updated]);
        await this.advancePeriodAfterReviewDecision({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            periodId: updated.periodId,
        });

        return {finding: dto, review};
    }

    async generateReport(params: {
        tenantId: string;
        userId: string;
        requestId?: string;
        workspaceId: string;
        input: GenerateCloseReportRequest;
    }): Promise<CloseReportDto> {
        const workspace = await this.getWorkspaceOrThrow(params.tenantId, params.workspaceId);
        const period = await this.getPeriodOrThrow(params.tenantId, params.input.periodId, workspace.id);
        const checklist = await this.listChecklistRows(params.tenantId, period.id);
        const findingRows = await this.listFindingRows(params.tenantId, period.id);
        const findingDtos = await this.toFindingDtos(findingRows);
        const blockers = getCloseReportBlockers(checklist, findingDtos);
        if (period.status !== 'approved') blockers.push(`会计期间尚未批准，当前状态为 ${period.status}`);
        if (blockers.length > 0) throw new Error(`CLOSE_REPORT_NOT_READY:${blockers.join('；')}`);
        const evidenceIds = unique(findingDtos.flatMap(finding => finding.evidenceArtifactIds));
        const humanReviewIds = unique(findingDtos.map(finding => finding.humanReviewId).filter(Boolean) as string[]);
        const runIds = unique(findingRows.map(finding => finding.runId).filter(Boolean) as string[]);
        const reportAuditRows = await db.select()
            .from(auditEvents)
            .where(and(
                eq(auditEvents.tenantId, params.tenantId),
                sql`(
                    ${auditEvents.resourceId} = ${workspace.id}
                    or (${auditEvents.resourceType} = 'accounting_period' and ${auditEvents.resourceId} = ${period.id})
                )`,
            ));
        const summary = summarizeCloseFacts(checklist, findingDtos, evidenceIds);
        const snapshot = {
            workspace: toCloseWorkspaceDto(workspace),
            period: toAccountingPeriodDto(period),
            checklist: checklist.map(toChecklistItemDto),
            findings: findingDtos,
            summary,
        };
        const snapshotHash = sha256Hex(JSON.stringify(snapshot));

        const [report] = await db.insert(closeReports).values({
            tenantId: params.tenantId,
            workspaceId: workspace.id,
            periodId: period.id,
            status: 'generated',
            title: `${period.periodKey} 关账就绪报告`,
            summary,
            snapshot,
            snapshotHash,
            runIds,
            evidenceArtifactIds: evidenceIds,
            findingIds: findingRows.map(finding => finding.id),
            humanReviewIds,
            auditEventIds: reportAuditRows.map(row => row.id),
            generatedBy: params.userId,
            generatedAt: new Date(),
        }).returning();

        const reportAuditEvent = await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'closing.report_snapshot.generated',
            resourceType: 'closing_report',
            resourceId: report.id,
            metadata: {
                workspaceId: workspace.id,
                periodId: period.id,
                snapshotHash,
            },
        });

        const closedPeriod = await this.transitionPeriod({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            period,
            toStatus: 'closed',
            trigger: 'report_snapshot_generated',
        });

        const [updatedReport] = await db.update(closeReports)
            .set({
                auditEventIds: uniqueNumberIds([
                    ...(report.auditEventIds ?? []),
                    reportAuditEvent.id,
                    ...(closedPeriod.auditEventId ? [closedPeriod.auditEventId] : []),
                ]),
            })
            .where(and(eq(closeReports.tenantId, params.tenantId), eq(closeReports.id, report.id)))
            .returning();

        return toCloseReportDto(updatedReport ?? report);
    }

    async getReportDetail(tenantId: string, reportId: string): Promise<CloseReportDetailResponse> {
        const [report] = await db.select()
            .from(closeReports)
            .where(and(eq(closeReports.tenantId, tenantId), eq(closeReports.id, reportId)))
            .limit(1);
        if (!report) throw new Error('REPORT_NOT_FOUND');

        const reportRunIds = report.runIds ?? [];
        const reportEvidenceIds = report.evidenceArtifactIds ?? [];
        const reportFindingIds = report.findingIds ?? [];
        const reportReviewIds = report.humanReviewIds ?? [];
        const reportAuditEventIds = report.auditEventIds ?? [];
        const runRows = reportRunIds.length
            ? await db.select().from(runs).where(and(eq(runs.tenantId, tenantId), inArray(runs.id, reportRunIds)))
            : [];
        const evidenceRows = reportEvidenceIds.length
            ? await db.select().from(evidenceArtifacts).where(and(eq(evidenceArtifacts.tenantId, tenantId), inArray(evidenceArtifacts.id, reportEvidenceIds)))
            : [];
        const findingRows = reportFindingIds.length
            ? await db.select().from(findings).where(and(eq(findings.tenantId, tenantId), inArray(findings.id, reportFindingIds)))
            : [];
        const reviewRows = reportReviewIds.length
            ? await db.select().from(humanReviews).where(and(eq(humanReviews.tenantId, tenantId), inArray(humanReviews.id, reportReviewIds)))
            : [];
        const auditRows = reportAuditEventIds.length
            ? await db.select().from(auditEvents).where(and(eq(auditEvents.tenantId, tenantId), inArray(auditEvents.id, reportAuditEventIds)))
            : [];

        return {
            report: toCloseReportDto(report),
            facts: {
                runs: runRows.map(row => ({
                    id: row.id,
                    tenantId: row.tenantId,
                    userId: row.userId,
                    agentId: row.agentId,
                    agentVersionId: row.agentVersionId ?? null,
                    threadId: row.threadId,
                    requestId: row.requestId,
                    status: row.status as any,
                    model: row.model ?? null,
                    inputTokens: row.inputTokens ?? 0,
                    outputTokens: row.outputTokens ?? 0,
                    startedAt: toIsoString(row.startedAt) ?? new Date(0).toISOString(),
                    completedAt: toIsoString(row.completedAt),
                })),
                evidenceArtifacts: evidenceRows.map(row => ({
                    id: row.id,
                    tenantId: row.tenantId,
                    artifactId: row.artifactId,
                    runId: row.runId ?? null,
                    requestId: row.requestId ?? null,
                    evidenceType: row.evidenceType as any,
                    sourceSystem: row.sourceSystem ?? null,
                    sourceUri: row.sourceUri ?? null,
                    sourceHash: row.sourceHash,
                    importedBy: row.importedBy ?? null,
                    capturedAt: toIsoString(row.capturedAt),
                    metadataSummary: sanitizeSummary(row.metadataSummary ?? {}),
                    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
                })),
                findings: await this.toFindingDtos(findingRows),
                humanReviews: reviewRows.map(toHumanReviewDto),
                auditEvents: auditRows.map(row => ({
                    id: row.id,
                    tenantId: row.tenantId,
                    userId: row.userId ?? null,
                    requestId: row.requestId ?? null,
                    action: row.action,
                    resourceType: row.resourceType,
                    resourceId: row.resourceId,
                    outcome: row.outcome,
                    createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
                })),
            },
        };
    }

    private async getWorkspaceOrThrow(tenantId: string, workspaceId: string): Promise<CloseWorkspace> {
        const [workspace] = await db.select()
            .from(closeWorkspaces)
            .where(and(eq(closeWorkspaces.tenantId, tenantId), eq(closeWorkspaces.id, workspaceId)))
            .limit(1);
        if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');
        return workspace;
    }

    private async getPeriodOrThrow(tenantId: string, periodId: string, workspaceId?: string): Promise<AccountingPeriod> {
        const conditions: SQL[] = [
            eq(accountingPeriods.tenantId, tenantId),
            eq(accountingPeriods.id, periodId),
        ];
        if (workspaceId) conditions.push(eq(accountingPeriods.workspaceId, workspaceId));
        const [period] = await db.select()
            .from(accountingPeriods)
            .where(and(...conditions))
            .limit(1);
        if (!period) throw new Error('PERIOD_NOT_FOUND');
        return period;
    }

    private async transitionPeriod(params: {
        tenantId: string;
        userId: string;
        requestId?: string;
        period: AccountingPeriod;
        toStatus: AccountingPeriodStatus;
        trigger: string;
    }): Promise<AccountingPeriod & {auditEventId?: number}> {
        const fromStatus = params.period.status as AccountingPeriodStatus;
        if (fromStatus === params.toStatus) return params.period;

        const allowed = periodTransitionMatrix[fromStatus] ?? [];
        if (!allowed.includes(params.toStatus)) {
            throw new Error(`PERIOD_TRANSITION_INVALID:${fromStatus}->${params.toStatus}`);
        }

        const [updated] = await db.update(accountingPeriods)
            .set({
                status: params.toStatus,
                updatedAt: new Date(),
            })
            .where(and(eq(accountingPeriods.tenantId, params.tenantId), eq(accountingPeriods.id, params.period.id)))
            .returning();

        const event = await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'closing.period.transitioned',
            resourceType: 'accounting_period',
            resourceId: params.period.id,
            metadata: {
                workspaceId: params.period.workspaceId,
                periodKey: params.period.periodKey,
                fromStatus,
                toStatus: params.toStatus,
                trigger: params.trigger,
            },
        });

        return {...updated, auditEventId: event.id};
    }

    private async advancePeriodAfterReviewDecision(params: {
        tenantId: string;
        userId: string;
        requestId?: string;
        periodId: string;
    }): Promise<void> {
        const period = await this.getPeriodOrThrow(params.tenantId, params.periodId);
        if (period.status === 'approved' || period.status === 'closed') return;

        const rows = await this.listFindingRows(params.tenantId, params.periodId);
        const dtos = await this.toFindingDtos(rows);
        const unresolvedBlocking = dtos.some(finding =>
            finding.severity === 'blocking'
            && finding.reviewStatus !== 'approved'
            && finding.reviewStatus !== 'waived'
            && finding.status !== 'resolved',
        );
        if (unresolvedBlocking) return;

        await this.transitionPeriod({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            period,
            toStatus: 'approved',
            trigger: 'blocking_reviews_cleared',
        });
    }

    private async getFindingOrThrow(tenantId: string, findingId: string): Promise<Finding> {
        const [finding] = await db.select()
            .from(findings)
            .where(and(eq(findings.tenantId, tenantId), eq(findings.id, findingId)))
            .limit(1);
        if (!finding) throw new Error('FINDING_NOT_FOUND');
        return finding;
    }

    private async getReviewOrThrow(tenantId: string, reviewId: string): Promise<HumanReview> {
        const [review] = await db.select()
            .from(humanReviews)
            .where(and(eq(humanReviews.tenantId, tenantId), eq(humanReviews.id, reviewId)))
            .limit(1);
        if (!review) throw new Error('REVIEW_NOT_FOUND');
        return review;
    }

    private async listChecklistRows(tenantId: string, periodId: string): Promise<ChecklistItem[]> {
        return db.select()
            .from(checklistItems)
            .where(and(eq(checklistItems.tenantId, tenantId), eq(checklistItems.periodId, periodId)));
    }

    private async listFindingRows(tenantId: string, periodId: string): Promise<Finding[]> {
        return db.select()
            .from(findings)
            .where(and(eq(findings.tenantId, tenantId), eq(findings.periodId, periodId)));
    }

    private async toFindingDtos(rows: Finding[]): Promise<FindingDto[]> {
        const reviewIds = rows.map(row => row.humanReviewId).filter(Boolean) as string[];
        const reviewRows = reviewIds.length
            ? await db.select().from(humanReviews).where(inArray(humanReviews.id, reviewIds))
            : [];
        const reviewById = new Map(reviewRows.map(row => [row.id, row]));

        return rows.map(row => toFindingDto(row, row.humanReviewId ? reviewById.get(row.humanReviewId) : undefined));
    }

    private async ensureSyntheticRun(
        tenantId: string,
        userId: string,
        requestId: string | undefined,
        workspaceId: string,
        periodId: string,
    ): Promise<string> {
        const [agent] = await db.query.agentTemplates.findMany({
            where: (table, {eq}) => eq(table.tenantId, tenantId),
            limit: 1,
        });
        const [session] = await db.query.sessions.findMany({
            where: (table, {eq}) => eq(table.tenantId, tenantId),
            limit: 1,
        });

        const runtimeAgent = agent ?? await this.createClosingAgent(tenantId);
        const runtimeSession = session ?? await this.createClosingSession(tenantId, userId, runtimeAgent.id, workspaceId);
        await runAdmissionService.enforceThreadDispatch({
            thread: {
                id: runtimeSession.id,
                tenantId,
                userId,
                templateId: runtimeAgent.id,
            },
            requestId,
        });

        const [run] = await db.insert(runs).values({
            tenantId,
            userId,
            agentId: runtimeAgent.id,
            threadId: runtimeSession.id,
            requestId: requestId ?? `closing-${workspaceId}`,
            status: 'completed',
            model: 'closing-workbench-mock',
            inputTokens: 0,
            outputTokens: 0,
            metadata: {
                source: 'closing_workbench',
                workspaceId,
                periodId,
            },
            completedAt: new Date(),
        }).returning();

        return run.id;
    }

    private async createClosingAgent(tenantId: string) {
        const [agent] = await db.insert(agentTemplates).values({
            tenantId,
            name: '关账工作台系统检查',
            description: '关账工作台用于记录 mock 检查事实的系统智能体模板',
            systemPrompt: '你是关账工作台系统检查上下文，只用于记录受控运行事实。',
            modelConfig: {
                provider: 'neptune',
                model: 'closing-workbench-mock',
                temperature: 0,
                maxTokens: 1024,
            },
            tools: [],
            skills: [],
            mcpServers: [],
            version: 1,
            isActive: true,
        }).returning();
        return agent;
    }

    private async createClosingSession(tenantId: string, userId: string, agentId: string, workspaceId: string) {
        const [session] = await db.insert(sessions).values({
            id: `closing-${randomUUID()}`,
            tenantId,
            userId,
            templateId: agentId,
            status: 'completed',
            title: '关账检查系统运行',
            summary: '关账工作台自动生成的受控运行事实。',
            workspace: `/tmp/neptune-closing/${tenantId}/${workspaceId}`,
            lastActiveAt: new Date(),
        }).returning();
        return session;
    }
}

function defaultChecklist(workspaceId: string, periodId: string, tenantId: string) {
    return [
        {
            tenantId,
            workspaceId,
            periodId,
            code: 'unposted_vouchers',
            title: '未过账凭证检查',
            description: '检查本期是否存在未过账凭证。',
            severity: 'blocking',
            status: 'pending',
        },
        {
            tenantId,
            workspaceId,
            periodId,
            code: 'period_status',
            title: '会计期间状态检查',
            description: '确认本期会计期间处于可关账检查状态。',
            severity: 'warning',
            status: 'passed',
        },
        {
            tenantId,
            workspaceId,
            periodId,
            code: 'voucher_sequence',
            title: '凭证编号连续性检查',
            description: '检查凭证编号是否存在明显断号。',
            severity: 'warning',
            status: 'passed',
        },
    ];
}

function summarizeCloseFacts(checklist: ChecklistItem[], findingDtos: FindingDto[], evidenceIds: string[]): Record<string, unknown> {
    return {
        totalChecks: checklist.length,
        passedCount: checklist.filter(item => item.status === 'passed').length,
        findingCount: findingDtos.length,
        pendingReviewCount: findingDtos.filter(item => item.reviewStatus === 'pending').length,
        evidenceCount: evidenceIds.length,
        blockingCount: findingDtos.filter(item => item.severity === 'blocking').length,
    };
}

function getCloseReportBlockers(checklist: ChecklistItem[], findingDtos: FindingDto[]): string[] {
    const blockers: string[] = [];
    if (checklist.length === 0) blockers.push('请先发起关账检查');

    const blockingFindings = findingDtos.filter(finding => finding.severity === 'blocking');
    const notSubmitted = blockingFindings.filter(finding => !finding.humanReviewId).length;
    const pending = blockingFindings.filter(finding => finding.reviewStatus === 'pending').length;
    const rejected = blockingFindings.filter(finding => finding.reviewStatus === 'rejected').length;
    const unresolved = blockingFindings.filter(finding =>
        finding.reviewStatus !== 'approved'
        && finding.reviewStatus !== 'waived'
        && finding.status !== 'resolved',
    ).length;

    if (notSubmitted > 0) blockers.push(`${notSubmitted} 个阻塞异常尚未提交复核`);
    if (pending > 0) blockers.push(`${pending} 个阻塞异常等待复核决策`);
    if (rejected > 0) blockers.push(`${rejected} 个阻塞异常已退回，需要重新处理`);
    if (unresolved > 0 && notSubmitted === 0 && pending === 0 && rejected === 0) {
        blockers.push(`${unresolved} 个阻塞异常尚未解除`);
    }

    return blockers;
}

function toCloseWorkspaceDto(workspace: CloseWorkspace): CloseWorkspaceDto {
    return {
        id: workspace.id,
        tenantId: workspace.tenantId,
        name: workspace.name,
        scope: workspace.scope ?? {},
        status: workspace.status as any,
        createdBy: workspace.createdBy ?? null,
        createdAt: toIsoString(workspace.createdAt) ?? new Date(0).toISOString(),
        updatedAt: toIsoString(workspace.updatedAt),
    };
}

function toAccountingPeriodDto(period: AccountingPeriod): AccountingPeriodDto {
    return {
        id: period.id,
        tenantId: period.tenantId,
        workspaceId: period.workspaceId,
        periodKey: period.periodKey,
        startsAt: toIsoString(period.startsAt) ?? new Date(0).toISOString(),
        endsAt: toIsoString(period.endsAt) ?? new Date(0).toISOString(),
        status: period.status as any,
        lockedBy: period.lockedBy ?? null,
        lockedAt: toIsoString(period.lockedAt),
        metadataSummary: period.metadataSummary ?? {},
        createdAt: toIsoString(period.createdAt) ?? new Date(0).toISOString(),
        updatedAt: toIsoString(period.updatedAt),
    };
}

function toChecklistItemDto(item: ChecklistItem): ChecklistItemDto {
    return {
        id: item.id,
        tenantId: item.tenantId,
        workspaceId: item.workspaceId,
        periodId: item.periodId,
        code: item.code,
        title: item.title,
        description: item.description ?? null,
        severity: item.severity as any,
        status: item.status as any,
        runId: item.runId ?? null,
        ownerUserId: item.ownerUserId ?? null,
        reviewerUserId: item.reviewerUserId ?? null,
        metadataSummary: item.metadataSummary ?? {},
        createdAt: toIsoString(item.createdAt) ?? new Date(0).toISOString(),
        updatedAt: toIsoString(item.updatedAt),
    };
}

function toFindingDto(row: Finding, review?: HumanReview): FindingDto {
    const evidenceArtifactIds = row.evidenceArtifactIds ?? [];
    return {
        id: row.id,
        tenantId: row.tenantId,
        workspaceId: row.workspaceId,
        periodId: row.periodId,
        checklistItemId: row.checklistItemId,
        runId: row.runId ?? null,
        title: row.title,
        summary: row.summary,
        severity: row.severity as any,
        status: row.status as any,
        assigneeId: row.assigneeId ?? null,
        evidenceArtifactIds,
        evidenceCount: evidenceArtifactIds.length,
        humanReviewId: row.humanReviewId ?? null,
        reviewStatus: review?.status ?? null,
        decisionReason: row.decisionReason ?? null,
        metadataSummary: row.metadataSummary ?? {},
        createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
        updatedAt: toIsoString(row.updatedAt),
    };
}

function toCloseReportDto(report: CloseReport): CloseReportDto {
    return {
        id: report.id,
        tenantId: report.tenantId,
        workspaceId: report.workspaceId,
        periodId: report.periodId,
        status: report.status as any,
        title: report.title,
        summary: report.summary ?? {},
        snapshot: report.snapshot ?? {},
        snapshotHash: report.snapshotHash,
        runIds: report.runIds ?? [],
        evidenceArtifactIds: report.evidenceArtifactIds ?? [],
        findingIds: report.findingIds ?? [],
        humanReviewIds: report.humanReviewIds ?? [],
        auditEventIds: report.auditEventIds ?? [],
        artifactId: report.artifactId ?? null,
        generatedBy: report.generatedBy ?? null,
        generatedAt: toIsoString(report.generatedAt) ?? new Date(0).toISOString(),
        createdAt: toIsoString(report.createdAt) ?? new Date(0).toISOString(),
    };
}

function toCloseWorkflowTimelineItem(
    event: typeof auditEvents.$inferSelect,
    workspaceId: string,
    fallbackPeriodId: string,
): CloseWorkflowTimelineItemDto {
    const metadata = sanitizeSummary(event.metadata ?? {});
    const periodId = typeof metadata.periodId === 'string' ? metadata.periodId : fallbackPeriodId;
    const classified = classifyTimelineAuditEvent(event.action, metadata);

    return {
        id: `audit-${event.id}`,
        tenantId: event.tenantId,
        workspaceId,
        periodId,
        auditEventId: event.id,
        kind: classified.kind,
        title: classified.title,
        summary: classified.summary,
        status: event.outcome,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        actorUserId: event.userId ?? null,
        requestId: event.requestId ?? null,
        occurredAt: toIsoString(event.createdAt) ?? new Date(0).toISOString(),
        metadataSummary: timelineMetadataSummary(metadata),
    };
}

function classifyTimelineAuditEvent(
    action: string,
    metadata: Record<string, unknown>,
): {kind: CloseWorkflowTimelineKind; title: string; summary: string} {
    if (action === 'closing.workspace.created') {
        return {kind: 'workspace_created', title: '关账工作区已创建', summary: metadata.periodKey ? `会计期间 ${metadata.periodKey}` : '已建立关账工作区和会计期间'};
    }
    if (action === 'closing.check_run.started') {
        return {kind: 'check_run', title: '关账检查已发起', summary: `数据集 ${stringValue(metadata.mockDataset, '未记录')}`};
    }
    if (action === 'closing.check_run.completed') {
        return {kind: 'check_run', title: '关账检查完成', summary: `检查 ${numberValue(metadata.totalChecks)} 项，发现 ${numberValue(metadata.findingCount)} 个异常`};
    }
    if (action === 'closing.evidence_imported') {
        return {kind: 'evidence', title: 'CSV 证据已导入', summary: `${numberValue(metadata.rowCount)} 行，${numberValue(metadata.columnCount)} 列，关联 ${arrayLength(metadata.linkedFindingIds)} 个异常`};
    }
    if (action === 'closing.report_snapshot.generated') {
        return {kind: 'report', title: '关账报告已生成', summary: `快照 ${shortHash(stringValue(metadata.snapshotHash, '未记录'))}`};
    }
    if (action === 'closing.period.transitioned') {
        return {
            kind: 'period_transition',
            title: periodTransitionTitle(stringValue(metadata.toStatus, '')),
            summary: `${statusText(stringValue(metadata.fromStatus, '未记录'))} -> ${statusText(stringValue(metadata.toStatus, '未记录'))}`,
        };
    }
    if (action === 'human_review.requested') {
        return {kind: 'review', title: '异常已提交复核', summary: '等待人工责任判断'};
    }
    if (action === 'human_review.approved') {
        return {kind: 'review', title: '复核已批准', summary: '阻塞异常已通过人工复核'};
    }
    if (action === 'human_review.rejected') {
        return {kind: 'review', title: '复核已退回', summary: '异常需要重新处理'};
    }
    if (action === 'human_review.waived') {
        return {kind: 'review', title: '复核已豁免', summary: '异常已形成豁免责任事实'};
    }
    if (action === 'artifact.created') {
        return {kind: 'artifact', title: '成果文件已登记', summary: `类型 ${stringValue(metadata.artifactType, '未记录')}，来源 ${stringValue(metadata.sourceType, '未记录')}`};
    }
    if (action === 'evidence.created') {
        return {kind: 'evidence', title: '证据事实已登记', summary: `类型 ${stringValue(metadata.evidenceType, '未记录')}，hash ${shortHash(stringValue(metadata.sourceHash, '未记录'))}`};
    }
    if (action === 'quota.blocked') {
        return {kind: 'quota', title: '配额门禁已拦截', summary: '执行前被配额策略拒绝'};
    }

    return {kind: 'other', title: action, summary: '已写入审计事实'};
}

function timelineMetadataSummary(metadata: Record<string, unknown>): Record<string, unknown> {
    const allowedKeys = [
        'periodId',
        'periodKey',
        'fromStatus',
        'toStatus',
        'trigger',
        'totalChecks',
        'findingCount',
        'evidenceArtifactId',
        'findingId',
        'artifactId',
        'rowCount',
        'columnCount',
        'linkedFindingIds',
        'snapshotHash',
    ];
    return Object.fromEntries(allowedKeys
        .filter(key => metadata[key] !== undefined)
        .map(key => [key, metadata[key]]));
}

function periodTransitionTitle(toStatus: string): string {
    if (toStatus === 'checking') return '会计期间进入检查中';
    if (toStatus === 'review_pending') return '会计期间进入待复核';
    if (toStatus === 'approved') return '会计期间已批准';
    if (toStatus === 'closed') return '会计期间已关账';
    return '会计期间状态已变更';
}

function statusText(status: string): string {
    const labels: Record<string, string> = {
        draft: '草稿',
        open: '待检查',
        checking: '检查中',
        review_pending: '待复核',
        approved: '已批准',
        closed: '已关账',
        locked: '已锁定',
    };
    return labels[status] ?? status;
}

function stringValue(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): string {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0';
}

function arrayLength(value: unknown): string {
    return Array.isArray(value) ? String(value.length) : '0';
}

function shortHash(value: string): string {
    if (value.length <= 16) return value;
    return `${value.slice(0, 12)}...`;
}

function toHumanReviewDto(review: HumanReview) {
    return {
        id: review.id,
        tenantId: review.tenantId,
        runId: review.runId ?? null,
        requestId: review.requestId ?? null,
        reviewType: review.reviewType,
        status: review.status as any,
        subjectType: review.subjectType,
        subjectId: review.subjectId,
        title: review.title,
        reason: review.reason,
        assignedTo: review.assignedTo ?? null,
        requestedBy: review.requestedBy ?? null,
        decidedBy: review.decidedBy ?? null,
        decision: review.decision as any,
        decisionReason: review.decisionReason ?? null,
        decisionSummary: review.decisionSummary ?? {},
        createdAt: toIsoString(review.createdAt) ?? new Date(0).toISOString(),
        decidedAt: toIsoString(review.decidedAt),
    };
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
}

function toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function unique<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

function uniqueNumberIds(items: number[]): number[] {
    return Array.from(new Set(items));
}

function summarizeCsv(content: string): {rowCount: number; columnCount: number} {
    const lines = content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    if (lines.length < 2) throw new Error('CSV_IMPORT_INVALID');
    const headers = parseCsvLine(lines[0]);
    if (headers.length === 0 || headers.every(header => !header.trim())) {
        throw new Error('CSV_IMPORT_INVALID');
    }
    return {
        rowCount: lines.length - 1,
        columnCount: headers.length,
    };
}

function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"' && quoted && next === '"') {
            current += '"';
            index += 1;
        } else if (char === '"') {
            quoted = !quoted;
        } else if (char === ',' && !quoted) {
            cells.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    cells.push(current);
    return cells;
}

function sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function sanitizeSummary(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (/token|secret|credential|password|api[_-]?key|auth|content|body|text/i.test(key)) {
                return [key, '[redacted]'];
            }
            if (item && typeof item === 'object') {
                return [key, {type: 'object', keys: Object.keys(item).slice(0, 20)}];
            }
            return [key, item ?? null];
        }),
    );
}

export const closingWorkbenchService = new ClosingWorkbenchService();
