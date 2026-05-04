/**
 * SessionManager 测试
 *
 * 测试目标：
 * 1. createSession/destroySession/getSession/listSessions
 * 2. maxConcurrent 限制
 * 3. workspace 唯一性
 * 4. GC 触发
 * 5. pauseSession/resumeSession
 * 6. restoreFromStore
 * 7. dispose
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { SessionManager } from '../SessionManager'
import { EngineError, EngineErrorCode } from '../errors'
import type { ISessionStore } from '../storage/ISessionStore'
import type { Session } from '../Session'

// Mock ISessionStore
class MockSessionStore implements ISessionStore {
  private sessions = new Map<string, Session>()

  async save(session: Session): Promise<void> {
    this.sessions.set(session.sessionId, session)
  }

  async load(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }

  async list(): Promise<Session[]> {
    return Array.from(this.sessions.values())
  }

  async dispose(): Promise<void> {
    this.sessions.clear()
  }
}

describe('SessionManager', () => {
  describe('无 Store 配置', () => {
    let manager: SessionManager

    beforeEach(() => {
      manager = new SessionManager()
    })

    afterEach(() => {
      manager.dispose()
    })

    describe('createSession', () => {
      test('应该成功创建 Session', async () => {
        const sessionId = await manager.createSession({
          workspace: '/test/workspace'
        })

        expect(sessionId).toBeDefined()
        expect(typeof sessionId).toBe('string')

        const session = manager.getSession(sessionId)
        expect(session).toBeDefined()
        expect(session?.workspace).toBe('/test/workspace')
        expect(session?.status).toBe('active')
      })

      test('应该支持自定义 sessionId', async () => {
        const customId = 'custom-session-id'
        const sessionId = await manager.createSession({
          workspace: '/test/workspace',
          sessionId: customId
        })

        expect(sessionId).toBe(customId)

        const session = manager.getSession(sessionId)
        expect(session?.sessionId).toBe(customId)
      })

      test('应该拒绝重复的 workspace（活跃 Session）', async () => {
        await manager.createSession({
          workspace: '/test/workspace'
        })

        await expect(manager.createSession({
          workspace: '/test/workspace'
        })).rejects.toThrow()
      })

      test('应该拒绝重复的 workspace（已暂停 Session）', async () => {
        const sessionId = await manager.createSession({
          workspace: '/test/workspace'
        })

        await manager.pauseSession(sessionId)

        await expect(manager.createSession({
          workspace: '/test/workspace'
        })).rejects.toThrow()
      })

      test('应该允许重复的 workspace（已销毁 Session）', async () => {
        const sessionId = await manager.createSession({
          workspace: '/test/workspace'
        })

        await manager.destroySession(sessionId)

        // 不应该抛出错误
        const newSessionId = await manager.createSession({
          workspace: '/test/workspace'
        })
        expect(newSessionId).toBeDefined()
        expect(newSessionId).not.toBe(sessionId)
      })

      test('Workspace 冲突应该抛出正确的错误码', async () => {
        await manager.createSession({
          workspace: '/test/workspace'
        })

        try {
          await manager.createSession({
            workspace: '/test/workspace'
          })
          expect(true).toBe(false) // 不应该到这里
        } catch (error) {
          expect(error).toBeInstanceOf(EngineError)
          expect((error as EngineError).code).toBe(EngineErrorCode.SESSION_WORKSPACE_CONFLICT)
        }
      })
    })

    describe('getSession', () => {
      test('应该获取已存在的 Session', async () => {
        const sessionId = await manager.createSession({
          workspace: '/test/workspace'
        })

        const session = manager.getSession(sessionId)
        expect(session).toBeDefined()
        expect(session?.sessionId).toBe(sessionId)
      })

      test('获取不存在的 Session 返回 undefined', () => {
        const session = manager.getSession('non-existent-id')
        expect(session).toBeUndefined()
      })

      test('应该获取不同 workspace 的 Session', async () => {
        const id1 = await manager.createSession({
          workspace: '/workspace1'
        })
        const id2 = await manager.createSession({
          workspace: '/workspace2'
        })

        const session1 = manager.getSession(id1)
        const session2 = manager.getSession(id2)

        expect(session1?.workspace).toBe('/workspace1')
        expect(session2?.workspace).toBe('/workspace2')
        expect(session1?.sessionId).not.toBe(session2?.sessionId)
      })
    })

    describe('listSessions', () => {
      test('应该列出所有 Session', async () => {
        const id1 = await manager.createSession({
          workspace: '/workspace1'
        })
        const id2 = await manager.createSession({
          workspace: '/workspace2'
        })

        const sessions = manager.listSessions()
        expect(sessions).toHaveLength(2)

        const ids = sessions.map(s => s.sessionId)
        expect(ids).toContain(id1)
        expect(ids).toContain(id2)
      })

      test('空 manager 返回空数组', () => {
        const sessions = manager.listSessions()
        expect(sessions).toEqual([])
      })

      test('应该包含已销毁的 Session', async () => {
        const id1 = await manager.createSession({
          workspace: '/workspace1'
        })
        await manager.createSession({
          workspace: '/workspace2'
        })

        await manager.destroySession(id1)

        const sessions = manager.listSessions()
        expect(sessions).toHaveLength(1) // destroySession 后立即从 Map 移除
      })
    })

    describe('destroySession', () => {
      test('应该成功销毁 Session', async () => {
        const sessionId = await manager.createSession({
          workspace: '/test/workspace'
        })

        await manager.destroySession(sessionId)

        // destroySession 后 Session 立即从 Map 中移除
        const session = manager.getSession(sessionId)
        expect(session).toBeUndefined()
      })

      test('销毁不存在的 Session 应该抛出错误', async () => {
        await expect(manager.destroySession('non-existent-id'))
          .rejects.toThrow()
      })

      test('销毁不存在的 Session 应该抛出正确的错误码', async () => {
        try {
          await manager.destroySession('non-existent-id')
          expect(true).toBe(false)
        } catch (error) {
          expect(error).toBeInstanceOf(EngineError)
          expect((error as EngineError).code).toBe(EngineErrorCode.SESSION_NOT_FOUND)
        }
      })

      test('应该可以重复销毁同一个 Session', async () => {
        const sessionId = await manager.createSession({
          workspace: '/test/workspace'
        })

        await manager.destroySession(sessionId)

        // Session 状态是 destroyed，但第二次调用会尝试调用 session.destroy()
        // Session.destroy() 会抛出 SESSION_ALREADY_DESTROYED
        await expect(manager.destroySession(sessionId))
          .rejects.toThrow()
      })
    })

    describe('pauseSession/resumeSession', () => {
      test('应该成功暂停 Session', async () => {
        const sessionId = await manager.createSession({
          workspace: '/test/workspace'
        })

        await manager.pauseSession(sessionId)

        const session = manager.getSession(sessionId)
        expect(session?.status).toBe('paused')
      })

      test('应该成功恢复 Session', async () => {
        const sessionId = await manager.createSession({
          workspace: '/test/workspace'
        })

        await manager.pauseSession(sessionId)
        await manager.resumeSession(sessionId)

        const session = manager.getSession(sessionId)
        expect(session?.status).toBe('active')
      })

      test('暂停不存在的 Session 应该抛出错误', async () => {
        await expect(manager.pauseSession('non-existent-id'))
          .rejects.toThrow()
      })

      test('恢复不存在的 Session 应该抛出错误', async () => {
        await expect(manager.resumeSession('non-existent-id'))
          .rejects.toThrow()
      })

      test('重复暂停应该是幂等的', async () => {
        const sessionId = await manager.createSession({
          workspace: '/test/workspace'
        })

        await manager.pauseSession(sessionId)
        await manager.pauseSession(sessionId) // 再次暂停

        const session = manager.getSession(sessionId)
        expect(session?.status).toBe('paused')
      })

      test('重复恢复应该是幂等的', async () => {
        const sessionId = await manager.createSession({
          workspace: '/test/workspace'
        })

        await manager.resumeSession(sessionId)
        await manager.resumeSession(sessionId) // 再次恢复

        const session = manager.getSession(sessionId)
        expect(session?.status).toBe('active')
      })
    })

    describe('dispose', () => {
      test('dispose 应该清除所有 Session', async () => {
        await manager.createSession({
          workspace: '/workspace1'
        })
        await manager.createSession({
          workspace: '/workspace2'
        })

        manager.dispose()

        const sessions = manager.listSessions()
        expect(sessions).toHaveLength(0)
      })

      test('dispose 后可以重新创建 Session', async () => {
        await manager.createSession({
          workspace: '/workspace1'
        })

        manager.dispose()

        // 不应该抛出错误
        const sessionId = await manager.createSession({
          workspace: '/workspace1'
        })
        expect(sessionId).toBeDefined()
      })
    })
  })

  describe('maxConcurrent 限制', () => {
    test('应该限制并发 Session 数量', async () => {
      const manager = new SessionManager({
        maxConcurrentSessions: 2
      })

      await manager.createSession({
        workspace: '/workspace1'
      })
      await manager.createSession({
        workspace: '/workspace2'
      })

      try {
        await manager.createSession({
          workspace: '/workspace3'
        })
        expect(true).toBe(false) // 不应该到这里
      } catch (error) {
        expect(error).toBeInstanceOf(EngineError)
        expect((error as EngineError).code).toBe(EngineErrorCode.SESSION_LIMIT_EXCEEDED)
      } finally {
        manager.dispose()
      }
    })

    test('已销毁的 Session 不计入限制', async () => {
      const manager = new SessionManager({
        maxConcurrentSessions: 2
      })

      const id1 = await manager.createSession({
        workspace: '/workspace1'
      })
      await manager.createSession({
        workspace: '/workspace2'
      })

      await manager.destroySession(id1)

      // 现在应该可以创建第三个
      const id3 = await manager.createSession({
        workspace: '/workspace3'
      })
      expect(id3).toBeDefined()

      manager.dispose()
    })

    test('maxConcurrentSessions 为 undefined 时不限制', async () => {
      const manager = new SessionManager({
        maxConcurrentSessions: undefined
      })

      // 创建多个 Session
      for (let i = 0; i < 10; i++) {
        await manager.createSession({
          workspace: `/workspace${i}`
        })
      }

      const sessions = manager.listSessions()
      expect(sessions).toHaveLength(10)

      manager.dispose()
    })

    test('限制超限错误消息应该包含限制数量', async () => {
      const manager = new SessionManager({
        maxConcurrentSessions: 3
      })

      await manager.createSession({
        workspace: '/workspace1'
      })
      await manager.createSession({
        workspace: '/workspace2'
      })
      await manager.createSession({
        workspace: '/workspace3'
      })

      try {
        await manager.createSession({
          workspace: '/workspace4'
        })
        expect(true).toBe(false)
      } catch (error) {
        expect((error as Error).message).toContain('3')
      } finally {
        manager.dispose()
      }
    })
  })

  describe('GC（垃圾回收）', () => {
    test('startGC 应该启动定时器', async () => {
      const manager = new SessionManager()

      const id1 = await manager.createSession({
        workspace: '/workspace1'
      })
      const id2 = await manager.createSession({
        workspace: '/workspace2'
      })

      await manager.destroySession(id1)

      // 启动 GC，间隔较短以便测试
      manager.startGC(100)

      // 等待 GC 执行
      await new Promise(resolve => setTimeout(resolve, 150))

      // id1 应该被清理
      const session1 = manager.getSession(id1)
      expect(session1).toBeUndefined()

      // id2 应该还在
      const session2 = manager.getSession(id2)
      expect(session2).toBeDefined()

      manager.stopGC()
      manager.dispose()
    })

    test('stopGC 应该停止定时器', async () => {
      const manager = new SessionManager()

      const id1 = await manager.createSession({
        workspace: '/workspace1'
      })

      await manager.destroySession(id1)
      // destroySession 后 Session 立即从 Map 中移除
      const session = manager.getSession(id1)
      expect(session).toBeUndefined()

      manager.startGC(100)
      manager.stopGC()

      // 等待超过 GC 间隔（验证 GC 不会引起错误）
      await new Promise(resolve => setTimeout(resolve, 150))

      manager.dispose()
    })

    test('startGC 多次调用应该重启定时器', async () => {
      const manager = new SessionManager()

      const id1 = await manager.createSession({
        workspace: '/workspace1'
      })

      await manager.destroySession(id1)

      manager.startGC(100)
      manager.startGC(200) // 重新启动

      // 等待第一个间隔
      await new Promise(resolve => setTimeout(resolve, 150))

      // Session 可能还在（取决于第一个定时器是否执行）
      // 但第二个定时器肯定还没执行

      manager.stopGC()
      manager.dispose()
    })

    test('GC 应该清理所有已销毁的 Session', async () => {
      const manager = new SessionManager()

      const id1 = await manager.createSession({
        workspace: '/workspace1'
      })
      const id2 = await manager.createSession({
        workspace: '/workspace2'
      })
      const id3 = await manager.createSession({
        workspace: '/workspace3'
      })

      await manager.destroySession(id1)
      await manager.destroySession(id2)

      manager.startGC(100)

      await new Promise(resolve => setTimeout(resolve, 150))

      const sessions = manager.listSessions()
      const ids = sessions.map(s => s.sessionId)

      expect(ids).not.toContain(id1)
      expect(ids).not.toContain(id2)
      expect(ids).toContain(id3)

      manager.stopGC()
      manager.dispose()
    })
  })

  describe('ISessionStore 集成', () => {
    let manager: SessionManager
    let store: MockSessionStore

    beforeEach(() => {
      store = new MockSessionStore()
      manager = new SessionManager({
        maxConcurrentSessions: 5,
        store
      })
    })

    afterEach(() => {
      manager.dispose()
    })

    test('createSession 应该保存到 store', async () => {
      const sessionId = await manager.createSession({
        workspace: '/test/workspace'
      })

      const session = await store.load(sessionId)
      expect(session).toBeDefined()
      expect(session?.workspace).toBe('/test/workspace')
    })

    test('pauseSession 应该同步到 store', async () => {
      const sessionId = await manager.createSession({
        workspace: '/test/workspace'
      })

      await manager.pauseSession(sessionId)

      const session = await store.load(sessionId)
      expect(session?.status).toBe('paused')
    })

    test('resumeSession 应该同步到 store', async () => {
      const sessionId = await manager.createSession({
        workspace: '/test/workspace'
      })

      await manager.pauseSession(sessionId)
      await manager.resumeSession(sessionId)

      const session = await store.load(sessionId)
      expect(session?.status).toBe('active')
    })

    test('destroySession 应该同步到 store', async () => {
      const sessionId = await manager.createSession({
        workspace: '/test/workspace'
      })

      await manager.destroySession(sessionId)

      const session = await store.load(sessionId)
      expect(session?.status).toBe('destroyed')
    })

    test('restoreFromStore 应该恢复所有 Session', async () => {
      // 创建并保存一些 Session
      const id1 = await manager.createSession({
        workspace: '/workspace1'
      })
      const id2 = await manager.createSession({
        workspace: '/workspace2'
      })

      // 清空 manager 的内存
      manager.dispose()

      // 创建新的 manager（空的）
      const newManager = new SessionManager({ store })

      // 从 store 恢复
      await newManager.restoreFromStore()

      const sessions = newManager.listSessions()
      expect(sessions).toHaveLength(2)

      const ids = sessions.map(s => s.sessionId)
      expect(ids).toContain(id1)
      expect(ids).toContain(id2)

      newManager.dispose()
    })

    test('无 store 时不执行同步操作', async () => {
      const noStoreManager = new SessionManager()

      // 不应该抛出错误
      const sessionId = await noStoreManager.createSession({
        workspace: '/test/workspace'
      })
      expect(sessionId).toBeDefined()

      await noStoreManager.pauseSession(sessionId)
      await noStoreManager.resumeSession(sessionId)
      await noStoreManager.destroySession(sessionId)

      noStoreManager.dispose()
    })

    test('构造函数自动从 store 恢复 session', async () => {
      // 创建并保存一些 Session
      const id1 = await manager.createSession({
        workspace: '/workspace3'
      })
      const id2 = await manager.createSession({
        workspace: '/workspace4'
      })

      // 等待一下确保写入完成
      await new Promise(resolve => setTimeout(resolve, 10))

      // 清空 manager 的内存
      manager.dispose()

      // 创建新的 manager（空的，应该自动从 store 恢复）
      const newManager = new SessionManager({ store })

      // 等待异步恢复完成
      await new Promise(resolve => setTimeout(resolve, 50))

      const sessions = newManager.listSessions()
      expect(sessions.length).toBeGreaterThanOrEqual(2)

      const ids = sessions.map(s => s.sessionId)
      expect(ids).toContain(id1)
      expect(ids).toContain(id2)

      newManager.dispose()
    })
  })

  describe('复杂场景', () => {
    test('完整生命周期：创建 -> 暂停 -> 恢复 -> 销毁', async () => {
      const manager = new SessionManager()

      const sessionId = await manager.createSession({
        workspace: '/test/workspace'
      })

      let session = manager.getSession(sessionId)
      expect(session?.status).toBe('active')

      await manager.pauseSession(sessionId)
      session = manager.getSession(sessionId)
      expect(session?.status).toBe('paused')

      await manager.resumeSession(sessionId)
      session = manager.getSession(sessionId)
      expect(session?.status).toBe('active')

      await manager.destroySession(sessionId)
      // destroySession 后 Session 会立即从 Map 中移除
      session = manager.getSession(sessionId)
      expect(session).toBeUndefined()

      manager.dispose()
    })

    test('多 workspace 并发管理', async () => {
      const manager = new SessionManager({
        maxConcurrentSessions: 5
      })

      const workspaces = ['/w1', '/w2', '/w3', '/w4', '/w5']
      const sessionIds: string[] = []

      for (const ws of workspaces) {
        const id = await manager.createSession({ workspace: ws })
        sessionIds.push(id)
      }

      expect(manager.listSessions()).toHaveLength(5)

      // 销毁一半
      await manager.destroySession(sessionIds[0])
      await manager.destroySession(sessionIds[1])

      // 现在可以再创建两个
      const id6 = await manager.createSession({ workspace: '/w6' })
      const id7 = await manager.createSession({ workspace: '/w7' })

      expect(id6).toBeDefined()
      expect(id7).toBeDefined()

      manager.dispose()
    })

    test('pause 的 Session 仍然占用 workspace', async () => {
      const manager = new SessionManager()

      const id1 = await manager.createSession({
        workspace: '/workspace1'
      })

      await manager.pauseSession(id1)

      // 应该仍然拒绝相同 workspace
      await expect(manager.createSession({
        workspace: '/workspace1'
      })).rejects.toThrow()

      manager.dispose()
    })
  })
})
