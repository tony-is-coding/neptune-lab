import {and, eq, sql} from 'drizzle-orm';
import {
    agentTemplateVersions,
    artifacts,
    auditEvents,
    db,
    evidenceArtifacts,
    policyDecisions,
    runEvents,
    runs,
    toolInvocations,
    type AgentTemplateVersion,
    type Run,
} from '../db';
import {computeAgentVersionHash} from './agent-version-hash';
import type {AgentVersionSummaryDto, RunObservabilityDto, RunStatus} from '@shared/neptune-ai';

export class RunObservabilityService {
    async getByRun(tenantId: string, runId: string): Promise<RunObservabilityDto | null> {
        const [run] = await db
            .select()
            .from(runs)
            .where(and(eq(runs.tenantId, tenantId), eq(runs.id, runId)))
            .limit(1);

        if (!run) return null;

        const [
            eventCount,
            toolCount,
            artifactCount,
            evidenceCount,
            policyCount,
            auditCount,
            agentVersion,
        ] = await Promise.all([
            countWhere(runEvents, and(eq(runEvents.tenantId, tenantId), eq(runEvents.runId, runId))),
            countWhere(toolInvocations, and(eq(toolInvocations.tenantId, tenantId), eq(toolInvocations.runId, runId))),
            countWhere(artifacts, and(eq(artifacts.tenantId, tenantId), eq(artifacts.runId, runId))),
            countWhere(evidenceArtifacts, and(eq(evidenceArtifacts.tenantId, tenantId), eq(evidenceArtifacts.runId, runId))),
            countWhere(policyDecisions, and(eq(policyDecisions.tenantId, tenantId), eq(policyDecisions.runId, runId))),
            countWhere(auditEvents, and(
                eq(auditEvents.tenantId, tenantId),
                eq(auditEvents.resourceType, 'run'),
                eq(auditEvents.resourceId, runId),
            )),
            getAgentVersion(tenantId, run.agentVersionId),
        ]);

        const inputTokens = run.inputTokens ?? 0;
        const outputTokens = run.outputTokens ?? 0;
        const costCents = run.costCents ?? 0;

        return {
            tenantId,
            runId: run.id,
            requestId: run.requestId,
            threadId: run.threadId,
            agentId: run.agentId,
            agentVersionId: run.agentVersionId ?? null,
            status: run.status as RunStatus,
            model: run.model ?? null,
            durationMs: getDurationMs(run),
            tokenUsage: {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                costCents,
            },
            factCounts: {
                events: eventCount,
                toolInvocations: toolCount,
                artifacts: artifactCount,
                evidenceArtifacts: evidenceCount,
                policyDecisions: policyCount,
                auditEvents: auditCount,
            },
            trace: {
                provider: 'internal',
                traceId: null,
                traceUrl: null,
                message: '当前运行尚未持久化外部 trace 链接；请使用请求、运行和线程关联键追溯。',
            },
            agentVersion: agentVersion ? toAgentVersionSummaryDto(agentVersion) : null,
            updatedAt: new Date().toISOString(),
        };
    }
}

async function countWhere(table: any, where: unknown): Promise<number> {
    const [result] = await db
        .select({count: sql<number>`count(*)::int`})
        .from(table)
        .where(where as never);

    return toNumber(result?.count);
}

async function getAgentVersion(
    tenantId: string,
    agentVersionId: string | null,
): Promise<AgentTemplateVersion | null> {
    if (!agentVersionId) return null;

    const [version] = await db
        .select()
        .from(agentTemplateVersions)
        .where(and(
            eq(agentTemplateVersions.tenantId, tenantId),
            eq(agentTemplateVersions.id, agentVersionId),
        ))
        .limit(1);

    return version ?? null;
}

function getDurationMs(run: Run): number | null {
    const metadataDuration = readNumber((run.metadata ?? {}).durationMs);
    if (metadataDuration !== null) return metadataDuration;

    if (!run.startedAt || !run.completedAt) return null;
    const started = run.startedAt instanceof Date ? run.startedAt.getTime() : new Date(run.startedAt).getTime();
    const completed = run.completedAt instanceof Date ? run.completedAt.getTime() : new Date(run.completedAt).getTime();
    if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return null;
    return completed - started;
}

function readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
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

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function toAgentVersionSummaryDto(version: AgentTemplateVersion): AgentVersionSummaryDto {
    const snapshot = asRecord(version.snapshot);
    const modelConfig = asRecord(snapshot.modelConfig);

    return {
        id: version.id,
        tenantId: version.tenantId,
        agentId: version.agentId,
        version: version.version,
        versionHash: computeAgentVersionHash(version.snapshot),
        createdBy: version.createdBy ?? null,
        createdAt: toIsoString(version.createdAt) ?? new Date(0).toISOString(),
        snapshotSummary: {
            name: asString(snapshot.name) ?? '',
            description: asString(snapshot.description),
            modelProvider: asString(modelConfig.provider),
            model: asString(modelConfig.model),
            toolCount: asArray(snapshot.tools).length,
            skillCount: asArray(snapshot.skills).length,
            mcpServerCount: asArray(snapshot.mcpServers).length,
        },
    };
}

export const runObservabilityService = new RunObservabilityService();
