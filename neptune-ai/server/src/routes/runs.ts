import type {FastifyInstance} from 'fastify';
import {threadManager} from '../services/thread-manager';
import {runService} from '../services/run';
import {runFactService} from '../services/run-facts';
import {runEventBus} from '../services/run-event-bus';
import {auditEventService} from '../services/audit';
import {agentTemplateService} from '../services/agent-template';
import {ApiError, sendApiError, replyApiError, replyUnknownError} from '../utils/api-error';
import {API_ERROR_STATUS, type ApiErrorEnvelope} from '@shared/neptune-ai';
import {createLogger} from '../utils/logger';
import type {
    CreateRunRequest,
    RetryRunRequest,
    RunDto,
    RunRuntimeEvent,
    RunStreamEnvelope,
} from '@shared/neptune-ai';

const log = createLogger('routes:runs');

function normalizeInput(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function parseLastEventId(raw: string | undefined): number {
    if (!raw) return 0;
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

function isTerminalRunStatus(status: string): boolean {
    return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function isTerminalEventType(eventType: string): boolean {
    return eventType === 'run.completed' || eventType === 'run.failed' || eventType === 'run.cancelled';
}

function terminalReasonFromEventType(eventType: string): 'completed' | 'failed' | 'cancelled' {
    if (eventType === 'run.completed') return 'completed';
    if (eventType === 'run.cancelled') return 'cancelled';
    return 'failed';
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

    /**
     * GET /api/v1/runs/:runId/events/stream
     *
     * SSE 流：实时推送 Run 的运行事件，支持断线续传。
     *
     * 协议：
     * - 每条事件以 SSE id 字段携带 sequence（数字字符串）；客户端通过
     *   Last-Event-ID 头携带上次接收到的 sequence 实现续传
     * - data 字段是 RunStreamEnvelope 的 JSON 表示
     * - 服务器发送心跳保持连接（每 15s）；终态后发送 type=end 并关闭流
     * - 流外错误（鉴权失败、租户隔离、Run 不存在）走 HTTP 4xx + ApiErrorEnvelope
     * - 流内错误走 type=error 数据帧
     *
     * 与 /runs/:runId/events （JSON 分页）的区别：本端点为长连接事实流，
     * 适合前端运行详情页面消费；JSON 端点适合审计回放或离线分析。
     */
    fastify.get<{Params: {runId: string}}>('/runs/:runId/events/stream', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        const user = request.user!;
        const {runId} = request.params;
        const requestId = request.requestId!;

        // 1. 鉴权 + 租户校验：拿不到说明跨租户或不存在，统一返回 404 不暴露存在性
        const run = await runService.getByTenant(user.tenantId, runId);
        if (!run) {
            return replyApiError(request, reply, 'RESOURCE_NOT_FOUND', '未找到对应运行记录，或你没有权限访问。');
        }

        // 2. 解析 Last-Event-ID 头作为续传起点；非法值视为 0
        const lastEventIdHeader = request.headers['last-event-id'];
        const lastEventIdRaw = Array.isArray(lastEventIdHeader)
            ? lastEventIdHeader[0]
            : lastEventIdHeader;
        const lastSequence = parseLastEventId(lastEventIdRaw);

        // 3. 准备 SSE 响应头
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'X-Request-Id': requestId,
        });

        const send = (sequence: number | null, envelope: RunStreamEnvelope) => {
            if (reply.raw.writableEnded) return;
            const payload = JSON.stringify(envelope);
            const idLine = sequence === null ? '' : `id: ${sequence}\n`;
            reply.raw.write(`${idLine}data: ${payload}\n\n`);
        };

        // 4. 历史回放：返回比 lastSequence 大的所有事件
        let lastSentSequence = lastSequence;
        try {
            const history = await runFactService.listRuntimeEventsAfter(user.tenantId, runId, lastSequence);
            for (const event of history) {
                send(event.sequence, {type: 'event', event});
                lastSentSequence = Math.max(lastSentSequence, event.sequence);
            }
        } catch (error) {
            log.error('Run SSE history replay failed', {requestId, runId, detail: (error as Error).message});
            send(null, {
                type: 'error',
                error: 'INTERNAL_ERROR',
                message: '回放历史事件失败',
                requestId,
            });
            reply.raw.end();
            return;
        }

        // 5. 如果运行已经处于终态，回放完直接发 end 并关闭，无需 live tail
        if (isTerminalRunStatus(run.status)) {
            send(null, {type: 'end', reason: run.status as 'completed' | 'failed' | 'cancelled'});
            reply.raw.end();
            return;
        }

        // 6. live tail：订阅 bus，过滤同租户同 run 的新事件
        let live = true;
        const seen = new Set<number>();

        const unsubscribe = runEventBus.subscribe(runId, (event: RunRuntimeEvent) => {
            if (!live) return;
            if (event.sequence <= lastSentSequence) return; // 与历史去重
            if (seen.has(event.sequence)) return;
            seen.add(event.sequence);
            lastSentSequence = event.sequence;
            send(event.sequence, {type: 'event', event});

            // run.completed / run.failed / run.cancelled → 关闭流
            if (isTerminalEventType(event.eventType)) {
                send(null, {
                    type: 'end',
                    reason: terminalReasonFromEventType(event.eventType),
                });
                close('terminal');
            }
        });

        // 7. 心跳：每 15s 发送一次 type=heartbeat，保活长连接
        const heartbeat = setInterval(() => {
            send(null, {type: 'heartbeat', occurredAt: new Date().toISOString()});
        }, 15_000);
        // Bun/Node 环境下必须 unref 避免 keepAlive 阻塞 server.close()
        heartbeat.unref?.();

        const close = (_reason: string) => {
            if (!live) return;
            live = false;
            clearInterval(heartbeat);
            unsubscribe();
            if (!reply.raw.writableEnded) reply.raw.end();
        };

        // 8. 客户端断开 / 请求 abort 时清理
        request.raw.on('close', () => close('client_close'));
        reply.raw.on('error', () => close('socket_error'));

        // 9. fastify 不要去 send 默认 body —— 我们已直接写 raw
        // 返回 reply 让 fastify 知道我们处理完了响应
        return reply;
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
