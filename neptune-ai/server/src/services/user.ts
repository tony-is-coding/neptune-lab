import { db, users, type NewUser, type User } from '../db';
import { eq } from 'drizzle-orm';

/**
 * 用户服务类
 * 负责用户的 CRUD 操作
 */
export class UserService {
  /**
   * 创建用户
   * @param user 用户数据
   * @returns 创建的用户
   */
  async create(user: NewUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  /**
   * 根据 ID 获取用户
   * @param id 用户 ID
   * @returns 用户信息，如果不存在则返回 null
   */
  async findById(id: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    return user || null;
  }

  /**
   * 根据邮箱获取用户
   * @param email 用户邮箱
   * @returns 用户信息，如果不存在则返回 null
   */
  async findByEmail(email: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    return user || null;
  }

  /**
   * 获取租户的所有用户
   * @param tenantId 租户 ID
   * @param limit 限制返回数量
   * @param offset 偏移量
   * @returns 用户列表
   */
  async findByTenantId(tenantId: string, limit = 100, offset = 0): Promise<User[]> {
    const tenantUsers = await db.query.users.findMany({
      where: eq(users.tenantId, tenantId),
      limit,
      offset,
    });
    return tenantUsers;
  }

  /**
   * 获取所有用户
   * @param limit 限制返回数量
   * @param offset 偏移量
   * @returns 用户列表
   */
  async findAll(limit = 100, offset = 0): Promise<User[]> {
    const allUsers = await db.query.users.findMany({
      limit,
      offset,
    });
    return allUsers;
  }

  /**
   * 更新用户
   * @param id 用户 ID
   * @param data 更新数据
   * @returns 更新后的用户信息，如果用户不存在则返回 null
   */
  async update(id: string, data: Partial<Omit<NewUser, 'id' | 'tenantId'>>): Promise<User | null> {
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updatedUser || null;
  }

  /**
   * 删除用户
   * @param id 用户 ID
   * @returns 是否删除成功
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  /**
   * 检查用户是否存在
   * @param id 用户 ID
   * @returns 是否存在
   */
  async exists(id: string): Promise<boolean> {
    const user = await this.findById(id);
    return user !== null;
  }

  /**
   * 检查邮箱是否已被使用
   * @param email 邮箱地址
   * @param excludeId 排除的用户 ID（用于更新时检查）
   * @returns 是否已被使用
   */
  async isEmailTaken(email: string, excludeId?: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    if (!user) return false;
    if (excludeId && user.id === excludeId) return false;
    return true;
  }
}

/**
 * 导出单例实例
 */
export const userService = new UserService();
