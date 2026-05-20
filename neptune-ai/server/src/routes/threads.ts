/**
 * Thread CRUD + Chat + History 路由
 *
 * 7 个端点：
 * 1. POST   /:agentId/threads             — 创建 Thread
 * 2. GET    /:agentId/threads             — 列出 Thread
 * 3. GET    /:agentId/threads/:threadId   — 获取 Thread 详情
 * 4. PATCH  /:agentId/threads/:threadId   — 更新 Thread
 * 5. DELETE /:agentId/threads/:threadId   — 删除 Thread
 * 6. POST   /:agentId/threads/:threadId/chat    — 发送消息（SSE）
 * 7. GET    /:agentId/threads/:threadId/history  — 获取历史
 */

import type {FastifyInstance} from 'fastify';
import {randomUUID} from 'crypto';
import {readFileSync, appendFileSync, existsSync} from 'fs';
import {join} from 'path';
import {threadManager} from '../services/thread-manager';
import {mapSSEEvent} from '../services/sse-event-mapper';
import {transformHistory} from '../services/history-transformer';
import {roleMiddleware} from '../middleware/auth';
import {createLogger} from '../utils/logger';
import {resolveTranscriptPath, resolveTranscriptPaths} from '../utils/transcript-resolver';
import type {ChatConnectedEvent, ChatDoneEvent, ChatErrorEvent, ChatRequestContext} from '@shared/neptune-ai';
import {sendApiError} from '../utils/api-error';
import {agentTemplateService} from '../services/agent-template';

const log = createLogger('routes:threads');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function notFoundEnvelope(message: string) {
    return {error: 'NOT_FOUND', message};
}

async function canAccessAgent(agentId: string, tenantId: string): Promise<boolean> {
    if (!UUID_RE.test(agentId)) return false;
    return agentTemplateService.belongsToTenant(agentId, tenantId);
}

function isValidId(id: string): boolean {
    return UUID_RE.test(id);
}

async function getOwnedThread(agentId: string, threadId: string, tenantId: string) {
    if (!isValidId(agentId) || !isValidId(threadId)) return null;
    const thread = await threadManager.get(threadId);
    if (!thread || thread.tenantId !== tenantId || thread.templateId !== agentId) return null;
    return thread;
}

/**
 * 将 events.jsonl 的事件数组转换为前端 ChatMessage 格式
 *
 * events.jsonl 格式：每行一个前端事件
 * 输出：ChatMessage[] (与实时 SSE 流产生的 blocks 结构一致)
 */
function eventsToMessages(events: Array<Record<string, unknown>>): Array<{
    id: string;
    role: string;
    blocks: unknown[];
    status: string
}> {
    const messages: Array<{ id: string; role: string; blocks: unknown[]; status: string }> = [];
    let currentAssistantBlocks: unknown[] = [];
    let msgCounter = 0;

    const flushAssistant = () => {
        if (currentAssistantBlocks.length > 0) {
            messages.push({
                id: `hist-${++msgCounter}`,
                role: 'assistant',
                blocks: currentAssistantBlocks,
                status: 'complete',
            });
            currentAssistantBlocks = [];
        }
    };

    for (const event of events) {
        // User message
        if ((event as any)._role === 'user') {
            flushAssistant();
            messages.push({
                id: `hist-${++msgCounter}`,
                role: 'user',
                blocks: [{type: 'text', content: String(event.content || '')}],
                status: 'complete',
            });
            continue;
        }

        const type = event.type as string;

        // Assistant events → accumulate into blocks
        if (type === 'thinking') {
            currentAssistantBlocks.push({type: 'thinking', content: String(event.content || ''), duration: 0});
        } else if (type === 'text') {
            currentAssistantBlocks.push({type: 'text', content: String(event.content || '')});
        } else if (type === 'ask_user') {
            const questions = Array.isArray(event.questions) ? event.questions : [];
            currentAssistantBlocks.push({
                type: 'ask_user',
                id: String(event.id || ''),
                questions,
                answered: Boolean(event.answered),
                answers: event.answers || undefined,
            });
        } else if (type === 'plan_step') {
            const planId = String(event.planId || '');
            const existingPlan = currentAssistantBlocks.find((block): block is {type: string; id: string; todos: Array<Record<string, unknown>>} =>
                typeof block === 'object' &&
                block !== null &&
                (block as any).type === 'plan' &&
                (block as any).id === planId &&
                Array.isArray((block as any).todos)
            );
            const todo = {
                content: String(event.subject || ''),
                status: String(event.status || 'pending'),
                activeForm: event.activeForm ? String(event.activeForm) : undefined,
            };
            if (existingPlan) {
                const existingIndex = existingPlan.todos.findIndex(t => t.content === todo.content);
                if (existingIndex >= 0) {
                    existingPlan.todos[existingIndex] = todo;
                } else {
                    existingPlan.todos.push(todo);
                }
            } else {
                currentAssistantBlocks.push({
                    type: 'plan',
                    id: planId,
                    todos: [{
                    content: String(event.subject || ''),
                    status: String(event.status || 'pending'),
                    activeForm: event.activeForm ? String(event.activeForm) : undefined,
                    }],
                });
            }
        } else if (type === 'tool_use' && event.name === 'TodoWrite') {
            // TodoWrite → plan block
            const input = event.input as Record<string, unknown> | undefined;
            if (input?.todos && Array.isArray(input.todos)) {
                currentAssistantBlocks.push({
                    type: 'plan',
                    id: String(event.id || ''),
                    todos: (input.todos as Array<Record<string, unknown>>).map(t => ({
                        content: String(t.content || ''),
                        status: String(t.status || 'pending'),
                        activeForm: t.activeForm ? String(t.activeForm) : undefined,
                    })),
                });
            }
        } else if (type === 'tool_use') {
            currentAssistantBlocks.push({
                type: 'tool_use',
                id: String(event.id || ''),
                name: String(event.name || ''),
                input: event.input || {},
                status: String(event.status || 'completed'),
            });
        } else if (type === 'artifact') {
            currentAssistantBlocks.push({
                type: 'artifact',
                id: String(event.id || ''),
                title: String(event.title || ''),
                fileType: String(event.fileType || ''),
                content: String(event.content || ''),
            });
        }
    }

    flushAssistant();
    return messages;
}

