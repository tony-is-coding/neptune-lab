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
    PolicySubjectType,
    PolicyType,
} from '@shared/neptune-ai';
import {runFactService} from './run-facts.js';
import {createLogger} from '../utils/logger.js';

const log = createLogger('policy-decision');

export interface PolicyDecisionListFilters {
    runId?: string;
    decision?: string;
    policyType?: string;
    subjectType?: string;
    limit?: number;
    offset?: number;
}

/**
 * Recorder 接口：让 permission-delegate 这种"不能直接依赖 service"的进程内回调
 * 也能写入 PolicyDecision，并保持解耦便于测试 mock。
 *
 * 实现要求：
 *   - record() 的失败不能 break 业务流程（调用方应该 .catch 兜底）
 *   - record(allow) 应该是 no-op 或只在显式开启时写入，避免噪声
 */
export interface PolicyDecisionRecorder {
    /** 记录拒绝决策。一定写入 policy_decisions。*/
    recordDeny(input: PolicyDecisionDenyInput): Promise<PolicyDecision>;
    /** 记录"需要人工复核"。一定写入。*/
    recordReviewRequired(input: PolicyDecisionDenyInput): Promise<PolicyDecision>;
}

export interface PolicyDecisionDenyInput {
    tenantId: string;
    runId?: string | null;
    requestId?: string;
    policyType: PolicyType;
    subjectType: PolicySubjectType;
    subjectId: string;
    reason: string;
    details?: Record<string, unknown>;
}

export class PolicyDecisionService implements PolicyDecisionRecorder {
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

        // 如果该决策关联到具体 Run，同步写一条 run_events 让治理台 SSE 流实时看到。
        // 注意：写 run_events 失败不能阻塞决策返回（事实已落 policy_decisions 表）。
        if (params.runId) {
            await runFactService.recordEvent({
                tenantId: params.tenantId,
                runId: params.runId,
                eventType: 'policy.decision.recorded',
                requestId: params.requestId,
                payloadSummary: {
                    policyDecisionId: decision.id,
                    policyType: decision.policyType,
                    subjectType: decision.subjectType,
                    subjectId: decision.subjectId,
                    decision: decision.decision,
                    reason: decision.reason,
                },
            }).catch(error => {
                log.warn('PolicyDecision run_events publish failed', {
                    runId: params.runId,
                    policyType: decision.policyType,
                    detail: (error as Error).message,
                });
            });
        }

        return decision;
    }

    /**
     * 写入 deny 决策。是 PolicyDecision 的主要写入入口（治理事实）。
     * 调用方负责把对应的 audit_event 也写好（按需要决定是否要审计事件）。
     */
    async recordDeny(input: PolicyDecisionDenyInput): Promise<PolicyDecision> {
        return this.record({
            ...input,
            decision: 'deny',
        });
    }

    /**
     * 写入 review_required 决策。同样是治理事实主要入口。
     */
    async recordReviewRequired(input: PolicyDecisionDenyInput): Promise<PolicyDecision> {
        return this.record({
            ...input,
            decision: 'review_required',
        });
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
