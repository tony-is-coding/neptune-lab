/**
 * InMemorySessionContentStore — 内存 Session 内容存储实现
 *
 * 基于数组的内存存储，适合单机、短期场景。
 * 数据不持久化，进程重启后丢失。
 */

import type { ISessionContentStore, ReadOptions, SessionContentItem } from './ISessionContentStore.js'

/**
 * 内存 Session 内容存储实现
 *
 * 使用 Map<sessionId, SessionContentItem[]> 结构。
 */
export class InMemorySessionContentStore implements ISessionContentStore {
  private readonly store = new Map<string, SessionContentItem[]>()

  async append(sessionId: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    let items = this.store.get(sessionId)
    if (!items) {
      items = []
      this.store.set(sessionId, items)
    }

    items.push({
      content,
      timestamp: Date.now(),
      metadata,
    })
  }

  async read(sessionId: string, options?: ReadOptions): Promise<SessionContentItem[]> {
    const items = this.store.get(sessionId)
    if (!items) {
      return []
    }

    let result = items

    // 计算起始索引
    let from = options?.from ?? 0
    // 计算结束索引
    let to = options?.to ?? result.length

    // 确保 from 和 to 在有效范围内
    from = Math.max(0, Math.min(from, result.length))
    to = Math.max(from, Math.min(to, result.length))

    // 应用 from 和 to 选项
    result = result.slice(from, to)

    // 应用 limit 选项
    if (options?.limit !== undefined) {
      result = result.slice(0, options.limit)
    }

    return result
  }

  async truncate(sessionId: string, keepLastN: number): Promise<void> {
    const items = this.store.get(sessionId)
    if (!items) {
      return
    }

    if (keepLastN <= 0) {
      // 清空所有内容
      this.store.set(sessionId, [])
    } else if (items.length > keepLastN) {
      const truncated = items.slice(-keepLastN)
      this.store.set(sessionId, truncated)
    }
  }

  async count(sessionId: string): Promise<number> {
    const items = this.store.get(sessionId)
    return items?.length ?? 0
  }

  async clear(sessionId: string): Promise<void> {
    this.store.delete(sessionId)
  }

  async dispose(): Promise<void> {
    this.store.clear()
  }
}
