import type { IBackend } from './IBackend.js'
import { EngineError, EngineErrorCode } from '../errors.js'

/**
 * 基于 Map 的内存存储后端
 * 进程退出后数据丢失，适用于测试和短生命周期场景
 *
 * @template T 存储的值类型
 */
export class InMemoryBackend<T> implements IBackend<T> {
  private readonly store: Map<string, T> = new Map()
  private disposed = false

  async read(key: string): Promise<T | null> {
    this.ensureNotDisposed()
    return this.store.get(key) ?? null
  }

  async write(key: string, value: T): Promise<void> {
    this.ensureNotDisposed()
    this.store.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.ensureNotDisposed()
    this.store.delete(key)
  }

  async list(prefix?: string): Promise<T[]> {
    this.ensureNotDisposed()

    if (!prefix) {
      return Array.from(this.store.values())
    }

    // 过滤出以 prefix 开头的 key
    const filteredValues: T[] = []
    for (const [key, value] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        filteredValues.push(value)
      }
    }
    return filteredValues
  }

  async dispose(): Promise<void> {
    this.disposed = true
    this.store.clear()
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new EngineError(EngineErrorCode.SESSION_INVALID_OPERATION, 'InMemoryBackend has been disposed')
    }
  }

  /**
   * 获取内部存储的大小（用于测试）
   */
  get size(): number {
    return this.store.size
  }

  /**
   * 检查某个 key 是否存在（用于测试）
   */
  has(key: string): boolean {
    return this.store.has(key)
  }
}
