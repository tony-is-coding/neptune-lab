import { db, tenants, type NewTenant, type Tenant } from '../db';
import { eq } from 'drizzle-orm';

/**
 * 租户服务类
 * 负责租户的 CRUD 操作
 */
export class TenantService {
  /**
   * 创建租户
   * @param tenant 租户数据
   * @returns 创建的租户
   */
  async create(tenant: Omit<NewTenant, 'id'>): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    return newTenant;
  }

  /**
   * 根据 ID 获取租户
   * @param id 租户 ID
   * @returns 租户信息，如果不存在则返回 null
   */
  async findById(id: string): Promise<Tenant | null> {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, id),
    });
    return tenant || null;
  }

  /**
   * 获取所有租户
   * @param limit 限制返回数量
   * @param offset 偏移量
   * @returns 租户列表
   */
  async findAll(limit = 100, offset = 0): Promise<Tenant[]> {
    const allTenants = await db.query.tenants.findMany({
      limit,
      offset,
    });
    return allTenants;
  }

  /**
   * 更新租户
   * @param id 租户 ID
   * @param data 更新数据
   * @returns 更新后的租户信息，如果租户不存在则返回 null
   */
  async update(id: string, data: Partial<Omit<NewTenant, 'id'>>): Promise<Tenant | null> {
    const [updatedTenant] = await db
      .update(tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updatedTenant || null;
  }

  /**
   * 删除租户
   * @param id 租户 ID
   * @returns 是否删除成功
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(tenants).where(eq(tenants.id, id)).returning();
    return result.length > 0;
  }

  /**
   * 检查租户是否存在
   * @param id 租户 ID
   * @returns 是否存在
   */
  async exists(id: string): Promise<boolean> {
    const tenant = await this.findById(id);
    return tenant !== null;
  }
}

/**
 * 导出单例实例
 */
export const tenantService = new TenantService();
