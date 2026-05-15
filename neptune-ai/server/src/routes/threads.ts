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

import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { threadManager } from '../services/thread-manager';
import { mapSSEEvent } from '../services/sse-event-mapper';
import { transformHistory } from '../services/history-transformer';
import { roleMiddleware } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { resolveTranscriptPath, resolveTranscriptPaths } from '../utils/transcript-resolver';

const log = createLogger('routes:threads');

export async function threadRoutes(fastify: FastifyInstance) {
  // ===== 1. 创建 Thread =====
  fastify.post('/:agentId/threads', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (!request.user || reply.sent) return;
    const { agentId } = request.params as { agentId: string };
    const { title } = (request.body as { title?: string }) || {};
    const user = request.user;

    try {
      const thread = await threadManager.create({
        tenantId: user.tenantId,
        userId: user.userId,
        agentId,
        title,
      });

      reply.status(201).send(thread);
    } catch (error) {
      log.error('Request failed', { detail: (error as Error).message });
      reply.status(500).send({
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
    const { agentId } = request.params as { agentId: string };
    const { status, limit, offset } = request.query as {
      status?: string;
      limit?: string;
      offset?: string;
    };
    const user = request.user;

    try {
      const result = await threadManager.list(agentId, user.userId, {
        status,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      reply.send(result);
    } catch (error) {
      log.error('Request failed', { detail: (error as Error).message });
      reply.status(500).send({
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
    const { agentId, threadId } = request.params as {
      agentId: string;
      threadId: string;
    };
    const user = request.user;

    try {
      const thread = await threadManager.get(threadId);

      if (!thread) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Thread 不存在',
        });
      }

      // 验证归属：thread 必须属于当前用户的租户和 agent
      if (thread.tenantId !== user.tenantId || thread.templateId !== agentId) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Thread 不存在',
        });
      }

      reply.send(thread);
    } catch (error) {
      log.error('Request failed', { detail: (error as Error).message });
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
    const { agentId, threadId } = request.params as {
      agentId: string;
      threadId: string;
    };
    const { title, status } = request.body as {
      title?: string;
      status?: string;
    };
    const user = request.user;

    try {
      // 先验证 thread 存在且属于当前租户
      const existing = await threadManager.get(threadId);
      if (!existing) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Thread 不存在',
        });
      }
      if (existing.tenantId !== user.tenantId || existing.templateId !== agentId) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Thread 不存在',
        });
      }

      const thread = await threadManager.update(threadId, { title, status });
      reply.send(thread);
    } catch (error) {
      log.error('Request failed', { detail: (error as Error).message });
      reply.status(500).send({
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
    const { agentId, threadId } = request.params as {
      agentId: string;
      threadId: string;
    };
    const user = request.user;

    try {
      // 先验证 thread 存在且属于当前租户
      const existing = await threadManager.get(threadId);
      if (!existing) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Thread 不存在',
        });
      }
      if (existing.tenantId !== user.tenantId || existing.templateId !== agentId) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Thread 不存在',
        });
      }

      const success = await threadManager.delete(threadId);
      if (!success) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Thread 不存在',
        });
      }

      reply.status(204).send();
    } catch (error) {
      log.error('Request failed', { detail: (error as Error).message });
      reply.status(500).send({
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
    const { agentId, threadId } = request.params as {
      agentId: string;
      threadId: string;
    };
    const { content } = request.body as { content?: string };
    const user = request.user;

    // 验证 content
    if (!content) {
      return reply.status(400).send({
        error: 'MISSING_CONTENT',
        message: '缺少 content 参数',
      });
    }

    // 获取 Thread 并验证
    const thread = await threadManager.get(threadId);
    if (!thread) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Thread 不存在',
      });
    }
    if (thread.tenantId !== user.tenantId || thread.templateId !== agentId) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Thread 不存在',
      });
    }

    // 验证状态
    if (thread.status === 'running') {
      return reply.status(409).send({
        error: 'CONFLICT',
        message: 'Thread 正在执行中',
      });
    }
    if (thread.status === 'completed') {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Thread 已结束 (completed)',
      });
    }
    // error 状态允许重试（engine 可能因 server 重启丢失）

    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 连接确认
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ threadId, timestamp: Date.now() })}\n\n`);
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
      const stream = threadManager.dispatch(threadId, content);

      // 用于过滤重复的 assistant 事件
      // SDK 启用 includePartialMessages 后，会同时发送 stream_event（增量）和 assistant（完整）
      // 我们只需要 stream_event 的增量，assistant 的完整文本跳过
      let hasReceivedStreamDelta = false;

      for await (const sdkEvent of stream) {
        if (abortController.signal.aborted) {
          break;
        }

        // 检查是否为 Plan 事件（已经是 SSE 格式）
        const eventType = (sdkEvent as any).type;
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
        // 但仍然提取 tool_use 的完整 input（流式中 tool_use 的 input 可能为空）
        if (eventType === 'assistant' && hasReceivedStreamDelta) {
          const message = (sdkEvent as any).message;
          if (message?.content && Array.isArray(message.content)) {
            // 提取 tool_use blocks 的完整 input，发送更新事件
            for (const block of message.content) {
              if (block.type === 'tool_use' && block.id && block.input) {
                const toolName = String(block.name || '');
                // 发送 tool_use 更新（前端会用 id 匹配并更新 input）
                reply.raw.write(`event: message\ndata: ${JSON.stringify({
                  type: 'tool_use',
                  id: String(block.id),
                  name: toolName,
                  input: block.input,
                  status: 'running',
                })}\n\n`);

                // 如果是 Write 工具写入文档，发送 artifact 事件
                if (toolName === 'Write' && block.input.file_path && block.input.content) {
                  const filePath = String(block.input.file_path);
                  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
                  const docExtensions = ['.md', '.html', '.htm', '.txt', '.json', '.csv', '.xml', '.yaml', '.yml'];
                  if (docExtensions.includes(ext)) {
                    const fileName = filePath.split('/').pop() || filePath;
                    reply.raw.write(`event: message\ndata: ${JSON.stringify({
                      type: 'artifact',
                      id: `artifact-${block.id}`,
                      title: fileName,
                      fileType: ext,
                      content: String(block.input.content),
                    })}\n\n`);
                  }
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
      // Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery
        }
      }

      if (!abortController.signal.aborted) {
        const usage = threadManager.getLastUsage();
        reply.raw.write(`event: done\ndata: ${JSON.stringify({ usage: usage || {} })}\n\n`);
    // Note: X-Accel-Buffering: no + Cache-Control: no-cache ensures real-time delivery
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: 'QUERY_ERROR', message: String(error) })}\n\n`);
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
    const { agentId, threadId } = request.params as {
      agentId: string;
      threadId: string;
    };
    const { toolUseId, answers } = request.body as {
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
    const thread = await threadManager.get(threadId);
    if (!thread || thread.tenantId !== user.tenantId || thread.templateId !== agentId) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Thread 不存在',
      });
    }

    // TODO: 将 answers 作为 tool_result 注入 Engine
    // 当前 Engine SDK 的 tool_result 注入机制需要进一步对接
    // 暂时返回 202 表示已接收
    log.info('AskUserQuestion reply received', { threadId, toolUseId, answers });

    return reply.status(202).send({
      status: 'accepted',
      toolUseId,
    });
  });

  // ===== 8. 获取 Thread 历史 =====
  fastify.get('/:agentId/threads/:threadId/history', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    if (!request.user || reply.sent) return;
    const { agentId, threadId } = request.params as {
      agentId: string;
      threadId: string;
    };
    const { limit } = request.query as { limit?: string };
    const user = request.user;

    try {
      const thread = await threadManager.get(threadId);
      if (!thread) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Thread 不存在',
        });
      }
      if (thread.tenantId !== user.tenantId || thread.templateId !== agentId) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Thread 不存在',
        });
      }

      const workspace = thread.workspace;
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
        log.warn('Transcript read failed', { threadId, detail: (error as Error).message });
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
      log.error('Request failed', { detail: (error as Error).message });
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取历史记录失败',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
