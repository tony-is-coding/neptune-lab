import type {FastifyInstance} from 'fastify';
import {randomUUID} from 'crypto';
import {readFileSync} from 'fs';
import {join} from 'path';
import {threadManager} from '../services/thread-manager';
import {mapSSEEvent} from '../services/sse-event-mapper';
import {transformHistory} from '../services/history-transformer';
import {createLogger} from '../utils/logger';
import {resolveTranscriptPath, resolveTranscriptPaths} from '../utils/transcript-resolver';
import type {ChatConnectedEvent, ChatDoneEvent, ChatErrorEvent, ChatRequestContext} from '@shared/neptune-ai';
import {sendApiError, replyApiError, replyUnknownError} from '../utils/api-error';

const log = createLogger('routes:sessions');

/**
 * Agent Chat 路由（旧接口兼容）
 *
 * 提供 Agent 对话和历史查询功能。
 * 内部已从 QueryDispatcher 切换到 ThreadManager，
 * API 格式保持不变以兼容旧客户端。
 */
export async function sessionRoutes(fastify: FastifyInstance) {
    /**
     * POST /:agentId/chat
     * 执行 Agent 对话（SSE 流式响应）
     *
     * 旧接口兼容：自动查找或创建 Thread，然后 dispatch 消息。
     */
    fastify.post('/:agentId/chat', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId} = request.params as { agentId: string };
        const {content} = request.body as { content: string };
        const user = request.user;
        const requestId = randomUUID();
        reply.header('X-Request-Id', requestId);

        // 验证 content
        if (!content) {
            return sendApiError(reply, 400, {error: 'VALIDATION_FAILED', message: '缺少 content 参数', requestId});
        }

        const requestContext: Omit<ChatRequestContext, 'threadId'> = {
            requestId,
            tenantId: user.tenantId,
            userId: user.userId,
            agentId,
        };

        // 设置 SSE 响应头
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'X-Request-Id': requestId,
        });

        // 连接确认
        const connectedEvent: ChatConnectedEvent = {
            type: 'connected',
            requestId,
            threadId: '',
            timestamp: Date.now(),
        };
        reply.raw.write(`event: connected\ndata: ${JSON.stringify({...connectedEvent, agentId})}\n\n`);
// Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery

        // 创建 AbortController 用于取消操作
        const abortController = new AbortController();

        // 检测客户端断开
        request.raw.on('close', () => {
            if (!reply.raw.writableEnded) {
                abortController.abort();
            }
        });

        try {
            // dispatchToAgent 自动查找或创建 Thread，然后执行 query
            const stream = threadManager.dispatchToAgent(
                user.tenantId,
                user.userId,
                agentId,
                content,
                requestContext,
            );

            // 用于过滤重复的 assistant 事件
            // SDK 启用 includePartialMessages 后，会同时发送 stream_event（增量）和 assistant（完整）
            // 我们只需要 stream_event 的增量，assistant 的完整文本跳过
            let hasReceivedStreamDelta = false;

            for await (const sdkEvent of stream) {
                // 检查是否已取消
                if (abortController.signal.aborted) {
                    break;
                }

                // 检查是否为 Plan 事件（已经是 SSE 格式）
                const eventType = (sdkEvent as any).type;
                let usage: Record<string, unknown> = {};
                if (eventType === 'dispatch_done') {
                    usage = ((sdkEvent as any).usage || {}) as Record<string, unknown>;
                    if (!abortController.signal.aborted) {
                        const doneEvent: ChatDoneEvent = {type: 'done', requestId, usage};
                        reply.raw.write(`event: done\ndata: ${JSON.stringify(doneEvent)}\n\n`);
                    }
                    continue;
                }
                if (eventType === 'plan_created' || eventType === 'plan_step' || eventType === 'plan_done') {
                    // Plan 事件直接发送
                    reply.raw.write(`event: message\ndata: ${JSON.stringify(sdkEvent)}\n\n`);
                    // Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery
                    continue;
                }

                // 处理 stream_event：标记已收到增量
                if (eventType === 'stream_event') {
                    hasReceivedStreamDelta = true;
                }

                // 处理 assistant 事件：如果已收到过 stream_event，跳过文本内容（避免重复）
                if (eventType === 'assistant' && hasReceivedStreamDelta) {
                    // 检查是否有文本内容
                    const content = (sdkEvent as any).content;
                    const message = (sdkEvent as any).message;
                    const hasText = typeof content === 'string' || (message?.content && Array.isArray(message.content));
                    if (hasText) {
                        // 重置状态，为下一个文本块做准备
                        hasReceivedStreamDelta = false;
                        continue; // 跳过这个 assistant 事件
                    }
                }

                // 将 SDK 事件映射为前端格式
                const sseEvents = mapSSEEvent(sdkEvent as any);

                for (const event of sseEvents) {
                    reply.raw.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`);
                    // Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery
                }
            }

        } catch (error) {
            // 只有未被取消时才发送错误
            if (!abortController.signal.aborted) {
                const errorEvent: ChatErrorEvent = {
                    type: 'error',
                    error: 'INTERNAL_ERROR',
                    message: String(error),
                    requestId,
                };
                reply.raw.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
                // Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery
            }
        }

        reply.raw.end();
    });

    /**
     * GET /:agentId/history
     * 获取 Agent 对话历史
     *
     * 旧接口兼容：查找最新的 Thread，读取其 transcript.jsonl。
     */
    fastify.get('/:agentId/history', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId} = request.params as { agentId: string };
        const user = request.user;
        const {limit} = request.query as { limit?: string };

        try {
            // 1. 查找最新的 Thread（按 lastActiveAt 排序）
            const {data: threads} = await threadManager.list(agentId, user.userId, {limit: 1});

            if (threads.length === 0) {
                return reply.send({
                    data: [],
                    meta: {
                        agentId,
                        limit: limit ? parseInt(limit) : 50,
                        message: 'No thread found',
                    },
                });
            }

            const thread = threads[0];
            const workspace = thread.workspace;

            // 2. 读取 transcript.jsonl
            const transcriptPaths = resolveTranscriptPaths(workspace);
            let messages: Array<Record<string, unknown>> = [];

            try {
                if (transcriptPaths.length === 0) {
                    throw new Error('No transcript file found');
                }
                for (const filePath of transcriptPaths) {
                    const transcriptContent = readFileSync(filePath, 'utf-8');
                    const lines = transcriptContent.trim().split('\n');

                    const parsed = lines
                        .filter(line => line.trim().length > 0)
                        .map(line => {
                            try {
                                return JSON.parse(line) as Record<string, unknown>;
                            } catch {
                                return null;
                            }
                        })
                        .filter((msg): msg is Record<string, unknown> => msg !== null);

                    messages.push(...parsed);
                }
            } catch (error) {
                // 文件不存在或读取失败，返回空列表
                log.warn('Transcript read failed', {detail: (error as Error).message});
            }

            // 转换为前端结构化格式（blocks）
            let transformed = transformHistory(messages);

            // limit 作用在转换后的消息上
            const limitNum = limit ? parseInt(limit) : 50;
            if (transformed.length > limitNum) {
                transformed = transformed.slice(-limitNum);
            }

            reply.send({
                data: transformed,
                meta: {
                    agentId,
                    threadId: thread.id,
                    limit: limit ? parseInt(limit) : 50,
                    count: transformed.length,
                },
            });
        } catch (error) {
            replyApiError(request, reply, 'INTERNAL_ERROR', '获取历史记录失败');
        }
    });
}
