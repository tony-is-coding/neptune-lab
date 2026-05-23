import {db, auditEvents, type AuditEvent} from '../db';
import {and, desc, eq, sql, type SQL} from 'drizzle-orm';
import type {AuditEventDto, AuditEventListResponse} from '@shared/neptune-ai';

export interface RecordAuditEventInput {
    tenantId: string;
    userId?: string | null;
    requestId?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    outcome?: string;
    metadata?: Record<string, unknown>;
}

export interface AuditEventListFilters {
    action?: string;
    resourceType?: string;
    resourceId?: string;
    outcome?: string;
    limit?: number;
    offset?: number;
}

export interface AuditEventCsvExport {
    filename: string;
    content: string;
    exportedCount: number;
    exportedAt: string;
}

export class AuditEventService {
    async listByTenant(
        tenantId: string,
        filters: AuditEventListFilters = {},
    ): Promise<AuditEventListResponse> {
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const conditions: SQL[] = [eq(auditEvents.tenantId, tenantId)];

        if (filters.action) conditions.push(eq(auditEvents.action, filters.action));
        if (filters.resourceType) conditions.push(eq(auditEvents.resourceType, filters.resourceType));
        if (filters.resourceId) conditions.push(eq(auditEvents.resourceId, filters.resourceId));
        if (filters.outcome) conditions.push(eq(auditEvents.outcome, filters.outcome));

        const where = and(...conditions);
        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(auditEvents)
            .where(where);
        const data = await db
            .select()
            .from(auditEvents)
            .where(where)
            .orderBy(desc(auditEvents.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toAuditEventDto),
            meta: {
                count: countResult[0]?.count ?? 0,
                limit,
                offset,
            },
        };
    }

    async exportCsvByTenant(
        tenantId: string,
        filters: Omit<AuditEventListFilters, 'limit' | 'offset'> = {},
    ): Promise<AuditEventCsvExport> {
        const rows = await this.listRawByTenant(tenantId, filters, 1000);
        const content = toAuditEventsCsv(rows.map(toAuditEventDto));
        const exportedAt = new Date().toISOString();

        return {
            filename: `neptune-audit-events-${exportedAt.slice(0, 10)}.csv`,
            content,
            exportedCount: rows.length,
            exportedAt,
        };
    }

    async record(input: RecordAuditEventInput): Promise<AuditEvent> {
        const [event] = await db.insert(auditEvents).values({
            tenantId: input.tenantId,
            userId: input.userId ?? null,
            requestId: input.requestId,
            action: input.action,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            outcome: input.outcome ?? 'success',
            metadata: input.metadata ?? {},
        }).returning();

        return event;
    }

    private async listRawByTenant(
        tenantId: string,
        filters: Omit<AuditEventListFilters, 'limit' | 'offset'>,
        limit: number,
    ): Promise<AuditEvent[]> {
        const conditions: SQL[] = [eq(auditEvents.tenantId, tenantId)];

        if (filters.action) conditions.push(eq(auditEvents.action, filters.action));
        if (filters.resourceType) conditions.push(eq(auditEvents.resourceType, filters.resourceType));
        if (filters.resourceId) conditions.push(eq(auditEvents.resourceId, filters.resourceId));
        if (filters.outcome) conditions.push(eq(auditEvents.outcome, filters.outcome));

        return db
            .select()
            .from(auditEvents)
            .where(and(...conditions))
            .orderBy(desc(auditEvents.createdAt))
            .limit(limit);
    }
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
}

function toAuditEventDto(event: AuditEvent): AuditEventDto {
    return {
        id: event.id,
        tenantId: event.tenantId,
        userId: event.userId ?? null,
        requestId: event.requestId ?? null,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        outcome: event.outcome,
        createdAt: toIsoString(event.createdAt) ?? new Date(0).toISOString(),
    };
}

function csvCell(value: string | number | null | undefined): string {
    const text = value === null || value === undefined ? '' : String(value);
    if (!/[",\n\r]/.test(text)) return text;
    return `"${text.replaceAll('"', '""')}"`;
}

function toAuditEventsCsv(events: AuditEventDto[]): string {
    const headers = ['id', 'createdAt', 'tenantId', 'userId', 'requestId', 'action', 'resourceType', 'resourceId', 'outcome'];
    const rows = events.map(event => [
        event.id,
        event.createdAt,
        event.tenantId,
        event.userId,
        event.requestId,
        event.action,
        event.resourceType,
        event.resourceId,
        event.outcome,
    ].map(csvCell).join(','));

    return [headers.join(','), ...rows].join('\n') + '\n';
}

export const auditEventService = new AuditEventService();
