import type {FastifyInstance} from 'fastify';
import {auditEventService} from '../services/audit';
import {projectService} from '../services/project';
import {sendApiError, replyApiError, replyUnknownError} from '../utils/api-error';
import {createLogger} from '../utils/logger';
import type {CreateCustomerProjectRequest, UpdateCustomerProjectRequest} from '@shared/neptune-ai';

const log = createLogger('routes:projects');

function parsePage(query: {limit?: string; offset?: string}) {
    const parsedLimit = Number.parseInt(query.limit ?? '50', 10);
    const parsedOffset = Number.parseInt(query.offset ?? '0', 10);

    return {
        limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50,
        offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
    };
}

function validateProjectName(
    reply: Parameters<typeof sendApiError>[0],
    requestId: string | undefined,
    name: unknown,
) {
    if (typeof name !== 'string' || !name.trim()) {
        sendApiError(reply, 400, {
            error: 'VALIDATION_FAILED',
            message: '客户项目名称不能为空',
            requestId,
            details: {field: 'name'},
        });
        return false;
    }

    return true;
}

/**
 * CustomerProject 路由
 *
 * 客户项目是交付台、治理台、Solution Pack 和受控运行的业务归属入口。
 */
export async function projectRoutes(fastify: FastifyInstance) {
    fastify.get<{
        Querystring: {
            status?: string;
            limit?: string;
            offset?: string;
        };
    }>('/', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const page = parsePage(request.query);

        try {
            return await projectService.listByTenant(user.tenantId, {
                status: request.query.status,
                ...page,
            });
        } catch (error) {
            log.error('List projects failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取客户项目列表失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{
        Body: CreateCustomerProjectRequest;
    }>('/', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        if (!validateProjectName(reply, request.requestId, request.body?.name)) return;

        try {
            const project = await projectService.create({
                tenantId: user.tenantId,
                userId: user.userId,
                request: request.body,
            });

            await auditEventService.record({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId,
                action: 'project.created',
                resourceType: 'project',
                resourceId: project.id,
                metadata: {
                    name: project.name,
                    environment: project.environment,
                    solutionPack: project.solutionPack,
                },
            });

            return reply.status(201).send(project);
        } catch (error) {
            log.error('Create project failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '创建客户项目失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{
        Params: {projectId: string};
    }>('/:projectId', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;

        try {
            const project = await projectService.findByTenantAndId(user.tenantId, request.params.projectId);
            if (!project) {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应客户项目，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }

            return project;
        } catch (error) {
            log.error('Get project failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取客户项目失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.patch<{
        Params: {projectId: string};
        Body: UpdateCustomerProjectRequest;
    }>('/:projectId', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        if (request.body?.name !== undefined && !validateProjectName(reply, request.requestId, request.body.name)) return;

        try {
            const project = await projectService.update(user.tenantId, request.params.projectId, request.body);
            if (!project) {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应客户项目，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }

            await auditEventService.record({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId,
                action: 'project.updated',
                resourceType: 'project',
                resourceId: project.id,
                metadata: {
                    name: project.name,
                    environment: project.environment,
                    solutionPack: project.solutionPack,
                },
            });

            return project;
        } catch (error) {
            log.error('Update project failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '更新客户项目失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{
        Params: {projectId: string};
    }>('/:projectId/archive', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;

        try {
            const project = await projectService.archive(user.tenantId, request.params.projectId);
            if (!project) {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应客户项目，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }

            await auditEventService.record({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId,
                action: 'project.archived',
                resourceType: 'project',
                resourceId: project.id,
                metadata: {
                    name: project.name,
                    archivedAt: project.archivedAt,
                },
            });

            return project;
        } catch (error) {
            log.error('Archive project failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '归档客户项目失败',
                requestId: request.requestId,
            });
        }
    });
}
