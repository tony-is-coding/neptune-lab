import {and, desc, eq, sql} from 'drizzle-orm';
import {
    agentTemplateVersions,
    db,
    type AgentTemplate,
    type AgentTemplateVersion,
} from '../db';
import {auditEventService} from './audit';
import {computeAgentVersionHash} from './agent-version-hash';
import type {AgentVersionListResponse, AgentVersionSummaryDto} from '@shared/neptune-ai';

export class AgentVersionService {
    async listForAgent(params: {
        tenantId: string;
        agentId: string;
        limit?: number;
        offset?: number;
    }): Promise<AgentVersionListResponse> {
        const limit = params.limit ?? 50;
        const offset = params.offset ?? 0;
        const where = and(
            eq(agentTemplateVersions.tenantId, params.tenantId),
            eq(agentTemplateVersions.agentId, params.agentId),
        );

        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(agentTemplateVersions)
            .where(where);
        const data = await db
            .select()
            .from(agentTemplateVersions)
            .where(where)
            .orderBy(desc(agentTemplateVersions.version))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toAgentVersionSummaryDto),
            meta: {
                count: countResult[0]?.count ?? 0,
                limit,
                offset,
            },
        };
    }

    async ensureSnapshot(params: {
        template: AgentTemplate;
        userId?: string;
        requestId?: string;
    }): Promise<AgentTemplateVersion> {
        const version = params.template.version ?? 1;

        const existing = await db.query.agentTemplateVersions.findFirst({
            where: and(
                eq(agentTemplateVersions.agentId, params.template.id),
                eq(agentTemplateVersions.version, version),
            ),
        });
        if (existing) return existing;

        const snapshot = this.createSnapshot(params.template);
        const [created] = await db.insert(agentTemplateVersions).values({
            tenantId: params.template.tenantId,
            agentId: params.template.id,
            version,
            snapshot,
            createdBy: params.userId,
        }).returning();

        await auditEventService.record({
            tenantId: params.template.tenantId,
            userId: params.userId,
            requestId: params.requestId,
            action: 'agent.version.snapshotted',
            resourceType: 'agent_template',
            resourceId: params.template.id,
            metadata: {
                agentVersionId: created.id,
                version,
            },
        });

        return created;
    }

    private createSnapshot(template: AgentTemplate): Record<string, unknown> {
        return {
            id: template.id,
            tenantId: template.tenantId,
            name: template.name,
            description: template.description,
            systemPrompt: template.systemPrompt,
            promptConfig: template.promptConfig,
            modelConfig: template.modelConfig,
            tools: template.tools,
            skills: template.skills,
            mcpServers: template.mcpServers,
            constraints: template.constraints,
            version: template.version ?? 1,
            isActive: template.isActive,
            snapshottedAt: new Date().toISOString(),
        };
    }
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

export const agentVersionService = new AgentVersionService();
