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
      request.log.error(error);
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
      request.log.error(error);
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
      request.log.error(error);
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
        if (!reply.sent) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Thread 不存在',
          });
        }
        return;
      }
      if (existing.tenantId !== user.tenantId || existing.templateId !== agentId) {
        if (!reply.sent) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Thread 不存在',
          });
        }
        return;
      }

      const thread = await threadManager.update(threadId, { title, status });
      if (!reply.sent) {
        reply.send(thread);
      }
    } catch (error) {
      // 检查响应是否已经发送（包括在 preHandler 中）
      if (!reply.sent && !reply.raw.writableEnded) {
        request.log.error(error);
        reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: '更新 Thread 失败',
        });
      }
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
        if (!reply.sent) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Thread 不存在',
          });
        }
        return;
      }
      if (existing.tenantId !== user.tenantId || existing.templateId !== agentId) {
        if (!reply.sent) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Thread 不存在',
          });
        }
        return;
      }

      const success = await threadManager.delete(threadId);
      if (!success) {
        if (!reply.sent) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Thread 不存在',
          });
        }
        return;
      }

      if (!reply.sent) {
        reply.status(204).send();
      }
    } catch (error) {
      // 检查响应是否已经发送（包括在 preHandler 中）
      if (!reply.sent && !reply.raw.writableEnded) {
        request.log.error(error);
        reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: '删除 Thread 失败',
        });
      }
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

  // ===== 7. 获取 Thread 历史 =====
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
      const transcriptPath = join(workspace, 'transcript.jsonl');
      let messages: Array<Record<string, unknown>> = [];

      try {
        const transcriptContent = readFileSync(transcriptPath, 'utf-8');
        const lines = transcriptContent.trim().split('\n');

        messages = lines
          .filter(line => line.trim().length > 0)
          .map(line => {
            try {
              return JSON.parse(line) as Record<string, unknown>;
            } catch {
              return null;
            }
          })
          .filter((msg): msg is Record<string, unknown> => msg !== null);

        const limitNum = limit ? parseInt(limit) : 50;
        if (messages.length > limitNum) {
          messages = messages.slice(-limitNum);
        }
      } catch (error) {
        // 文件不存在或读取失败，返回空列表
        console.warn('读取 transcript.jsonl 失败:', error);
      }

      // 转换为前端结构化格式（blocks）
      const transformed = transformHistory(messages);

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
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取历史记录失败',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
