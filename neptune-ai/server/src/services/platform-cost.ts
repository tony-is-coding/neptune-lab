import {and, eq, sql, type SQL} from 'drizzle-orm';
import {billingRecords, db, sessions, tenants} from '../db';
import type {CostSummaryDto, CostSummaryPeriod, QuotaStatusDto} from '@shared/neptune-ai';
import {costAggregator} from './cost';

export class PlatformCostService {
    async getQuotaStatus(tenantId: string): Promise<QuotaStatusDto> {
        const gate = await costAggregator.checkTenantQuotaGate(tenantId);
        const remainingTokens = Math.max(gate.quota.maxTokensPerDay - gate.usage.totalTokensToday, 0);
        const remainingSessions = Math.max(gate.quota.maxConcurrentSessions - gate.usage.runningSessions, 0);

        return {
            tenantId,
            allowed: gate.allowed,
            reason: gate.reason ?? null,
            quota: gate.quota,
            usage: gate.usage,
            remaining: {
                tokensToday: remainingTokens,
                concurrentSessions: remainingSessions,
            },
            message: getQuotaStatusMessage(gate.allowed, gate.reason),
            updatedAt: new Date().toISOString(),
        };
    }

    async getCostSummary(tenantId: string, period: CostSummaryPeriod = 'today'): Promise<CostSummaryDto> {
        const periodStart = getPeriodStart(period);
        const usageConditions: SQL[] = [eq(billingRecords.tenantId, tenantId)];
        if (periodStart) {
            usageConditions.push(sql`${billingRecords.createdAt} >= ${periodStart.toISOString()}`);
        }
        const usageWhere = and(...usageConditions);

        const [tenant] = await db
            .select({quota: tenants.quota})
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1);

        const [summary] = await db
            .select({
                totalInputTokens: sql<number>`coalesce(sum(${billingRecords.inputTokens}), 0)::int`,
                totalOutputTokens: sql<number>`coalesce(sum(${billingRecords.outputTokens}), 0)::int`,
                totalCostCents: sql<number>`coalesce(sum(${billingRecords.costCents}), 0)::int`,
                recordCount: sql<number>`count(*)::int`,
            })
            .from(billingRecords)
            .where(usageWhere);

        const byModel = await db
            .select({
                model: billingRecords.model,
                inputTokens: sql<number>`coalesce(sum(${billingRecords.inputTokens}), 0)::int`,
                outputTokens: sql<number>`coalesce(sum(${billingRecords.outputTokens}), 0)::int`,
                costCents: sql<number>`coalesce(sum(${billingRecords.costCents}), 0)::int`,
                recordCount: sql<number>`count(*)::int`,
            })
            .from(billingRecords)
            .where(usageWhere)
            .groupBy(billingRecords.model)
            .having(sql`count(*) > 0`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [todayUsage] = await db
            .select({
                totalTokensToday: sql<number>`coalesce(sum(${billingRecords.inputTokens} + ${billingRecords.outputTokens}), 0)::int`,
            })
            .from(billingRecords)
            .where(and(
                eq(billingRecords.tenantId, tenantId),
                sql`${billingRecords.createdAt} >= ${today.toISOString()}`,
            ));

        const [running] = await db
            .select({
                runningSessions: sql<number>`count(*)::int`,
            })
            .from(sessions)
            .where(and(
                eq(sessions.tenantId, tenantId),
                eq(sessions.status, 'running'),
            ));

        const quota = tenant?.quota ?? {
            maxTokensPerDay: 1000000,
            maxConcurrentSessions: 10,
        };
        const totalInputTokens = toNumber(summary?.totalInputTokens);
        const totalOutputTokens = toNumber(summary?.totalOutputTokens);

        return {
            tenantId,
            period,
            totalInputTokens,
            totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
            totalCostCents: toNumber(summary?.totalCostCents),
            recordCount: toNumber(summary?.recordCount),
            quota,
            quotaUsage: {
                totalTokensToday: toNumber(todayUsage?.totalTokensToday),
                runningSessions: toNumber(running?.runningSessions),
            },
            byModel: byModel.map(row => ({
                model: row.model ?? null,
                inputTokens: toNumber(row.inputTokens),
                outputTokens: toNumber(row.outputTokens),
                totalTokens: toNumber(row.inputTokens) + toNumber(row.outputTokens),
                costCents: toNumber(row.costCents),
                recordCount: toNumber(row.recordCount),
            })),
            updatedAt: new Date().toISOString(),
        };
    }
}

function getQuotaStatusMessage(
    allowed: boolean,
    reason?: QuotaStatusDto['reason'],
): string {
    if (allowed) {
        return '当前租户配额允许发起新的运行';
    }
    if (reason === 'CONCURRENT_SESSION_LIMIT') {
        return '租户并发运行数已达到上限';
    }
    return '租户 token 配额不足';
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

function getPeriodStart(period: CostSummaryPeriod): Date | null {
    const now = new Date();
    if (period === 'today') {
        now.setHours(0, 0, 0, 0);
        return now;
    }
    if (period === 'month_to_date') {
        now.setDate(1);
        now.setHours(0, 0, 0, 0);
        return now;
    }
    return null;
}

export const platformCostService = new PlatformCostService();
