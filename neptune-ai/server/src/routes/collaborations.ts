/**
 * 协作记录路由
 *
 * 提供跨 Agent 的协作记录查询 API
 */

import type { FastifyInstance } from 'fastify';
import { getThreadManager } from '../services/thread-manager';

/**
 * 协作记录路由
 */
export async function collaborationRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/collaborations/recent
   * 获取当前用户最近的协作记录（跨所有 Agent）
   */
  fastify.get('/recent', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { limit } = request.query as { limit?: string };

    const userId = request.user!.userId;
    const tenantId = request.user!.tenantId;

    try {
      const threadManager = getThreadManager();

      const recentThreads = await threadManager.listRecentThreads(
        userId,
        tenantId,
        limit ? parseInt(limit, 10) : 10,
      );

      reply.send({
        data: recentThreads,
        meta: {
          count: recentThreads.length,
          limit: limit ? parseInt(limit, 10) : 10,
        },
      });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: '获取协作记录失败',
      });
    }
  });
}
