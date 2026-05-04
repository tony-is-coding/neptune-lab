import type { FastifyInstance } from 'fastify';
import { costAggregator } from '../services/cost.js';

/**
 * 计费路由
 *
 * GET /api/v1/tenants/:id/billing — 查询租户用量和费用
 */
export async function billingRoutes(fastify: FastifyInstance) {
  /**
   * 获取租户的账单汇总
   */
  fastify.get<{
    Params: { id: string };
  }>('/:id/billing', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id: tenantId } = request.params;
    const user = request.user!;

    // 权限检查：只有 platform_admin 或该租户的 tenant_admin 可以查看
    if (
      user.role !== 'platform_admin' &&
      !(user.role === 'tenant_admin' && user.tenantId === tenantId)
    ) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: '无权查看该租户的账单' });
    }

    try {
      const [usage, quotaCounter] = await Promise.all([
        costAggregator.getTenantUsage(tenantId),
        costAggregator.getQuotaCounter(tenantId),
      ]);

      return {
        tenantId,
        database: usage,
        realtime: quotaCounter,
      };
    } catch (error) {
      request.log.error({ error }, '获取租户账单失败');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: '获取账单失败' });
    }
  });
}
