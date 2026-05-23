import {db, runs, type Run} from '../db';
import {and, desc, eq, sql, type SQL} from 'drizzle-orm';
import {auditEventService} from './audit';
import {runFactService} from './run-facts';
import {artifactEvidenceService} from './artifact-evidence';
import {policyDecisionService} from './policy-decision';
import {humanReviewService} from './human-review';
import {runObservabilityService} from './run-observability';
import type {RunDetailDto, RunDto, RunListResponse, RunStatus} from '@shared/neptune-ai';

export interface RunListFilters {
    agentId?: string;
    threadId?: string;
    status?: string;
    limit?: number;
    offset?: number;
}

export class RunService {
    async listByTenant(tenantId: string, filters: RunListFilters = {}): Promise<RunListResponse> {
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const conditions: SQL[] = [eq(runs.tenantId, tenantId)];

        if (filters.agentId) conditions.push(eq(runs.agentId, filters.agentId));
        if (filters.threadId) conditions.push(eq(runs.threadId, filters.threadId));
        if (filters.status) conditions.push(eq(runs.status, filters.status));

        const where = and(...conditions);
        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(runs)
            .where(where);
        const data = await db
            .select()
            .from(runs)
            .where(where)
            .orderBy(desc(runs.startedAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toRunDto),
            meta: {
                count: countResult[0]?.count ?? 0,
                limit,
                offset,
            },
        };
    }

    async getByTenant(tenantId: string, runId: string): Promise<RunDto | null> {
        const [run] = await db
            .select()
            .from(runs)
            .where(and(eq(runs.tenantId, tenantId), eq(runs.id, runId)))
            .limit(1);

        return run ? toRunDto(run) : null;
    }

    async getDetailByTenant(tenantId: string, runId: string): Promise<RunDetailDto | null> {
        const run = await this.getByTenant(tenantId, runId);
        if (!run) return null;

        const [
            observability,
            events,
            toolInvocations,
            artifacts,
            evidenceArtifacts,
            policyDecisions,
            humanReviews,
            auditEvents,
        ] = await Promise.all([
            runObservabilityService.getByRun(tenantId, runId),
            runFactService.listEventsByRun(tenantId, runId),
            runFactService.listToolInvocationsByRun(tenantId, runId),
            artifactEvidenceService.listArtifactsByRun(tenantId, runId),
            artifactEvidenceService.listEvidenceArtifactsByRun(tenantId, runId),
            policyDecisionService.listByTenant(tenantId, {runId}),
            humanReviewService.listByTenant(tenantId, {runId}),
            auditEventService.listByTenant(tenantId, {resourceType: 'run', resourceId: runId}),
        ]);

        return {
            run,
            observability,
            events,
            toolInvocations,
            artifacts,
            evidenceArtifacts,
            policyDecisions,
            humanReviews,
            auditEvents,
        };
    }

    async getRawByTenant(tenantId: string, runId: string): Promise<Run | null> {
        const [run] = await db
            .select()
            .from(runs)
            .where(and(eq(runs.tenantId, tenantId), eq(runs.id, runId)))
            .limit(1);

        return run ?? null;
    }

    async getByRequestId(tenantId: string, requestId: string): Promise<RunDto | null> {
        const [run] = await db
            .select()
            .from(runs)
            .where(and(eq(runs.tenantId, tenantId), eq(runs.requestId, requestId)))
            .orderBy(desc(runs.startedAt))
            .limit(1);

        return run ? toRunDto(run) : null;
    }

    async updateMetadata(params: {
        runId: string;
        tenantId: string;
        metadata: Record<string, unknown>;
    }): Promise<Run | null> {
        const existing = await this.getRawByTenant(params.tenantId, params.runId);
        if (!existing) return null;

        const [run] = await db.update(runs)
            .set({
                metadata: {
                    ...(existing.metadata ?? {}),
                    ...params.metadata,
                },
            })
            .where(and(eq(runs.tenantId, params.tenantId), eq(runs.id, params.runId)))
            .returning();

        return run ?? null;
    }

