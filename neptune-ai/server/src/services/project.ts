import {and, desc, eq, sql, type SQL} from 'drizzle-orm';
import {db, customerProjects, type CustomerProject, type NewCustomerProject} from '../db';
import type {
    CreateCustomerProjectRequest,
    CustomerProjectDto,
    CustomerProjectListResponse,
    UpdateCustomerProjectRequest,
} from '@shared/neptune-ai';

export interface CustomerProjectListFilters {
    status?: string;
    limit?: number;
    offset?: number;
}

export class ProjectService {
    async create(input: {
        tenantId: string;
        userId: string;
        request: CreateCustomerProjectRequest;
    }): Promise<CustomerProjectDto> {
        const [project] = await db.insert(customerProjects).values({
            tenantId: input.tenantId,
            name: input.request.name.trim(),
            description: normalizeNullableText(input.request.description),
            environment: normalizeText(input.request.environment, 'sandbox'),
            solutionPack: normalizeNullableText(input.request.solutionPack),
            createdBy: input.userId,
            metadataSummary: input.request.metadataSummary ?? {},
        } satisfies NewCustomerProject).returning();

        return toCustomerProjectDto(project);
    }

    async listByTenant(
        tenantId: string,
        filters: CustomerProjectListFilters = {},
    ): Promise<CustomerProjectListResponse> {
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        const conditions: SQL[] = [eq(customerProjects.tenantId, tenantId)];

        if (filters.status) {
            conditions.push(eq(customerProjects.status, filters.status));
        }

        const where = and(...conditions);
        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(customerProjects)
            .where(where);
        const data = await db
            .select()
            .from(customerProjects)
            .where(where)
            .orderBy(desc(customerProjects.createdAt))
            .limit(limit)
            .offset(offset);

        return {
            data: data.map(toCustomerProjectDto),
            meta: {
                count: countResult[0]?.count ?? 0,
                limit,
                offset,
            },
        };
    }

    async findByTenantAndId(tenantId: string, projectId: string): Promise<CustomerProjectDto | null> {
        const project = await this.findRowByTenantAndId(tenantId, projectId);
        return project ? toCustomerProjectDto(project) : null;
    }

    async update(
        tenantId: string,
        projectId: string,
        request: UpdateCustomerProjectRequest,
    ): Promise<CustomerProjectDto | null> {
        const existing = await this.findRowByTenantAndId(tenantId, projectId);
        if (!existing) return null;

        const patch: Partial<NewCustomerProject> = {
            updatedAt: new Date(),
        };
        if (request.name !== undefined) patch.name = request.name.trim();
        if (request.description !== undefined) patch.description = normalizeNullableText(request.description);
        if (request.environment !== undefined) patch.environment = normalizeText(request.environment, existing.environment);
        if (request.solutionPack !== undefined) patch.solutionPack = normalizeNullableText(request.solutionPack);
        if (request.metadataSummary !== undefined) patch.metadataSummary = request.metadataSummary;

        const [project] = await db
            .update(customerProjects)
            .set(patch)
            .where(and(
                eq(customerProjects.tenantId, tenantId),
                eq(customerProjects.id, projectId),
            ))
            .returning();

        return project ? toCustomerProjectDto(project) : null;
    }

    async archive(tenantId: string, projectId: string): Promise<CustomerProjectDto | null> {
        const existing = await this.findRowByTenantAndId(tenantId, projectId);
        if (!existing) return null;

        const archivedAt = existing.archivedAt ?? new Date();
        const [project] = await db
            .update(customerProjects)
            .set({
                status: 'archived',
                archivedAt,
                updatedAt: new Date(),
            })
            .where(and(
                eq(customerProjects.tenantId, tenantId),
                eq(customerProjects.id, projectId),
            ))
            .returning();

        return project ? toCustomerProjectDto(project) : null;
    }

    private async findRowByTenantAndId(tenantId: string, projectId: string): Promise<CustomerProject | null> {
        const project = await db.query.customerProjects.findFirst({
            where: and(
                eq(customerProjects.tenantId, tenantId),
                eq(customerProjects.id, projectId),
            ),
        });

        return project ?? null;
    }
}

function normalizeText(value: string | null | undefined, fallback: string): string {
    const normalized = value?.trim();
    return normalized || fallback;
}

function normalizeNullableText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
}

export function toCustomerProjectDto(project: CustomerProject): CustomerProjectDto {
    return {
        id: project.id,
        tenantId: project.tenantId,
        name: project.name,
        description: project.description ?? null,
        status: project.status as CustomerProjectDto['status'],
        environment: project.environment,
        solutionPack: project.solutionPack ?? null,
        createdBy: project.createdBy ?? null,
        archivedAt: toIsoString(project.archivedAt),
        metadataSummary: project.metadataSummary ?? {},
        createdAt: toIsoString(project.createdAt) ?? new Date(0).toISOString(),
        updatedAt: toIsoString(project.updatedAt) ?? new Date(0).toISOString(),
    };
}

export const projectService = new ProjectService();
