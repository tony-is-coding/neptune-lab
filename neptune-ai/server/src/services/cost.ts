import {db} from '../db/index.js';
import {billingRecords, sessions, tenants} from '../db/schema.js';
import {and, eq, sql} from 'drizzle-orm';
import Redis from 'ioredis';
import {config} from '../config.js';

export interface TenantQuotaGateResult {
    allowed: boolean;
    reason?: 'TOKEN_QUOTA_EXCEEDED' | 'CONCURRENT_SESSION_LIMIT';
    quota: {
        maxTokensPerDay: number;
        maxConcurrentSessions: number;
    };
    usage: {
        totalTokensToday: number;
        runningSessions: number;
    };
}

/**
 * 计费聚合器
 *
 * 职责：
 * - 订录 token 用量到 billing_records 表
 * - 更新 Redis 租户配额计数器
 * - 提供租户账单查询接口
 */
export class CostAggregator {
    private redis: Redis;

    constructor() {
        this.redis = new Redis(config.redis.url, {
            maxRetriesPerRequest: 3,
        });
    }

    /**
     * 记录一次查询的 token 用量
     *
     * runId（可选）让 billing_records 能按 Run 反查，是 P1-2 Run 级成本归因的写入面。
     * 老路径调用方未传 runId 时仍可工作（向后兼容），但治理台 Run detail 的 cost
     * 显示需要 runId 关联——thread-manager 的 dispatch 链已经传。
     */
    async recordUsage(
        tenantId: string,
        sessionId: string,
        userId: string,
        usage: {
            inputTokens: number;
            outputTokens: number;
            model?: string;
            runId?: string | null;
        },
    ): Promise<void> {
        const costCents = this.calculateCost(usage);

        // 1. 写入 billing_records
        await db.insert(billingRecords).values({
            tenantId,
            sessionId,
            runId: usage.runId ?? null,
            userId,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            model: usage.model,
            costCents,
        });

        // 2. 更新 Redis 配额计数器
        const key = `tenant:${tenantId}:quota`;
        await this.redis.hincrby(key, 'inputTokens', usage.inputTokens);
        await this.redis.hincrby(key, 'outputTokens', usage.outputTokens);
        await this.redis.hincrby(key, 'totalCost', costCents);
    }

    /**
     * 获取租户的用量汇总
     */
    async getTenantUsage(tenantId: string): Promise<{
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCostCents: number;
        recordCount: number;
    }> {
        const result = await db
            .select({
                totalInputTokens: sql<number>`coalesce(sum(${billingRecords.inputTokens}), 0)`,
                totalOutputTokens: sql<number>`coalesce(sum(${billingRecords.outputTokens}), 0)`,
                totalCostCents: sql<number>`coalesce(sum(${billingRecords.costCents}), 0)`,
                recordCount: sql<number>`count(*)`,
            })
            .from(billingRecords)
            .where(eq(billingRecords.tenantId, tenantId));

        return result[0] || {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCostCents: 0,
            recordCount: 0,
        };
    }

    /**
     * 获取 Redis 中的实时配额计数器
     */
    async getQuotaCounter(tenantId: string): Promise<Record<string, string>> {
        const key = `tenant:${tenantId}:quota`;
        return this.redis.hgetall(key);
    }

    async checkTenantQuotaGate(tenantId: string): Promise<TenantQuotaGateResult> {
        const [tenant] = await db
            .select({quota: tenants.quota})
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1);

        const quota = tenant?.quota ?? {
            maxTokensPerDay: 1000000,
            maxConcurrentSessions: 10,
        };
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [usage] = await db
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

        const gate = {
            quota,
            usage: {
                totalTokensToday: usage?.totalTokensToday ?? 0,
                runningSessions: running?.runningSessions ?? 0,
            },
        };

        if (gate.usage.totalTokensToday >= quota.maxTokensPerDay) {
            return {...gate, allowed: false, reason: 'TOKEN_QUOTA_EXCEEDED'};
        }

        if (gate.usage.runningSessions >= quota.maxConcurrentSessions) {
            return {...gate, allowed: false, reason: 'CONCURRENT_SESSION_LIMIT'};
        }

        return {...gate, allowed: true};
    }

    /**
     * 简单成本计算（单位：分）
     * 后续可按模型差异化定价
     *
     * 公开为公共方法，便于 runService.complete 在写入 runs.costCents 时复用同一公式。
     */
    calculateCost(usage: {
        inputTokens: number;
        outputTokens: number;
        model?: string;
    }): number {
        // 默认 Claude Sonnet 定价（近似）：input $3/M, output $15/M
        return Math.round(usage.inputTokens * 0.003 + usage.outputTokens * 0.015);
    }

    /**
     * 释放资源
     */
    async dispose(): Promise<void> {
        await this.redis.quit();
    }
}

/**
 * 单例实例
 */
export const costAggregator = new CostAggregator();
