import { db, agentTemplates, sessions, billingRecords, type NewAgentTemplate, type AgentTemplate } from '../db';
import { eq, and, gte, count, sum, sql } from 'drizzle-orm';

/**
 * Agent 模板服务类
 * 负责 Agent 模板的 CRUD 操作
 */
export class AgentTemplateService {
  /**
   * 创建 Agent 模板
   * @param template 模板数据
   * @returns 创建的模板
   */
  async create(template: Omit<NewAgentTemplate, 'id'>): Promise<AgentTemplate> {
    const [newTemplate] = await db.insert(agentTemplates).values(template).returning();
    return newTemplate;
  }

  /**
   * 根据 ID 获取模板
   * @param id 模板 ID
   * @returns 模板信息，如果不存在则返回 null
   */
  async findById(id: string): Promise<AgentTemplate | null> {
    const template = await db.query.agentTemplates.findFirst({
      where: eq(agentTemplates.id, id),
    });
    return template || null;
  }

  /**
   * 获取租户的所有模板
   * @param tenantId 租户 ID
   * @param activeOnly 是否只返回激活的模板
   * @param limit 限制返回数量
   * @param offset 偏移量
   * @returns 模板列表
   */
  async findByTenantId(
    tenantId: string,
    activeOnly = false,
    limit = 100,
    offset = 0,
  ): Promise<AgentTemplate[]> {
    const conditions = activeOnly
      ? { tenantId, isActive: true }
      : { tenantId };

    const templates = await db.query.agentTemplates.findMany({
      where: (table, { eq, and }) =>
        activeOnly
          ? and(eq(table.tenantId, tenantId), eq(table.isActive, true))
          : eq(table.tenantId, tenantId),
      limit,
      offset,
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
    return templates;
  }

  /**
   * 获取所有模板
   * @param limit 限制返回数量
   * @param offset 偏移量
   * @returns 模板列表
   */
  async findAll(limit = 100, offset = 0): Promise<AgentTemplate[]> {
    const allTemplates = await db.query.agentTemplates.findMany({
      limit,
      offset,
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
    return allTemplates;
  }

  /**
   * 更新模板
   * @param id 模板 ID
   * @param data 更新数据
   * @returns 更新后的模板信息，如果模板不存在则返回 null
   */
  async update(
    id: string,
    data: Partial<Omit<NewAgentTemplate, 'id' | 'tenantId'>>,
  ): Promise<AgentTemplate | null> {
    const [updatedTemplate] = await db
      .update(agentTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentTemplates.id, id))
      .returning();
    return updatedTemplate || null;
  }

  /**
   * 删除模板
   * @param id 模板 ID
   * @returns 是否删除成功
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(agentTemplates).where(eq(agentTemplates.id, id)).returning();
    return result.length > 0;
  }

  /**
   * 激活/停用模板
   * @param id 模板 ID
   * @param isActive 是否激活
   * @returns 更新后的模板信息，如果模板不存在则返回 null
   */
  async setActive(id: string, isActive: boolean): Promise<AgentTemplate | null> {
    return this.update(id, { isActive });
  }

  /**
   * 增加模板版本
   * @param id 模板 ID
   * @returns 更新后的模板信息，如果模板不存在则返回 null
   */
  async incrementVersion(id: string): Promise<AgentTemplate | null> {
    const template = await this.findById(id);
    if (!template) return null;

    return this.update(id, { version: (template.version ?? 1) + 1 });
  }

  /**
   * 检查模板是否存在
   * @param id 模板 ID
   * @returns 是否存在
   */
  async exists(id: string): Promise<boolean> {
    const template = await this.findById(id);
    return template !== null;
  }

  /**
   * 检查模板是否属于指定租户
   * @param id 模板 ID
   * @param tenantId 租户 ID
   * @returns 是否属于该租户
   */
  async belongsToTenant(id: string, tenantId: string): Promise<boolean> {
    const template = await this.findById(id);
    return template !== null && template.tenantId === tenantId;
  }

  /**
   * 获取 Agent 统计数据
   * @param id 模板 ID
   * @returns 统计信息
   */
  async getStats(id: string): Promise<{
    mtdCost: number;
    budgetLimit: number;
    thirtyDaySessions: number;
    avgLatency: number;
    activeSessions: number;
  } | null> {
    const template = await this.findById(id);
    if (!template) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // MTD cost from billing_records
    const costResult = await db
      .select({ total: sum(billingRecords.costCents) })
      .from(billingRecords)
      .innerJoin(sessions, eq(billingRecords.sessionId, sessions.id))
      .where(and(
        eq(sessions.templateId, id),
        gte(billingRecords.createdAt, monthStart),
      ));

    const mtdCost = (Number(costResult[0]?.total) || 0) / 100; // cents to dollars

    // 30-day sessions count
    const sessionStats = await db
      .select({
        total: count(sessions.id),
        active: count(sql`CASE WHEN ${sessions.status} IN ('active', 'running') THEN 1 END`),
      })
      .from(sessions)
      .where(and(
        eq(sessions.templateId, id),
        gte(sessions.createdAt, thirtyDaysAgo),
      ));

    return {
      mtdCost: Math.round(mtdCost * 100) / 100,
      budgetLimit: 500, // Default budget, can be made configurable later
      thirtyDaySessions: sessionStats[0]?.total || 0,
      avgLatency: 450, // Mock — to be collected from actual request metrics
      activeSessions: sessionStats[0]?.active || 0,
    };
  }
}

/**
 * 导出单例实例
 */
export const agentTemplateService = new AgentTemplateService();
