import {createHash} from 'crypto';
import {and, asc, desc, eq, sql, type SQL} from 'drizzle-orm';
import {
    artifacts,
    db,
    evidenceArtifacts,
    runs,
    type Artifact,
    type EvidenceArtifact,
} from '../db';
import {auditEventService} from './audit';
import type {
    ArtifactDto,
    ArtifactListResponse,
    ArtifactSourceType,
    ArtifactType,
    EvidenceArtifactDto,
    EvidenceArtifactListResponse,
    EvidenceArtifactType,
} from '@shared/neptune-ai';

export interface ArtifactListFilters {
    artifactType?: string;
    sourceType?: string;
    limit?: number;
    offset?: number;
}

export interface EvidenceArtifactListFilters {
    evidenceType?: string;
    limit?: number;
    offset?: number;
}

export class ArtifactEvidenceService {
    async recordUploadedArtifact(params: {
        tenantId: string;
        requestId?: string;
        userId?: string | null;
        title: string;
        storageUri: string;
        content: string;
        artifactType?: ArtifactType;
        mimeType?: string | null;
        sourceRef?: string | null;
        metadataSummary?: Record<string, unknown>;
    }): Promise<Artifact> {
        const sha256 = sha256Hex(params.content);
        const [artifact] = await db.insert(artifacts).values({
            tenantId: params.tenantId,
            runId: null,
            requestId: params.requestId,
            artifactType: params.artifactType ?? 'dataset',
            title: params.title,
            mimeType: params.mimeType ?? inferMimeType(params.title),
            sizeBytes: Buffer.byteLength(params.content, 'utf8'),
            sha256,
            storageUri: params.storageUri,
            sourceType: 'upload',
            sourceRef: params.sourceRef,
            createdBy: params.userId ?? null,
            metadataSummary: sanitizeSummary(params.metadataSummary ?? {}),
        }).returning();

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId ?? null,
            requestId: params.requestId,
            action: 'artifact.created',
            resourceType: 'artifact',
            resourceId: artifact.id,
            metadata: {
                runId: null,
                artifactType: artifact.artifactType,
                sourceType: artifact.sourceType,
                sha256: artifact.sha256,
            },
        });

        return artifact;
    }

    async recordUploadedEvidenceForArtifact(params: {
        tenantId: string;
        artifactId: string;
        requestId?: string;
        userId?: string | null;
        evidenceType?: EvidenceArtifactType;
        sourceSystem?: string | null;
        sourceUri?: string | null;
        sourceHash: string;
        capturedAt?: Date;
        metadataSummary?: Record<string, unknown>;
    }): Promise<EvidenceArtifact> {
        const [evidence] = await db.insert(evidenceArtifacts).values({
            tenantId: params.tenantId,
            artifactId: params.artifactId,
            runId: null,
            requestId: params.requestId,
            evidenceType: params.evidenceType ?? 'source_file',
            sourceSystem: params.sourceSystem ?? 'manual-upload',
            sourceUri: params.sourceUri,
            sourceHash: params.sourceHash,
            importedBy: params.userId ?? null,
            capturedAt: params.capturedAt ?? new Date(),
            metadataSummary: sanitizeSummary(params.metadataSummary ?? {}),
        }).returning();

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId ?? null,
            requestId: params.requestId,
            action: 'evidence.created',
            resourceType: 'evidence_artifact',
            resourceId: evidence.id,
            metadata: {
                runId: null,
                artifactId: params.artifactId,
                evidenceType: evidence.evidenceType,
                sourceHash: evidence.sourceHash,
            },
        });

        return evidence;
    }

    async recordRuntimeArtifact(params: {
        tenantId: string;
        runId: string;
        requestId?: string;
        userId?: string | null;
        title: string;
        storageUri: string;
        content?: string;
        mimeType?: string | null;
        sourceRef?: string | null;
        metadataSummary?: Record<string, unknown>;
    }): Promise<Artifact> {
        const content = params.content ?? '';
        const sha256 = sha256Hex(content || params.storageUri);
        const [artifact] = await db.insert(artifacts).values({
            tenantId: params.tenantId,
            runId: params.runId,
            requestId: params.requestId,
            artifactType: 'file',
            title: params.title,
            mimeType: params.mimeType ?? inferMimeType(params.title),
            sizeBytes: content ? Buffer.byteLength(content, 'utf8') : null,
            sha256,
            storageUri: params.storageUri,
            sourceType: 'runtime_tool',
            sourceRef: params.sourceRef,
            createdBy: params.userId ?? null,
            metadataSummary: sanitizeSummary(params.metadataSummary ?? {}),
        }).returning();

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId ?? null,
            requestId: params.requestId,
            action: 'artifact.created',
            resourceType: 'artifact',
            resourceId: artifact.id,
            metadata: {
                runId: params.runId,
                artifactType: artifact.artifactType,
                sourceType: artifact.sourceType,
                sha256: artifact.sha256,
            },
        });

        return artifact;
    }

    async recordEvidenceForArtifact(params: {
        tenantId: string;
        artifactId: string;
        runId: string;
        requestId?: string;
        userId?: string | null;
        evidenceType?: EvidenceArtifactType;
        sourceSystem?: string | null;
        sourceUri?: string | null;
        sourceHash?: string;
        capturedAt?: Date;
        metadataSummary?: Record<string, unknown>;
    }): Promise<EvidenceArtifact> {
        const [evidence] = await db.insert(evidenceArtifacts).values({
            tenantId: params.tenantId,
            artifactId: params.artifactId,
            runId: params.runId,
            requestId: params.requestId,
            evidenceType: params.evidenceType ?? 'generated_extract',
            sourceSystem: params.sourceSystem ?? 'neptune-runtime',
            sourceUri: params.sourceUri,
            sourceHash: params.sourceHash ?? params.artifactId,
            importedBy: params.userId ?? null,
            capturedAt: params.capturedAt ?? new Date(),
            metadataSummary: sanitizeSummary(params.metadataSummary ?? {}),
        }).returning();

        await auditEventService.record({
            tenantId: params.tenantId,
            userId: params.userId ?? null,
            requestId: params.requestId,
            action: 'evidence.created',
            resourceType: 'evidence_artifact',
            resourceId: evidence.id,
            metadata: {
                runId: params.runId,
                artifactId: params.artifactId,
                evidenceType: evidence.evidenceType,
                sourceHash: evidence.sourceHash,
            },
        });

        return evidence;
    }

    async listArtifactsByRun(
        tenantId: string,
        runId: string,
        filters: ArtifactListFilters = {},
    ): Promise<ArtifactListResponse> {
        await this.assertRunInTenant(tenantId, runId);
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const conditions: SQL[] = [
            eq(artifacts.tenantId, tenantId),
            eq(artifacts.runId, runId),
        ];
        if (filters.artifactType) conditions.push(eq(artifacts.artifactType, filters.artifactType));
        if (filters.sourceType) conditions.push(eq(artifacts.sourceType, filters.sourceType));
        const where = and(...conditions);

        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(artifacts)
            .where(where);
        const data = await db
            .select()
            .from(artifacts)
            .where(where)
            .orderBy(asc(artifacts.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toArtifactDto),
            meta: {
                count: countResult[0]?.count ?? 0,
                limit,
                offset,
            },
        };
    }

    async listEvidenceArtifactsByRun(
        tenantId: string,
        runId: string,
        filters: EvidenceArtifactListFilters = {},
    ): Promise<EvidenceArtifactListResponse> {
        await this.assertRunInTenant(tenantId, runId);
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const conditions: SQL[] = [
            eq(evidenceArtifacts.tenantId, tenantId),
            eq(evidenceArtifacts.runId, runId),
        ];
        if (filters.evidenceType) conditions.push(eq(evidenceArtifacts.evidenceType, filters.evidenceType));
        const where = and(...conditions);

        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(evidenceArtifacts)
            .where(where);
        const data = await db
            .select()
            .from(evidenceArtifacts)
            .where(where)
            .orderBy(asc(evidenceArtifacts.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toEvidenceArtifactDto),
            meta: {
                count: countResult[0]?.count ?? 0,
                limit,
                offset,
            },
        };
    }

    async listEvidenceArtifactsByWorkspace(
        tenantId: string,
        workspaceId: string,
        filters: EvidenceArtifactListFilters = {},
    ): Promise<EvidenceArtifactListResponse> {
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const conditions: SQL[] = [
            eq(evidenceArtifacts.tenantId, tenantId),
            sql`${evidenceArtifacts.metadataSummary}->>'workspaceId' = ${workspaceId}`,
        ];
        if (filters.evidenceType) conditions.push(eq(evidenceArtifacts.evidenceType, filters.evidenceType));
        const where = and(...conditions);

        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(evidenceArtifacts)
            .where(where);
        const data = await db
            .select()
            .from(evidenceArtifacts)
            .where(where)
            .orderBy(desc(evidenceArtifacts.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toEvidenceArtifactDto),
            meta: {
                count: countResult[0]?.count ?? 0,
                limit,
                offset,
            },
        };
    }

    async listArtifactsByTenant(
        tenantId: string,
        filters: ArtifactListFilters = {},
    ): Promise<ArtifactListResponse> {
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const conditions: SQL[] = [eq(artifacts.tenantId, tenantId)];
        if (filters.artifactType) conditions.push(eq(artifacts.artifactType, filters.artifactType));
        if (filters.sourceType) conditions.push(eq(artifacts.sourceType, filters.sourceType));
        const where = and(...conditions);

        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(artifacts)
            .where(where);
        const data = await db
            .select()
            .from(artifacts)
            .where(where)
            .orderBy(desc(artifacts.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toArtifactDto),
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
}

export function toArtifactDto(artifact: Artifact): ArtifactDto {
    return {
        id: artifact.id,
        tenantId: artifact.tenantId,
        runId: artifact.runId ?? null,
        requestId: artifact.requestId ?? null,
        artifactType: artifact.artifactType as ArtifactType,
        title: artifact.title,
        mimeType: artifact.mimeType ?? null,
        sizeBytes: artifact.sizeBytes ?? null,
        sha256: artifact.sha256,
        storageUri: artifact.storageUri,
        sourceType: artifact.sourceType as ArtifactSourceType,
        sourceRef: artifact.sourceRef ?? null,
        createdBy: artifact.createdBy ?? null,
        metadataSummary: artifact.metadataSummary ?? {},
        createdAt: toIsoString(artifact.createdAt) ?? new Date(0).toISOString(),
    };
}

export function toEvidenceArtifactDto(evidence: EvidenceArtifact): EvidenceArtifactDto {
    return {
        id: evidence.id,
        tenantId: evidence.tenantId,
        artifactId: evidence.artifactId,
        runId: evidence.runId ?? null,
        requestId: evidence.requestId ?? null,
        evidenceType: evidence.evidenceType as EvidenceArtifactType,
        sourceSystem: evidence.sourceSystem ?? null,
        sourceUri: evidence.sourceUri ?? null,
        sourceHash: evidence.sourceHash,
        importedBy: evidence.importedBy ?? null,
        capturedAt: toIsoString(evidence.capturedAt),
        metadataSummary: evidence.metadataSummary ?? {},
        createdAt: toIsoString(evidence.createdAt) ?? new Date(0).toISOString(),
    };
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
}

function sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function inferMimeType(title: string): string | null {
    if (title.endsWith('.md')) return 'text/markdown';
    if (title.endsWith('.json')) return 'application/json';
    if (title.endsWith('.csv')) return 'text/csv';
    if (title.endsWith('.txt')) return 'text/plain';
    return null;
}

function sanitizeSummary(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(value)
            .filter(([key]) => !isSensitiveKey(key))
            .map(([key, item]) => [key, summarizeUnknown(item)]),
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

export const artifactEvidenceService = new ArtifactEvidenceService();
