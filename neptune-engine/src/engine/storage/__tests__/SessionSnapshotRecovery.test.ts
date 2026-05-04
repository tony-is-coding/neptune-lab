import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { PgSessionStore } from '../PgSessionStore'
import { Session } from '../../Session'
import type { SessionSnapshot } from '../../Session'
import postgres from 'postgres'

/**
 * Session 快照恢复验证测试
 *
 * 验证从数据库恢复的 Session 对象：
 * 1. 所有属性正确恢复
 * 2. 所有方法正常工作
 * 3. 状态转换正常
 * 4. metadata 操作正常
 * 5. systemPrompt 和 providerConfig 正确保存和恢复
 *
 * 测试环境变量：
 * - TEST_PG_HOST: PostgreSQL 主机（默认 localhost）
 * - TEST_PG_PORT: PostgreSQL 端口（默认 5432）
 * - TEST_PG_USER: PostgreSQL 用户（默认 postgres）
 * - TEST_PG_PASSWORD: PostgreSQL 密码（默认 postgres）
 * - TEST_PG_DATABASE: PostgreSQL 数据库（默认 claude_test）
 */

describe('Session 快照恢复验证', () => {
  const getConfig = () => ({
    host: process.env.TEST_PG_HOST ?? 'localhost',
    port: parseInt(process.env.TEST_PG_PORT ?? '5432'),
    user: process.env.TEST_PG_USER ?? 'postgres',
    password: process.env.TEST_PG_PASSWORD ?? 'postgres',
    database: process.env.TEST_PG_DATABASE ?? 'claude_test',
  })

  let store: PgSessionStore
  let sqlClient: postgres.Sql<Record<string, never>>

  beforeEach(async () => {
    const config = getConfig()

    // 创建原始 SQL 客户端用于建表和清理
    sqlClient = postgres({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      max: 1,
    })

    // 创建测试表
    await sqlClient.unsafe(`
      DROP TABLE IF EXISTS sessions;
      CREATE TABLE sessions (
        session_id TEXT PRIMARY KEY,
        workspace TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'destroyed')),
        metadata JSONB NOT NULL DEFAULT '{}',
        system_prompt TEXT,
        provider_config JSONB
      );

      -- 创建索引提高查询性能
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
    `)

    // 创建 PgSessionStore 实例
    store = new PgSessionStore(config)
  })

  afterEach(async () => {
    // 清理资源
    await store.dispose()
    await sqlClient.unsafe('DROP TABLE IF EXISTS sessions;')
    await sqlClient.end()
  })

  describe('基础属性恢复', () => {
    test('恢复所有基础属性', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/test/workspace',
        createdAt: 1234567890,
        status: 'active',
        metadata: {},
      }

      const originalSession = Session.restore(snapshot)
      await store.save(originalSession)

      const restoredSession = await store.load('session-1')
      expect(restoredSession).not.toBeNull()

      // 验证所有只读属性
      expect(restoredSession!.sessionId).toBe('session-1')
      expect(restoredSession!.workspace).toBe('/test/workspace')
      expect(restoredSession!.createdAt).toBe(1234567890)

      // 验证状态
      expect(restoredSession!.status).toBe('active')
    })
  })

  describe('状态转换验证', () => {
    test('恢复 active 状态的 Session 可以正常暂停', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {},
      }

      await store.save(Session.restore(snapshot))
      const restoredSession = await store.load('session-1')
      expect(restoredSession).not.toBeNull()

      // 执行状态转换
      restoredSession!.pause()
      expect(restoredSession!.status).toBe('paused')

      // 保存并重新加载
      await store.save(restoredSession!)
      const reloadedSession = await store.load('session-1')
      expect(reloadedSession!.status).toBe('paused')
    })

    test('恢复 paused 状态的 Session 可以正常恢复', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'paused',
        metadata: {},
      }

      await store.save(Session.restore(snapshot))
      const restoredSession = await store.load('session-1')
      expect(restoredSession).not.toBeNull()

      // 执行状态转换
      restoredSession!.resume()
      expect(restoredSession!.status).toBe('active')
    })

    test('恢复的 Session 可以正常销毁', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {},
      }

      await store.save(Session.restore(snapshot))
      const restoredSession = await store.load('session-1')
      expect(restoredSession).not.toBeNull()

      // 执行销毁
      restoredSession!.destroy()
      expect(restoredSession!.status).toBe('destroyed')

      // 验证销毁后不能再操作
      await expect(() => restoredSession!.pause()).toThrow()
    })
  })

  describe('metadata 操作验证', () => {
    test('恢复的 Session 可以正常操作 metadata', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {
          key1: 'value1',
          key2: 42,
        },
      }

      await store.save(Session.restore(snapshot))
      const restoredSession = await store.load('session-1')
      expect(restoredSession).not.toBeNull()

      // 验证恢复的 metadata
      expect(restoredSession!.getMetadata('key1')).toBe('value1')
      expect(restoredSession!.getMetadata('key2')).toBe(42)

      // 修改 metadata
      restoredSession!.setMetadata('key3', 'value3')
      expect(restoredSession!.getMetadata('key3')).toBe('value3')

      // 获取全部 metadata
      const allMetadata = restoredSession!.getMetadata()
      expect(allMetadata).toEqual({
        key1: 'value1',
        key2: 42,
        key3: 'value3',
      })
    })

    test('恢复的 Session 修改 metadata 后可以持久化', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {},
      }

      await store.save(Session.restore(snapshot))
      let restoredSession = await store.load('session-1')
      expect(restoredSession).not.toBeNull()

      // 修改 metadata
      restoredSession!.setMetadata('newKey', 'newValue')
      await store.save(restoredSession!)

      // 重新加载验证
      restoredSession = await store.load('session-1')
      expect(restoredSession!.getMetadata('newKey')).toBe('newValue')
    })
  })

  describe('systemPrompt 和 providerConfig 恢复', () => {
    test('恢复 systemPrompt', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {},
        systemPrompt: 'Custom system prompt',
      }

      await store.save(Session.restore(snapshot))
      const restoredSession = await store.load('session-1')
      expect(restoredSession).not.toBeNull()

      expect(restoredSession!.getSystemPrompt()).toBe('Custom system prompt')
    })

    test('恢复后可以修改 systemPrompt', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {},
        systemPrompt: 'Original prompt',
      }

      await store.save(Session.restore(snapshot))
      let restoredSession = await store.load('session-1')
      expect(restoredSession).not.toBeNull()

      // 修改 systemPrompt
      restoredSession!.setSystemPrompt('New prompt')
      expect(restoredSession!.getSystemPrompt()).toBe('New prompt')

      // 持久化并重新加载
      await store.save(restoredSession!)
      restoredSession = await store.load('session-1')
      expect(restoredSession!.getSystemPrompt()).toBe('New prompt')
    })

    test('恢复 providerConfig', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {},
        providerConfig: {
          type: 'bedrock',
          config: {
            region: 'us-east-1',
            defaultModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
          },
        },
      }

      await store.save(Session.restore(snapshot))
      const restoredSession = await store.load('session-1')
      expect(restoredSession).not.toBeNull()

      expect(restoredSession!.getProviderConfig()).toEqual(snapshot.providerConfig)
    })

    test('恢复后可以修改 providerConfig', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {},
        providerConfig: {
          type: 'anthropic',
          config: {
            apiKey: 'sk-test',
          },
        },
      }

      await store.save(Session.restore(snapshot))
      let restoredSession = await store.load('session-1')
      expect(restoredSession).not.toBeNull()

      // 修改 providerConfig
      const newConfig = {
        type: 'openai' as const,
        config: {
          apiKey: 'sk-new',
        },
      }
      restoredSession!.setProviderConfig(newConfig)
      expect(restoredSession!.getProviderConfig()).toEqual(newConfig)

      // 持久化并重新加载
      await store.save(restoredSession!)
      restoredSession = await store.load('session-1')
      expect(restoredSession!.getProviderConfig()).toEqual(newConfig)
    })
  })

  describe('复杂场景验证', () => {
    test('完整生命周期：创建 -> 暂停 -> 恢复 -> 销毁', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: { phase: 'initial' },
        systemPrompt: 'Initial prompt',
      }

      // 1. 创建并保存
      await store.save(Session.restore(snapshot))
      let session = await store.load('session-1')
      expect(session!.status).toBe('active')

      // 2. 暂停
      session!.pause()
      session!.setMetadata('phase', 'paused')
      await store.save(session!)
      session = await store.load('session-1')
      expect(session!.status).toBe('paused')
      expect(session!.getMetadata('phase')).toBe('paused')

      // 3. 恢复
      session!.resume()
      session!.setMetadata('phase', 'resumed')
      await store.save(session!)
      session = await store.load('session-1')
      expect(session!.status).toBe('active')
      expect(session!.getMetadata('phase')).toBe('resumed')

      // 4. 销毁
      session!.destroy()
      await store.save(session!)
      session = await store.load('session-1')
      expect(session!.status).toBe('destroyed')
    })

    test('多次保存和恢复的数据一致性', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {},
      }

      await store.save(Session.restore(snapshot))

      // 多次保存和恢复
      for (let i = 0; i < 10; i++) {
        let session = await store.load('session-1')
        session!.setMetadata('iteration', i)
        session!.setMetadata('timestamp', Date.now())
        await store.save(session!)
      }

      // 最终验证
      const finalSession = await store.load('session-1')
      expect(finalSession!.getMetadata('iteration')).toBe(9)
      expect(finalSession!.status).toBe('active')
    })
  })

  describe('边界情况', () => {
    test('恢复空 metadata 的 Session', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {},
      }

      await store.save(Session.restore(snapshot))
      const restoredSession = await store.load('session-1')

      expect(restoredSession!.getMetadata()).toEqual({})
    })

    test('恢复包含特殊字符的 metadata', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {
          'key\nwith\nnewlines': 'value\nwith\nnewlines',
          'key\twith\ttabs': 'value\twith\ttabs',
          'key"with"quotes': 'value"with"quotes',
          '中文键': '中文值',
        },
      }

      await store.save(Session.restore(snapshot))
      const restoredSession = await store.load('session-1')

      expect(restoredSession!.getMetadata()).toEqual(snapshot.metadata)
    })

    test('恢复包含嵌套对象的 metadata', async () => {
      const snapshot: SessionSnapshot = {
        sessionId: 'session-1',
        workspace: '/workspace',
        createdAt: Date.now(),
        status: 'active',
        metadata: {
          level1: {
            level2: {
              level3: {
                value: 'deep',
              },
            },
          },
          array: [1, 2, { nested: 'object' }],
        },
      }

      await store.save(Session.restore(snapshot))
      const restoredSession = await store.load('session-1')

      expect(restoredSession!.getMetadata()).toEqual(snapshot.metadata)
    })
  })
})
