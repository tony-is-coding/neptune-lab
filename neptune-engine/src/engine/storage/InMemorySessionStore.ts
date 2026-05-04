import { Session } from '../Session'
import type { ISessionStore } from './ISessionStore'

/**
 * 基于 Map 的内存 Session 存储
 * 进程退出后数据丢失，适用于测试和短生命周期场景
 */
export class InMemorySessionStore implements ISessionStore {
  private store: Map<string, Session> = new Map()

  async save(session: Session): Promise<void> {
    // 直接存引用；InMemory 场景下 save 即 upsert
    this.store.set(session.sessionId, session)
  }

  async load(sessionId: string): Promise<Session | null> {
    return this.store.get(sessionId) ?? null
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId)
  }

  async list(): Promise<Session[]> {
    return Array.from(this.store.values())
  }

  async dispose(): Promise<void> {
    this.store.clear()
  }
}
