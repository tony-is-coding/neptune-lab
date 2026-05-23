import {and, desc, eq, sql, type SQL} from 'drizzle-orm';
import {
    db,
    policyDecisions,
    type PolicyDecision,
} from '../db';
import type {
    PolicyDecisionDto,
    PolicyDecisionListResponse,
    PolicyDecisionResult,
} from '@shared/neptune-ai';

export interface PolicyDecisionListFilters {
    runId?: string;
    decision?: string;
    policyType?: string;
    subjectType?: string;
    limit?: number;
    offset?: number;
}

export class PolicyDecisionService {
    async record(params: {
        tenantId: string;
        runId?: string | null;
        requestId?: string;
        policyType: string;
        subjectType: string;
        subjectId: string;
        decision: PolicyDecisionResult;
        reason: string;
        details?: Record<string, unknown>;
    }): Promise<PolicyDecision> {
        const [decision] = await db.insert(policyDecisions).values({
            tenantId: params.tenantId,
            runId: params.runId ?? null,
            requestId: params.requestId,
            policyType: params.policyType,
            subjectType: params.subjectType,
            subjectId: params.subjectId,
            decision: params.decision,
            reason: params.reason,
            detailsSummary: redactSummary(params.details ?? {}),
        }).returning();

        return decision;
    }

    async listByTenant(
        tenantId: string,
        filters: PolicyDecisionListFilters = {},
    ): Promise<PolicyDecisionListResponse> {
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const conditions: SQL[] = [eq(policyDecisions.tenantId, tenantId)];

        if (filters.runId) conditions.push(eq(policyDecisions.runId, filters.runId));
        if (filters.decision) conditions.push(eq(policyDecisions.decision, filters.decision));
        if (filters.policyType) conditions.push(eq(policyDecisions.policyType, filters.policyType));
        if (filters.subjectType) conditions.push(eq(policyDecisions.subjectType, filters.subjectType));

        const where = and(...conditions);
        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(policyDecisions)
            .where(where);
        const data = await db
            .select()
            .from(policyDecisions)
            .where(where)
            .orderBy(desc(policyDecisions.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toPolicyDecisionDto),
            meta: {
                count: countResult[0]?.count ?? 0,
                limit,
                offset,
            },
        };
    }
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
}

function toPolicyDecisionDto(decision: PolicyDecision): PolicyDecisionDto {
    return {
        id: decision.id,
        tenantId: decision.tenantId,
        runId: decision.runId ?? null,
        requestId: decision.requestId ?? null,
        policyType: decision.policyType,
        subjectType: decision.subjectType,
        subjectId: decision.subjectId,
        decision: decision.decision as PolicyDecisionResult,
        reason: decision.reason,
        detailsSummary: decision.detailsSummary ?? {},
        createdAt: toIsoString(decision.createdAt) ?? new Date(0).toISOString(),
    };
}

function redactSummary(value: Record<string, unknown>): Record<string, unknown> {
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
    if (Array.isArray(value)) {
        return {type: 'array', count: value.length};
    }
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
    return /token|secret|credential|password|api[_-]?key|auth/i.test(key);
}

export const policyDecisionService = new PolicyDecisionService();