    async start(params: {
        tenantId: string;
        userId: string;
        agentId: string;
        agentVersionId?: string;
        threadId: string;
        requestId: string;
        metadata?: Record<string, unknown>;
    }): Promise<Run> {
        const [run] = await db.insert(runs).values({
            tenantId: params.tenantId,
            userId: params.userId,
            agentId: params.agentId,
            agentVersionId: params.agentVersionId,
            threadId: params.threadId,
            requestId: params.requestId,
            status: 'running',
            metadata: params.metadata ?? {},
        }).returning();

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'run.started',
            resourceType: 'run',
            resourceId: run.id,
            metadata: {
                agentId: params.agentId,
                agentVersionId: params.agentVersionId,
                threadId: params.threadId,
            },
        });

        return run;
    }

    async complete(params: {
        runId: string;
        tenantId: string;
        userId: string;
        requestId: string;
        model?: string;
        inputTokens?: number;
        outputTokens?: number;
        metadata?: Record<string, unknown>;
    }): Promise<Run> {
        const [run] = await db.update(runs)
            .set({
                status: 'completed',
                model: params.model,
                inputTokens: params.inputTokens ?? 0,
                outputTokens: params.outputTokens ?? 0,
                metadata: params.metadata ?? {},
                completedAt: new Date(),
            })
            .where(eq(runs.id, params.runId))
            .returning();

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'run.completed',
            resourceType: 'run',
            resourceId: params.runId,
            metadata: {
                model: params.model,
                inputTokens: params.inputTokens ?? 0,
                outputTokens: params.outputTokens ?? 0,
            },
        });

        return run;
    }

    async fail(params: {
        runId: string;
        tenantId: string;
        userId: string;
        requestId: string;
        error: Record<string, unknown>;
    }): Promise<Run> {
        const [run] = await db.update(runs)
            .set({
                status: 'failed',
                error: params.error,
                completedAt: new Date(),
            })
            .where(eq(runs.id, params.runId))
            .returning();

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'run.failed',
            resourceType: 'run',
            resourceId: params.runId,
            outcome: 'failure',
            metadata: params.error,
        });

        return run;
    }

    async cancel(params: {
        runId: string;
        tenantId: string;
        userId: string;
        requestId: string;
    }): Promise<RunDto> {
        const existing = await this.getRawByTenant(params.tenantId, params.runId);
        if (!existing) {
            throw new Error('RUN_NOT_FOUND');
        }
        if (existing.status !== 'running') {
            throw new Error('RUN_STATE_CONFLICT');
        }

        const [run] = await db.update(runs)
            .set({
                status: 'cancelled',
                completedAt: new Date(),
            })
            .where(and(eq(runs.tenantId, params.tenantId), eq(runs.id, params.runId)))
            .returning();

        await runFactService.recordEvent({
            tenantId: params.tenantId,
            runId: params.runId,
            eventType: 'run.cancelled',
            requestId: params.requestId,
            payloadSummary: {
                previousStatus: existing.status,
            },
        });

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'run.cancelled',
            resourceType: 'run',
            resourceId: params.runId,
            metadata: {
                previousStatus: existing.status,
            },
        });

        return toRunDto(run);
    }
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
}

function toRunDto(run: Run): RunDto {
    const metadata = run.metadata ?? {};
    const retryOfRunId = typeof metadata.retryOfRunId === 'string' ? metadata.retryOfRunId : null;

    return {
        id: run.id,
        tenantId: run.tenantId,
        userId: run.userId,
        agentId: run.agentId,
        agentVersionId: run.agentVersionId ?? null,
        threadId: run.threadId,
        requestId: run.requestId,
        status: run.status as RunStatus,
        model: run.model ?? null,
        inputTokens: run.inputTokens ?? 0,
        outputTokens: run.outputTokens ?? 0,
        startedAt: toIsoString(run.startedAt) ?? new Date(0).toISOString(),
        completedAt: toIsoString(run.completedAt),
        retryOfRunId,
    };
}

export const runService = new RunService();
