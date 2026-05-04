import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { queryDispatcher } from '../services/session';

/**
 * Agent Chat 路由
 *
 * 提供 Agent 对话和历史查询功能
 */
export async function sessionRoutes(fastify: FastifyInstance) {
  /**
   * POST /:agentId/chat
   * 执行 Agent 对话（SSE 流式响应）
   */
  fastify.post('/:agentId/chat', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const { content } = request.body as { content: string };
    const user = request.user!;

    // 验证 content
    if (!content) {
      return reply.status(400).send({ error: 'MISSING_CONTENT', message: '缺少 content 参数' });
    }

    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 连接确认
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ agentId, timestamp: Date.now() })}\n\n`);

    // 创建 AbortController 用于取消操作
    const abortController = new AbortController();

    // 检测客户端断开
    request.raw.on('close', () => {
      if (!reply.raw.writableEnded) {
        abortController.abort();
      }
    });

    try {
      // dispatch 返回 AsyncGenerator，直接迭代
      const stream = queryDispatcher.dispatch({
        tenantId: user.tenantId,
        userId: user.userId,
        agentId,
        content,
      });

      for await (const event of stream) {
        // 检查是否已取消
        if (abortController.signal.aborted) {
          break;
        }
        const eventType = (event as any).type || 'message';
        reply.raw.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`);
      }

      // 只有未被取消时才发送 done 事件
      if (!abortController.signal.aborted) {
        const usage = queryDispatcher.getUsage();
        if (usage) {
          reply.raw.write(`event: done\ndata: ${JSON.stringify({ usage })}\n\n`);
        }
      }
    } catch (error) {
      // 只有未被取消时才发送错误
      if (!abortController.signal.aborted) {
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: 'QUERY_ERROR', message: String(error) })}\n\n`);
      }
    }

    reply.raw.end();
  });

  /**
   * GET /:agentId/history
   * 获取 Agent 对话历史
   */
  fastify.get('/:agentId/history', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const user = request.user!;
    const { limit } = request.query as { limit?: string };

    try {
      // 1. 获取该用户的 session workspace（使用最新的活跃 session）
      const sessions = await queryDispatcher.list({
        tenantId: user.tenantId,
        userId: user.userId,
        agentId,
        status: 'active',
        limit: 1,
      });

      if (sessions.length === 0) {
        return reply.send({
          data: [],
          meta: {
            agentId,
            limit: limit ? parseInt(limit) : 50,
            message: 'No active session found',
          },
        });
      }

      const session = sessions[0];
      const workspace = session.workspace;

      // 2. 读取 transcript.jsonl
      const transcriptPath = join(workspace, 'transcript.jsonl');
      let messages: Array<Record<string, unknown>> = [];

      try {
        const transcriptContent = readFileSync(transcriptPath, 'utf-8');
        const lines = transcriptContent.trim().split('\n');

        // 解析每一行为 JSON 对象
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

        // 应用 limit
        const limitNum = limit ? parseInt(limit) : 50;
        if (messages.length > limitNum) {
          messages = messages.slice(-limitNum); // 返回最近的消息
        }
      } catch (error) {
        // 文件不存在或读取失败，返回空列表
        console.warn('读取 transcript.jsonl 失败:', error);
      }

      reply.send({
        data: messages,
        meta: {
          agentId,
          sessionId: session.id,
          limit: limit ? parseInt(limit) : 50,
          count: messages.length,
        },
      });
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取历史记录失败',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
