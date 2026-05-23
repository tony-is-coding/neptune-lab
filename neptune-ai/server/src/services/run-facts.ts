import {and, asc, eq, sql} from 'drizzle-orm';
import {randomUUID} from 'crypto';
import {
    db,
    runs,
    runEvents,
    toolInvocations,
    type RunEvent,
    type ToolInvocation,
} from '../db';
import type {
    RunEventDto,
    RunEventListResponse,
    ToolInvocationDto,
    ToolInvocationListResponse,
    ToolInvocationStatus,
} from '@shared/neptune-ai';

export interface RunFactListFilters {
    limit?: number;
    offset?: number;
}

export class RunFactService {
    async recordEvent(params: {
        tenantId: string;
        runId: string;
        eventType: string;
        requestId?: string;
        payloadSummary?: Record<string, unknown>;
    }): Promise<RunEvent> {
        const [sequenceRow] = await db
            .select({
                nextSequence: sql<number>`coalesce(max(${runEvents.sequence}), 0)::int + 1`,
            })
            .from(runEvents)
            .where(and(
                eq(runEvents.tenantId, params.tenantId),
                eq(runEvents.runId, params.runId),
            ));

        const [event] = await db.insert(runEvents).values({
            tenantId: params.tenantId,
            runId: params.runId,
            eventType: params.eventType,
            sequence: sequenceRow?.nextSequence ?? 1,
            requestId: params.requestId,
            payloadSummary: redactSummary(params.payloadSummary ?? {}),
        }).returning();

        return event;
    }

    async recordToolStarted(params: {
        tenantId: string;
        runId: string;
        requestId?: string;
        toolUseId?: string;
        toolName: string;
        input?: Record<string, unknown>;
    }): Promise<ToolInvocation> {
        const toolUseId = params.toolUseId || randomUUID();
        const existing = await this.findTool(params.tenantId, params.runId, toolUseId);
        if (existing) return existing;

        const [tool] = await db.insert(toolInvocations).values({
            tenantId: params.tenantId,
            runId: params.runId,
            requestId: params.requestId,
            toolUseId,
            toolName: params.toolName,
            status: 'running',
            inputSummary: redactSummary(params.input ?? {}),
        }).returning();

        return tool;
    }

    async recordToolCompleted(params: {
        tenantId: string;
        runId: string;
        requestId?: string;
        toolUseId: string;
        output?: unknown;
        isError?: boolean;
    }): Promise<ToolInvocation | null> {
        const existing = await this.findTool(params.tenantId, params.runId, params.toolUseId);
        if (!existing) return null;

        const [updated] = await db.update(toolInvocations)
            .set({
                status: params.isError ? 'failed' : 'completed',
                outputSummary: params.isError ? undefined : summarizeValue(params.output),
                errorSummary: params.isError ? summarizeValue(params.output) : undefined,
                completedAt: new Date(),
            })
            .where(and(
                eq(toolInvocations.tenantId, params.tenantId),
                eq(toolInvocations.runId, params.runId),
                eq(toolInvocations.toolUseId, params.toolUseId),
            ))
            .returning();

        return updated ?? null;
    }

    async listEventsByRun(
        tenantId: string,
        runId: string,
        filters: RunFactListFilters = {},
    ): Promise<RunEventListResponse> {
        await this.assertRunInTenant(tenantId, runId);
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const where = and(eq(runEvents.tenantId, tenantId), eq(runEvents.runId, runId));

        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(runEvents)
            .where(where);
        const data = await db
            .select()
            .from(runEvents)
            .where(where)
            .orderBy(asc(runEvents.sequence))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toRunEventDto),
            meta: {
                count: countResult[0]?.count ?? 0,
                limit,
                offset,
            },
        };
    }

    async listToolInvocationsByRun(
        tenantId: string,
        runId: string,
        filters: RunFactListFilters = {},
    ): Promise<ToolInvocationListResponse> {
        await this.assertRunInTenant(tenantId, runId);
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const where = and(eq(toolInvocations.tenantId, tenantId), eq(toolInvocations.runId, runId));

        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(toolInvocations)
            .where(where);
        const data = await db
            .select()
            .from(toolInvocations)
            .where(where)
            .orderBy(asc(toolInvocations.startedAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toToolInvocationDto),
            meta: {
                count: countResult[0]?.count ?? 0,
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

    private async findTool(
        tenantId: string,
        runId: string,
        toolUseId: string,
    ): Promise<ToolInvocation | null> {
        const [tool] = await db
            .select()
            .from(toolInvocations)
            .where(and(
                eq(toolInvocations.tenantId, tenantId),
                eq(toolInvocations.runId, runId),
                eq(toolInvocations.toolUseId, toolUseId),
            ))
            .limit(1);

        return tool ?? null;
    }
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
}

function toRunEventDto(event: RunEvent): RunEventDto {
    return {
        id: event.id,
        tenantId: event.tenantId,
        runId: event.runId,
        eventType: event.eventType,
        sequence: event.sequence,
        requestId: event.requestId ?? null,
        payloadSummary: event.payloadSummary ?? {},
        occurredAt: toIsoString(event.occurredAt) ?? new Date(0).toISOString(),
    };
}

function toToolInvocationDto(tool: ToolInvocation): ToolInvocationDto {
    return {
        id: tool.id,
        tenantId: tool.tenantId,
        runId: tool.runId,
        toolUseId: tool.toolUseId,
        toolName: tool.toolName,
        status: tool.status as ToolInvocationStatus,
        requestId: tool.requestId ?? null,
        inputSummary: tool.inputSummary ?? {},
        outputSummary: tool.outputSummary ?? null,
        errorSummary: tool.errorSummary ?? null,
        startedAt: toIsoString(tool.startedAt) ?? new Date(0).toISOString(),
        completedAt: toIsoString(tool.completedAt),
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

function summarizeValue(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return redactSummary(value as Record<string, unknown>);
    }
    return {value: summarizeUnknown(value)};
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
    return /token|secret|credential|password|api[_-]?key|auth|content|body|text/i.test(key);
}

export const runFactService = new RunFactService();
