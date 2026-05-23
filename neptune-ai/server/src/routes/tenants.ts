import type {FastifyInstance} from 'fastify';
import {tenantService} from '../services/tenant';
import {roleMiddleware} from '../middleware/auth';
import {replyApiError, replyUnknownError} from '../utils/api-error';
import {createLogger} from '../utils/logger';

const log = createLogger('routes:tenants');

/**
 * 租户管理路由
 */
export async function tenantRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/tenants
     * 创建租户
     */
    fastify.post('/', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        const {name, quota, billingConfig} = request.body as {
            name: string;
            quota?: { maxTokensPerDay: number; maxConcurrentSessions: number };
            billingConfig?: Record<string, unknown>;
        };

        if (!name) {
            return replyApiError(request, reply, 'VALIDATION_FAILED', '租户名称不能为空');
        }

        try {
            const tenant = await tenantService.create({
                name,
                quota: quota || {maxTokensPerDay: 1000000, maxConcurrentSessions: 10},
                billingConfig: billingConfig || {},
            });

            reply.status(201).send(tenant);
        } catch (error) {
            log.error('Request failed', {requestId: request.requestId, detail: (error as Error).message});
            return replyUnknownError(request, reply, error, '创建租户失败');
        }
    });

    /**
     * GET /api/tenants/:id
     * 获取租户详情
     */
    fastify.get('/:id', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        const {id} = request.params as { id: string };

        try {
            const tenant = await tenantService.findById(id);

            if (!tenant) {
                return replyApiError(request, reply, 'RESOURCE_NOT_FOUND', '租户不存在');
            }

            reply.send(tenant);
        } catch (error) {
            log.error('Request failed', {requestId: request.requestId, detail: (error as Error).message});
            return replyUnknownError(request, reply, error, '获取租户失败');
        }
    });

    /**
     * GET /api/tenants
     * 获取租户列表
     */
    fastify.get('/', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        const {limit, offset} = request.query as {
            limit?: string;
            offset?: string;
        };

        try {
            const tenants = await tenantService.findAll(
                limit ? parseInt(limit, 10) : 100,
                offset ? parseInt(offset, 10) : 0,
            );

            reply.send({
                data: tenants,
                meta: {
                    count: tenants.length,
                    limit: limit ? parseInt(limit, 10) : 100,
                    offset: offset ? parseInt(offset, 10) : 0,
                },
            });
        } catch (error) {
            log.error('Request failed', {requestId: request.requestId, detail: (error as Error).message});
            return replyUnknownError(request, reply, error, '获取租户列表失败');
        }
    });

    /**
     * PUT /api/tenants/:id
     * 更新租户
     */
    fastify.put('/:id', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        const {id} = request.params as { id: string };
        const {name, quota, billingConfig} = request.body as {
            name?: string;
            quota?: { maxTokensPerDay: number; maxConcurrentSessions: number };
            billingConfig?: Record<string, unknown>;
        };

        try {
            const tenant = await tenantService.update(id, {
                name,
                quota,
                billingConfig,
            });

            if (!tenant) {
                return replyApiError(request, reply, 'RESOURCE_NOT_FOUND', '租户不存在');
            }

            reply.send(tenant);
        } catch (error) {
            log.error('Request failed', {requestId: request.requestId, detail: (error as Error).message});
            return replyUnknownError(request, reply, error, '更新租户失败');
        }
    });

    /**
     * DELETE /api/tenants/:id
     * 删除租户
     */
    fastify.delete('/:id', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        const {id} = request.params as { id: string };

        try {
            const success = await tenantService.delete(id);

            if (!success) {
                return replyApiError(request, reply, 'RESOURCE_NOT_FOUND', '租户不存在');
            }

            reply.status(204).send();
        } catch (error) {
            log.error('Request failed', {requestId: request.requestId, detail: (error as Error).message});
            return replyUnknownError(request, reply, error, '删除租户失败');
        }
    });
}
