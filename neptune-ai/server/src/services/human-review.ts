import {and, desc, eq, sql, type SQL} from 'drizzle-orm';
import {db, humanReviews, runs, type HumanReview} from '../db';
import {auditEventService} from './audit';
import type {
    CreateHumanReviewRequest,
    DecideHumanReviewRequest,
    HumanReviewDecision,
    HumanReviewDto,
    HumanReviewListResponse,
    HumanReviewStatus,
} from '@shared/neptune-ai';

export interface HumanReviewListFilters {
    runId?: string;
    status?: HumanReviewStatus;
    reviewType?: string;
    assignedTo?: string;
    limit?: number;
    offset?: number;
}

export class HumanReviewService {
    async create(params: {
        tenantId: string;
        userId: string;
        input: CreateHumanReviewRequest;
    }): Promise<HumanReviewDto> {
        if (!params.input.title?.trim()) throw new Error('TITLE_REQUIRED');
        if (!params.input.reason?.trim()) throw new Error('REASON_REQUIRED');
        if (!params.input.subjectType?.trim() || !params.input.subjectId?.trim()) {
            throw new Error('SUBJECT_REQUIRED');
        }

        if (params.input.runId) {
            await this.assertRunInTenant(params.tenantId, params.input.runId);
        }

        const [review] = await db.insert(humanReviews).values({
            tenantId: params.tenantId,
            runId: params.input.runId ?? null,
            requestId: params.input.requestId ?? null,
            reviewType: params.input.reviewType,
            status: 'pending',
            subjectType: params.input.subjectType,
            subjectId: params.input.subjectId,
            title: params.input.title.trim(),
            reason: params.input.reason.trim(),
            assignedTo: params.input.assignedTo ?? null,
            requestedBy: params.userId,
            metadataSummary: sanitizeSummary(params.input.metadataSummary ?? {}),
        }).returning();

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: review.requestId ?? undefined,
            action: 'human_review.requested',
            resourceType: 'human_review',
            resourceId: review.id,
            metadata: {
                runId: review.runId,
                reviewType: review.reviewType,
                subjectType: review.subjectType,
                subjectId: review.subjectId,
                ...review.metadataSummary,
            },
        });

        return toHumanReviewDto(review);
    }

    async decide(params: {
        tenantId: string;
        userId: string;
        reviewId: string;
        input: DecideHumanReviewRequest;
    }): Promise<HumanReviewDto> {
        const decision = normalizeDecision(params.input.decision);
        if (!decision) throw new Error('INVALID_DECISION');
        if (!params.input.reason?.trim()) throw new Error('REASON_REQUIRED');

        const [existing] = await db.select()
            .from(humanReviews)
            .where(and(
                eq(humanReviews.tenantId, params.tenantId),
                eq(humanReviews.id, params.reviewId),
            ))
            .limit(1);

        if (!existing) throw new Error('REVIEW_NOT_FOUND');
        if (existing.status !== 'pending') throw new Error('REVIEW_ALREADY_DECIDED');

        const status = decisionToStatus(decision);
        const [updated] = await db.update(humanReviews)
            .set({
                status,
                decision,
                decisionReason: params.input.reason.trim(),
                decisionSummary: sanitizeSummary(params.input.decisionSummary ?? {}),
                decidedBy: params.userId,
                decidedAt: new Date(),
            })
            .where(and(
                eq(humanReviews.tenantId, params.tenantId),
                eq(humanReviews.id, params.reviewId),
            ))
            .returning();

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: updated.requestId ?? undefined,
            action: decisionToAuditAction(decision),
            resourceType: 'human_review',
            resourceId: updated.id,
            metadata: {
                runId: updated.runId,
                reviewType: updated.reviewType,
                subjectType: updated.subjectType,
                subjectId: updated.subjectId,
                decision,
                reason: params.input.reason.trim(),
                ...updated.metadataSummary,
            },
        });

        return toHumanReviewDto(updated);
    }

    async listByTenant(
        tenantId: string,
        filters: HumanReviewListFilters = {},
    ): Promise<HumanReviewListResponse> {
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const conditions: SQL[] = [eq(humanReviews.tenantId, tenantId)];

        if (filters.runId) conditions.push(eq(humanReviews.runId, filters.runId));
        if (filters.status) conditions.push(eq(humanReviews.status, filters.status));
        if (filters.reviewType) conditions.push(eq(humanReviews.reviewType, filters.reviewType));
        if (filters.assignedTo) conditions.push(eq(humanReviews.assignedTo, filters.assignedTo));

        const where = and(...conditions);
        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(humanReviews)
            .where(where);
        const data = await db
            .select()
            .from(humanReviews)
            .where(where)
            .orderBy(desc(humanReviews.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toHumanReviewDto),
            meta: {
                count: toNumber(countResult[0]?.count),
                limit,
                offset,
            },
        };
    }

    private async assertRunInTenant(tenantId: string, runId: string): Promise<void> {
        const [run] = await db.select({id: runs.id})
            .from(runs)
            .where(and(eq(runs.tenantId, tenantId), eq(runs.id, runId)))
            .limit(1);

        if (!run) {
            throw new Error('RUN_NOT_FOUND');
        }
    }
}

function toHumanReviewDto(review: HumanReview): HumanReviewDto {
    return {
        id: review.id,
        tenantId: review.tenantId,
        runId: review.runId ?? null,
        requestId: review.requestId ?? null,
        reviewType: review.reviewType,
        status: review.status as HumanReviewStatus,
        subjectType: review.subjectType,
        subjectId: review.subjectId,
        title: review.title,
        reason: review.reason,
        assignedTo: review.assignedTo ?? null,
        requestedBy: review.requestedBy ?? null,
        decidedBy: review.decidedBy ?? null,
        decision: review.decision as HumanReviewDecision | null,
        decisionReason: review.decisionReason ?? null,
        decisionSummary: review.decisionSummary ?? {},
        createdAt: toIsoString(review.createdAt) ?? new Date(0).toISOString(),
        decidedAt: toIsoString(review.decidedAt),
    };
}

function normalizeDecision(decision: string | undefined): HumanReviewDecision | null {
    if (decision === 'approve' || decision === 'reject' || decision === 'waive') return decision;
    return null;
}

function decisionToStatus(decision: HumanReviewDecision): HumanReviewStatus {
    if (decision === 'approve') return 'approved';
    if (decision === 'reject') return 'rejected';
    return 'waived';
}

function decisionToAuditAction(decision: HumanReviewDecision): string {
    if (decision === 'approve') return 'human_review.approved';
    if (decision === 'reject') return 'human_review.rejected';
    return 'human_review.waived';
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

function sanitizeSummary(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            if (isSensitiveKey(key)) return [key, '[redacted]'];
            return [key, summarizeUnknown(item)];
        }),
    );
}

function summarizeUnknown(value: unknown): unknown {
    if (typeof value === 'string') {
        return value.length > 240 ? `${value.slice(0, 240)}...` : value;
    }
    if (Array.isArray(value)) return {type: 'array', count: value.length};
    if (value && typeof value === 'object') {
        const objectValue = value as Record<string, unknown>;
        return {
            type: 'object',
            keys: Object.keys(objectValue).filter(key => !isSensitiveKey(key)).slice(0, 20),
        };
    }
    return value ?? null;
}

function isSensitiveKey(key: string): boolean {
    return /token|secret|credential|password|api[_-]?key|auth|content|body|text/i.test(key);
}

export const humanReviewService = new HumanReviewService();
