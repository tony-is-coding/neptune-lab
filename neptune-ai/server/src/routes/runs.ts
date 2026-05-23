import type {FastifyInstance} from 'fastify';
import {threadManager} from '../services/thread-manager';
import {runService} from '../services/run';
import {auditEventService} from '../services/audit';
import {agentTemplateService} from '../services/agent-template';
import {ApiError, sendApiError, replyApiError, replyUnknownError} from '../utils/api-error';
import {API_ERROR_STATUS, type ApiErrorEnvelope} from '@shared/neptune-ai';
import {createLogger} from '../utils/logger';
import type {CreateRunRequest, RetryRunRequest, RunDto} from '@shared/neptune-ai';

const log = createLogger('routes:runs');

function normalizeInput(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeTitle(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const title = value.trim();
    return title || undefined;
}

function sendRouteError(reply: Parameters<typeof sendApiError>[0], error: unknown, fallback: ApiErrorEnvelope) {
    if (error instanceof ApiError) {
        return sendApiError(reply, error.statusCode, error.envelope);
    }

    return sendApiError(reply, API_ERROR_STATUS[fallback.error], fallback);
}

async function consumeRunDispatch(threadId: string, input: string, requestContext: {
    requestId: string;
    tenantId: string;
    userId: string;
    agentId: string;
}): Promise<void> {
    for await (const _event of threadManager.dispatch(threadId, input, {
        ...requestContext,
        threadId,
    })) {
        // 正式 RunControl API 以持久化事实为准，HTTP 响应不透传 runtime event。
    }
}

async function createControlledRun(params: {
    tenantId: string;
    userId: string;
    requestId: string;
    agentId: string;
    input: string;
    title?: string;
    retryOfRunId?: string;
}): Promise<RunDto> {
    const thread = await threadManager.create({
        tenantId: params.tenantId,
        userId: params.userId,
        agentId: params.agentId,
        title: params.title,
    });

    await consumeRunDispatch(thread.id, params.input, {
        requestId: params.requestId,
        tenantId: params.tenantId,
        userId: params.userId,
        agentId: params.agentId,
    });

    const run = await runService.getByRequestId(params.tenantId, params.requestId);
    if (!run) {
        throw new Error('RUN_NOT_FOUND_AFTER_DISPATCH');
    }

    if (params.retryOfRunId) {
        await runService.updateMetadata({
            tenantId: params.tenantId,
            runId: run.id,
            metadata: {retryOfRunId: params.retryOfRunId},
        });
        const updated = await runService.getByTenant(params.tenantId, run.id);
        return updated ?? run;
    }

    await auditEventService.record({
        tenantId: params.tenantId,
        userId: params.userId,
        requestId: params.requestId,
        action: 'run.created',
        resourceType: 'run',
        resourceId: run.id,
        metadata: {
            agentId: params.agentId,
            threadId: run.threadId,
            retryOfRunId: params.retryOfRunId,
        },
    });

    return run;
}

/**
 * RunControl 正式运行控制路由。
 *
 * Thread 是交互容器，Run 是治理事实中心；这里不触碰 neptune-engine，
 * 只在 neptune-ai 产品层编排运行入口、审计和租户边界。
 */
export async function runRoutes(fastify: FastifyInstance) {
    fastify.post<{Body: CreateRunRequest}>('/runs', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const input = normalizeInput(request.body?.input);

        if (!input) {
            return sendApiError(reply, 400, {
                error: 'VALIDATION_FAILED',
                message: '运行输入不能为空',
                requestId: request.requestId,
                details: {field: 'input'},
            });
        }

        if (!request.body?.agentId || !(await agentTemplateService.belongsToTenant(request.body.agentId, user.tenantId))) {
            return sendApiError(reply, 404, {
                error: 'RESOURCE_NOT_FOUND',
                message: '未找到对应智能体，或你没有权限访问。',
                requestId: request.requestId,
            });
        }

        try {
            const run = await createControlledRun({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId!,
                agentId: request.body.agentId,
                input,
                title: normalizeTitle(request.body.title),
            });

            return reply.status(201).send(run);
        } catch (error) {
            log.error('Create run failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendRouteError(reply, error, {
                error: 'INTERNAL_ERROR',
                message: '创建运行失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.get<{Params: {runId: string}}>('/runs/:runId', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;

        try {
            const detail = await runService.getDetailByTenant(user.tenantId, request.params.runId);
            if (!detail) {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应运行记录，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }

            return detail;
        } catch (error) {
            log.error('Get run detail failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '获取运行详情失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{Params: {runId: string}}>('/runs/:runId/cancel', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;

        try {
            return await runService.cancel({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId!,
                runId: request.params.runId,
            });
        } catch (error) {
            if ((error as Error).message === 'RUN_NOT_FOUND') {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应运行记录，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }
            if ((error as Error).message === 'RUN_STATE_CONFLICT') {
                return sendApiError(reply, 409, {
                    error: 'STATE_CONFLICT',
                    message: '当前运行状态不允许取消。',
                    requestId: request.requestId,
                });
            }
            log.error('Cancel run failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendApiError(reply, 500, {
                error: 'INTERNAL_ERROR',
                message: '取消运行失败',
                requestId: request.requestId,
            });
        }
    });

    fastify.post<{Params: {runId: string}; Body: RetryRunRequest}>('/runs/:runId/retry', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const input = normalizeInput(request.body?.input);

        if (!input) {
            return sendApiError(reply, 400, {
                error: 'VALIDATION_FAILED',
                message: '运行输入不能为空',
                requestId: request.requestId,
                details: {field: 'input'},
            });
        }

        try {
            const previousRun = await runService.getRawByTenant(user.tenantId, request.params.runId);
            if (!previousRun) {
                return sendApiError(reply, 404, {
                    error: 'RESOURCE_NOT_FOUND',
                    message: '未找到对应运行记录，或你没有权限访问。',
                    requestId: request.requestId,
                });
            }
            if (!['failed', 'cancelled'].includes(previousRun.status)) {
                return sendApiError(reply, 409, {
                    error: 'STATE_CONFLICT',
                    message: '当前运行状态不允许重试。',
                    requestId: request.requestId,
                });
            }

            const run = await createControlledRun({
                tenantId: user.tenantId,
                userId: user.userId,
                requestId: request.requestId!,
                agentId: previousRun.agentId,
                input,
                title: normalizeTitle(request.body?.title),
                retryOfRunId: previousRun.id,
            });

            return reply.status(201).send(run);
        } catch (error) {
            log.error('Retry run failed', {requestId: request.requestId, detail: (error as Error).message});
            return sendRouteError(reply, error, {
                error: 'INTERNAL_ERROR',
                message: '重试运行失败',
                requestId: request.requestId,
            });
        }
    });
}
