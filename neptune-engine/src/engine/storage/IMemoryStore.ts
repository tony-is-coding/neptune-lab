/**
 * IMemoryStore — 记忆存储接口
 *
 * 定义按用户隔离的记忆存储抽象。
 * 支持多种实现：内存、文件系统、数据库等。
 *
 * 设计原则：
 * - 按 userId 隔离数据
 * - 支持键值对 CRUD 操作
 * - 支持前缀过滤查询
 * - 异步接口，支持多种存储后端
 */

/**
 * 记忆存储接口
 *
 * 提供按用户隔离的记忆存储功能。
 */
export interface IMemoryStore {
  /**
   * 保存记忆
   *
   * @param userId 用户 ID
   * @param key 键
   * @param value 值（必须是 JSON 可序列化的）
   */
  save(userId: string, key: string, value: unknown): Promise<void>

  /**
   * 加载记忆
   *
   * @param userId 用户 ID
   * @param key 键
   * @returns 值，不存在返回 undefined
   */
  load(userId: string, key: string): Promise<unknown | undefined>

  /**
   * 删除记忆
   *
   * @param userId 用户 ID
   * @param key 键
   */
  delete(userId: string, key: string): Promise<void>

  /**
   * 列出记忆
   *
   * @param userId 用户 ID
   * @param prefix 可选的前缀过滤
   * @returns 键值对数组
   */
  list(userId: string, prefix?: string): Promise<Array<{ key: string; value: unknown }>>

  /**
   * 清理指定用户的所有记忆
   *
   * @param userId 用户 ID
   */
  clear(userId: string): Promise<void>

  /**
   * 释放存储资源
   */
  dispose(): Promise<void>
}
