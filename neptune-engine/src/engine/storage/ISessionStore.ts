import type { Session } from '../Session'

/**
 * Session 持久化存储接口
 * 所有方法返回 Promise，支持异步存储后端（PG/Redis 等）
 */
export interface ISessionStore {
  /** 保存 Session（已存在则覆盖） */
  save(session: Session): Promise<void>
  /** 按 sessionId 加载 Session，不存在返回 null */
  load(sessionId: string): Promise<Session | null>
  /** 按 sessionId 删除 Session，不存在不报错 */
  delete(sessionId: string): Promise<void>
  /** 列出所有已保存的 Session */
  list(): Promise<Session[]>
  /** 释放存储资源 */
  dispose(): Promise<void>
}
