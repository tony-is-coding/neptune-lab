import { Session } from './Session'
import type { SessionConfig, SessionManagerConfig } from './types'
import type { ISessionStore } from './storage/ISessionStore'
import { EngineError, EngineErrorCode } from './errors'
import { TokenBudgetManager } from './session/TokenBudgetManager'
import { LogUtil } from './log/LogUtil.js'

/**
 * SessionManager — Session 注册表和管理器
 *
 * 负责创建、获取、列出、暂停、恢复、销毁 Session。
 * 支持：
 * - 并发限制：控制同时活跃的 Session 数量
 * - workspace 唯一性：同一 workspace 只能有一个活跃 Session
 * - 持久化：通过 ISessionStore 将 Session 状态持久化（write-through 模式）
 * - 启动恢复：构造时自动从 store 恢复已有 session
 *
 * @example
 * ```typescript
 * const manager = new SessionManager({
 *   maxConcurrentSessions: 10,
 *   store: new FilesystemBackend('./sessions')
 * })
 *
 * const sessionId = await manager.createSession({
 *   workspace: '/path/to/project'
 * })
 * ```
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map()
  private maxConcurrentSessions: number | undefined
  private store: ISessionStore | undefined
  private gcTimer?: ReturnType<typeof setInterval>
  private tokenBudgetManager: TokenBudgetManager
  /** 标记 store 是否可用（写入失败后降级为纯内存模式） */
  private storeAvailable = true

  constructor(config?: SessionManagerConfig & { store?: ISessionStore }) {
    this.maxConcurrentSessions = config?.maxConcurrentSessions
    this.store = config?.store
    this.tokenBudgetManager = new TokenBudgetManager()

    // 启动时自动从 store 恢复已有 session
    this.restoreFromStore().catch((error) => {
      LogUtil.warn('SessionManager: 从 store 恢复 session 失败', { error: String(error) })
    })
  }

  // 创建 Session，支持外部指定 sessionId，返回 sessionId
  async createSession(config: SessionConfig & { sessionId?: string }): Promise<string> {
    // workspace 唯一性检查（仅检查未销毁的 Session）
    for (const session of this.sessions.values()) {
      if (session.workspace === config.workspace && session.status !== 'destroyed') {
        throw new EngineError(EngineErrorCode.SESSION_WORKSPACE_CONFLICT, `Workspace '${config.workspace}' is already in use`)
      }
    }

    // 并发限制检查（未销毁的 Session 计入名额）
    if (this.maxConcurrentSessions !== undefined) {
      const activeCount = this.getUndestoyedCount()
      if (activeCount >= this.maxConcurrentSessions) {
        throw new EngineError(EngineErrorCode.SESSION_LIMIT_EXCEEDED, `Maximum concurrent session limit reached (${this.maxConcurrentSessions})`)
      }
    }

    const session = new Session(config, config.sessionId)

    // Write-through: 先写 store，成功后再写内存 Map
    if (this.store && this.storeAvailable) {
      try {
        await this.store.save(session)
      } catch (error) {
        LogUtil.warn('SessionManager: store.save() 失败，降级为纯内存模式', {
          sessionId: session.sessionId,
          error: String(error),
        })
        this.storeAvailable = false
      }
    }

    this.sessions.set(session.sessionId, session)
    return session.sessionId
  }

  // 通过 sessionId 获取 Session
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)
  }

  // 列出所有 Session
  listSessions(): Session[] {
    return Array.from(this.sessions.values())
  }

  // 暂停 Session
  async pauseSession(sessionId: string): Promise<void> {
    const session = this.getSessionOrThrow(sessionId)
    session.pause()
    await this.syncToStore(session)
  }

  // 恢复 Session
  async resumeSession(sessionId: string): Promise<void> {
    const session = this.getSessionOrThrow(sessionId)
    session.resume()
    await this.syncToStore(session)
  }

  // 销毁 Session
  async destroySession(sessionId: string): Promise<void> {
    const session = this.getSessionOrThrow(sessionId)
    session.destroy()

    // 先将 destroyed 状态同步到 store（如果可用）
    // 注意：这里只更新状态，不删除记录，以便测试可以验证状态
    if (this.store && this.storeAvailable) {
      try {
        await this.store.save(session)
      } catch (error) {
        LogUtil.warn('SessionManager: store.save() 失败', {
          sessionId,
          error: String(error),
        })
      }
    }

    // 立即从 Map 中移除，避免内存泄漏
    this.sessions.delete(sessionId)
  }

  // 从 Store 恢复所有 Session（模拟重启后恢复）
  async restoreFromStore(): Promise<void> {
    if (!this.store) return

    try {
      const sessions = await this.store.list()
      for (const session of sessions) {
        // 只恢复未销毁的 session
        if (session.status !== 'destroyed') {
          this.sessions.set(session.sessionId, session)
        }
      }
      LogUtil.debug('SessionManager: 从 store 恢复 session 完成', {
        count: this.sessions.size,
      })
    } catch (error) {
      LogUtil.warn('SessionManager: 从 store 恢复 session 失败', {
        error: String(error),
      })
    }
  }

  // 同步 Session 到 Store（如果已注入且可用）
  private async syncToStore(session: Session): Promise<void> {
    if (this.store && this.storeAvailable) {
      try {
        await this.store.save(session)
      } catch (error) {
        LogUtil.warn('SessionManager: store.save() 失败，降级为纯内存模式', {
          sessionId: session.sessionId,
          error: String(error),
        })
        this.storeAvailable = false
      }
    }
  }

  // 获取 Session，不存在则抛出错误
  private getSessionOrThrow(sessionId: string): Session {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new EngineError(EngineErrorCode.SESSION_NOT_FOUND, `Session '${sessionId}' not found`)
    }
    return session
  }

  // 统计未销毁的 Session 数量
  private getUndestoyedCount(): number {
    let count = 0
    for (const session of this.sessions.values()) {
      if (session.status !== 'destroyed') {
        count++
      }
    }
    return count
  }

  // 启动 GC 定时器，定期清理已销毁的 Session
  startGC(intervalMs = 60000): void {
    this.stopGC()
    this.gcTimer = setInterval(() => {
      for (const [id, session] of this.sessions) {
        if (session.status === 'destroyed') {
          this.sessions.delete(id)
        }
      }
    }, intervalMs)
  }

  // 停止 GC 定时器
  stopGC(): void {
    if (this.gcTimer !== undefined) {
      clearInterval(this.gcTimer)
      this.gcTimer = undefined
    }
  }

  // 释放所有资源
  dispose(): void {
    this.stopGC()
    this.sessions.clear()
    this.tokenBudgetManager.dispose()
  }
}