export async function threadRoutes(fastify: FastifyInstance) {
    // ===== 1. 创建 Thread =====
    fastify.post('/:agentId/threads', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId} = request.params as { agentId: string };
        const {title} = (request.body as { title?: string }) || {};
        const user = request.user;

        try {
            if (!(await canAccessAgent(agentId, user.tenantId))) {
                return reply.status(404).send(notFoundEnvelope('Agent 模板不存在'));
            }

            const thread = await threadManager.create({
                tenantId: user.tenantId,
                userId: user.userId,
                agentId,
                title,
            });

            reply.status(201).send(thread);
        } catch (error) {
            if (reply.sent || reply.raw.headersSent) return;
            log.error('Request failed', {detail: (error as Error).message});
            return reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '创建 Thread 失败',
            });
        }
    });

    // ===== 2. 列出 Thread =====
    fastify.get('/:agentId/threads', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId} = request.params as { agentId: string };
        const {status, limit, offset} = request.query as {
            status?: string;
            limit?: string;
            offset?: string;
        };
        const user = request.user;

        try {
            if (!(await canAccessAgent(agentId, user.tenantId))) {
                return reply.status(404).send(notFoundEnvelope('Agent 模板不存在'));
            }

            const result = await threadManager.list(agentId, user.userId, {
                status,
                limit: limit ? parseInt(limit, 10) : 50,
                offset: offset ? parseInt(offset, 10) : 0,
            });

            reply.send(result);
        } catch (error) {
            if (reply.sent || reply.raw.headersSent) return;
            log.error('Request failed', {detail: (error as Error).message});
            return reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '获取 Thread 列表失败',
            });
        }
    });

    // ===== 3. 获取 Thread 详情 =====
    fastify.get('/:agentId/threads/:threadId', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId, threadId} = request.params as {
            agentId: string;
            threadId: string;
        };
        const user = request.user;

        try {
            const thread = await getOwnedThread(agentId, threadId, user.tenantId);
            if (!thread) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Thread 不存在',
                });
            }

            reply.send(thread);
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '获取 Thread 详情失败',
            });
        }
    });

    // ===== 4. 更新 Thread =====
    fastify.patch('/:agentId/threads/:threadId', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId, threadId} = request.params as {
            agentId: string;
            threadId: string;
        };
        const {title, status} = request.body as {
            title?: string;
            status?: string;
        };
        const user = request.user;

        try {
            // 先验证 thread 存在且属于当前租户
            const existing = await getOwnedThread(agentId, threadId, user.tenantId);
            if (!existing) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Thread 不存在',
                });
            }

            const thread = await threadManager.update(threadId, {title, status});
            reply.send(thread);
        } catch (error) {
            if (reply.sent || reply.raw.headersSent) return;
            log.error('Request failed', {detail: (error as Error).message});
            return reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '更新 Thread 失败',
            });
        }
    });

    // ===== 5. 删除 Thread =====
    fastify.delete('/:agentId/threads/:threadId', {
        preHandler: [fastify.authenticate, roleMiddleware('admin')],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId, threadId} = request.params as {
            agentId: string;
            threadId: string;
        };
        const user = request.user;

        try {
            const sendNotFound = () => reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Thread 不存在',
            });

            // 先验证 thread 存在且属于当前租户
            const existing = await getOwnedThread(agentId, threadId, user.tenantId);
            if (!existing) {
                return sendNotFound();
            }

            const success = await threadManager.delete(threadId);
            if (!success) {
                return sendNotFound();
            }

            return reply.status(204).send();
        } catch (error) {
            if (reply.sent || reply.raw.headersSent) return;
            log.error('Request failed', {detail: (error as Error).message});
            return reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '删除 Thread 失败',
            });
        }
    });

    // ===== 6. 发送消息（SSE） =====
    fastify.post('/:agentId/threads/:threadId/chat', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId, threadId} = request.params as {
            agentId: string;
            threadId: string;
        };
        const {content} = request.body as { content?: string };
        const user = request.user;
        const requestId = randomUUID();
        reply.header('X-Request-Id', requestId);

        // 验证 content
        if (!content) {
            return sendApiError(reply, 400, {
                error: 'MISSING_CONTENT',
                message: '缺少 content 参数',
                requestId,
            });
        }

        // 获取 Thread 并验证
        const thread = await getOwnedThread(agentId, threadId, user.tenantId);
        if (!thread) {
            return sendApiError(reply, 404, {
                error: 'NOT_FOUND',
                message: 'Thread 不存在',
                requestId,
            });
        }

        // 验证状态
        if (thread.status === 'running') {
            return sendApiError(reply, 409, {
                error: 'CONFLICT',
                message: 'Thread 正在执行中',
                requestId,
            });
        }
        if (thread.status === 'completed') {
            return sendApiError(reply, 400, {
                error: 'BAD_REQUEST',
                message: 'Thread 已结束 (completed)',
                requestId,
            });
        }
        // error 状态允许重试（engine 可能因 server 重启丢失）

        const chatContext: ChatRequestContext = {
            requestId,
            tenantId: user.tenantId,
            userId: user.userId,
            agentId,
            threadId,
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
        const connectedEvent: ChatConnectedEvent = {type: 'connected', requestId, threadId, timestamp: Date.now()};
        reply.raw.write(`event: connected\ndata: ${JSON.stringify(connectedEvent)}\n\n`);
        // Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery

        // 创建 AbortController 用于取消操作
        const abortController = new AbortController();

        // 检测客户端断开
        request.raw.on('close', () => {
            if (!reply.raw.writableEnded) {
                abortController.abort();
            }
        });

        // Event Sourcing: 持久化前端事件到 events.jsonl
        const eventsFilePath = join(thread.workspace, 'events.jsonl');
        const persistEvent = (evt: unknown) => {
            try {
                appendFileSync(eventsFilePath, JSON.stringify(evt) + '\n', 'utf-8');
            } catch { /* 写入失败不影响 SSE */
            }
        };

        // 写入 user message
        persistEvent({_meta: 'request', requestId, threadId, agentId, tenantId: user.tenantId, userId: user.userId});
        persistEvent({_role: 'user', requestId, content});

        // 用于收集完整文本（不存增量 delta，只存最终合并文本）
        let currentText = '';
        let currentThinking = '';
        let dispatchUsage: Record<string, unknown> = {};

        try {
            const stream = threadManager.dispatch(threadId, content, chatContext);

            // 用于过滤重复的 assistant 事件
            let hasReceivedStreamDelta = false;

            for await (const sdkEvent of stream) {
                if (abortController.signal.aborted) {
                    break;
                }
                // 检查是否为 Plan 事件（已经是 SSE 格式）
                const eventType = (sdkEvent as any).type;
                if (eventType === 'dispatch_done') {
                    dispatchUsage = ((sdkEvent as any).usage || {}) as Record<string, unknown>;
                    continue;
                }
                if (eventType === 'plan_created' || eventType === 'plan_step' || eventType === 'plan_done') {
                    // Plan 事件直接发送
                    reply.raw.write(`event: message\ndata: ${JSON.stringify(sdkEvent)}\n\n`);
                    persistEvent(sdkEvent);
                    // Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery
                    continue;
                }
                // 处理 stream_event：标记已收到增量，收集文本
                if (eventType === 'stream_event') {
                    hasReceivedStreamDelta = true;
                    // 收集增量文本用于持久化
                    const innerEvent = (sdkEvent as any).event;
                    if (innerEvent?.type === 'content_block_delta') {
                        const delta = innerEvent.delta;
                        if (delta?.type === 'text_delta' && delta.text) {
                            currentText += delta.text;
                        } else if (delta?.type === 'thinking_delta' && delta.thinking) {
                            currentThinking += delta.thinking;
                        }
                    }
                }

                // 处理 assistant 事件：如果已收到过 stream_event，跳过文本内容（避免重复）
                // 但仍然提取 tool_use 的完整 input（流式中 tool_use 的 input 可能为空）
                if (eventType === 'assistant' && hasReceivedStreamDelta) {
                    // 持久化累积的 thinking 和 text
                    if (currentThinking) {
                        persistEvent({type: 'thinking', content: currentThinking});
                        currentThinking = '';
                    }
                    if (currentText) {
                        persistEvent({type: 'text', content: currentText});
                        currentText = '';
                    }

                    const message = (sdkEvent as any).message;
                    if (message?.content && Array.isArray(message.content)) {
                        // 提取 tool_use blocks 的完整 input，发送更新事件 + 持久化
                        for (const block of message.content) {
                            if (block.type === 'tool_use' && block.id) {
                                const toolName = String(block.name || '');
                                const toolInput = block.input || {};
                                const hasInput = Object.keys(toolInput).length > 0;

                                // 只有有 input 的 tool_use 才发送更新和持久化
                                if (hasInput) {
                                    const toolEvent = {
                                        type: 'tool_use',
                                        id: String(block.id),
                                        name: toolName,
                                        input: toolInput,
                                        status: 'completed',
                                    };
                                    // 发送 tool_use 更新（前端会用 id 匹配并更新 input）
                                    reply.raw.write(`event: message\ndata: ${JSON.stringify({
                                        ...toolEvent,
                                        status: 'running'
                                    })}\n\n`);
                                    // 持久化为 completed 状态
                                    persistEvent(toolEvent);

                                    // 如果是 Write 工具写入文档，发送 artifact 事件
                                    if (toolName === 'Write' && toolInput.file_path && toolInput.content) {
                                        const filePath = String(toolInput.file_path);
                                        const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
                                        const docExtensions = ['.md', '.html', '.htm', '.txt', '.json', '.csv', '.xml', '.yaml', '.yml'];
                                        if (docExtensions.includes(ext)) {
                                            const fileName = filePath.split('/').pop() || filePath;
                                            const artifactEvent = {
                                                type: 'artifact',
                                                id: `artifact-${block.id}`,
                                                title: fileName,
                                                fileType: ext,
                                                content: String(toolInput.content),
                                            };
                                            reply.raw.write(`event: message\ndata: ${JSON.stringify(artifactEvent)}\n\n`);
                                            persistEvent(artifactEvent);
                                        }
                                    }
                                } else {
                                    // input 为空（大文件被截断），只持久化名称不持久化空 input
                                    persistEvent({
                                        type: 'tool_use',
                                        id: String(block.id),
                                        name: toolName,
                                        input: {},
                                        status: 'completed'
                                    });
                                }
                            }
                        }
                    }
                    // 重置状态，为下一个文本块做准备
                    hasReceivedStreamDelta = false;
                    continue; // 跳过 assistant 的文本内容（已通过 stream_event 发送）
                }

                // 将 SDK 事件映射为前端格式
                const sseEvents = mapSSEEvent(sdkEvent as any);

                for (const event of sseEvents) {
                    reply.raw.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`);
                    if (event.type === 'ask_user' || event.type === 'artifact') {
                        persistEvent(event);
                    }
                    // Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery
                }
            }

            // 持久化最后一段文本（如果有）
            if (currentThinking) {
                persistEvent({type: 'thinking', content: currentThinking});
            }
            if (currentText) {
                persistEvent({type: 'text', content: currentText});
            }
            persistEvent({_meta: 'done'});

            if (!abortController.signal.aborted) {
                const doneEvent: ChatDoneEvent = {type: 'done', requestId, usage: dispatchUsage};
                reply.raw.write(`event: done\ndata: ${JSON.stringify(doneEvent)}\n\n`);
                // Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery
            }
        } catch (error) {
            if (!abortController.signal.aborted) {
                const errorEvent: ChatErrorEvent = {
                    type: 'error',
                    error: 'QUERY_ERROR',
                    message: String(error),
                    requestId,
                };
                reply.raw.write(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`);
                // Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery
            }
        }

        reply.raw.end();
    });

    // ===== 7. 回复 AskUserQuestion =====
    fastify.post('/:agentId/threads/:threadId/reply', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId, threadId} = request.params as {
            agentId: string;
            threadId: string;
        };
        const {toolUseId, answers} = request.body as {
            toolUseId: string;
            answers: Record<string, string>;
        };
        const user = request.user;

        if (!toolUseId || !answers) {
            return reply.status(400).send({
                error: 'MISSING_PARAMS',
                message: '缺少 toolUseId 或 answers 参数',
            });
        }

        // 验证 Thread 归属
        const thread = await getOwnedThread(agentId, threadId, user.tenantId);
        if (!thread) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Thread 不存在',
            });
        }

        // TODO: 将 answers 作为 tool_result 注入 Engine
        // 当前 Engine SDK 的 tool_result 注入机制需要进一步对接
        // 暂时返回 202 表示已接收
        log.info('AskUserQuestion reply received', {threadId, toolUseId, answers});

        return reply.status(202).send({
            status: 'accepted',
            toolUseId,
        });
    });

    // ===== 8.5 获取 Thread Tasks =====
    fastify.get('/:agentId/threads/:threadId/tasks', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId, threadId} = request.params as {
            agentId: string;
            threadId: string;
        };
        const user = request.user;

        try {
            const thread = await getOwnedThread(agentId, threadId, user.tenantId);
            if (!thread) {
                return reply.status(404).send({error: 'NOT_FOUND', message: 'Thread 不存在'});
            }

            const {PlanManager} = await import('../services/plan/PlanManager');
            const tasks = PlanManager.loadTasks(thread.workspace);

            reply.send({data: tasks});
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({error: 'INTERNAL_ERROR', message: '获取任务列表失败'});
        }
    });

    // ===== 9. 获取 Thread 历史 =====
    fastify.get('/:agentId/threads/:threadId/history', {
        preHandler: [fastify.authenticate],
    }, async (request, reply) => {
        if (!request.user || reply.sent) return;
        const {agentId, threadId} = request.params as {
            agentId: string;
            threadId: string;
        };
        const {limit} = request.query as { limit?: string };
        const user = request.user;

        try {
            const thread = await getOwnedThread(agentId, threadId, user.tenantId);
            if (!thread) {
                return reply.status(404).send({
                    error: 'NOT_FOUND',
                    message: 'Thread 不存在',
                });
            }

            const workspace = thread.workspace;

            // 优先读取 events.jsonl（Event Sourcing 格式，零转换）
            const eventsPath = join(workspace, 'events.jsonl');
            if (existsSync(eventsPath)) {
                try {
                    const eventsContent = readFileSync(eventsPath, 'utf-8');
                    const events = eventsContent.trim().split('\n')
                        .filter(line => line.trim().length > 0)
                        .map(line => {
                            try {
                                return JSON.parse(line);
                            } catch {
                                return null;
                            }
                        })
                        .filter((e): e is Record<string, unknown> => e !== null)
                        .filter(e => !(e as any)._meta); // 过滤 _meta 标记

                    // 将 events 转换为前端 ChatMessage 格式
                    const messages = eventsToMessages(events);

                    const limitNum = limit ? parseInt(limit) : 50;
                    const limited = messages.length > limitNum ? messages.slice(-limitNum) : messages;

                    return reply.send({
                        data: limited,
                        meta: {threadId, agentId, limit: limitNum, count: limited.length, format: 'events'},
                    });
                } catch (error) {
                    log.warn('Events file read failed, falling back to transcript', {
                        threadId,
                        detail: (error as Error).message
                    });
                }
            }

            // Fallback: 旧的 transcript 路径
            const transcriptPaths = resolveTranscriptPaths(workspace);
            let messages: Array<Record<string, unknown>> = [];

            try {
                if (transcriptPaths.length === 0) {
                    throw new Error('No transcript file found');
                }
                // 合并所有 transcript 文件（按时间升序）
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

                // 注意：不在原始行上做 limit，在转换后的消息上做
            } catch (error) {
                // 文件不存在或读取失败，返回空列表
                log.warn('Transcript read failed', {threadId, detail: (error as Error).message});
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
                    threadId,
                    agentId,
                    limit: limit ? parseInt(limit) : 50,
                    count: transformed.length,
                },
            });
        } catch (error) {
            log.error('Request failed', {detail: (error as Error).message});
            reply.status(500).send({
                error: 'INTERNAL_ERROR',
                message: '获取历史记录失败',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
}
