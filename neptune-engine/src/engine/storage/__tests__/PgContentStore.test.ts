import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { PgContentStore } from '../PgContentStore'
import postgres from 'postgres'

/**
 * PgContentStore 测试
 *
 * 测试环境变量：
 * - TEST_PG_HOST: PostgreSQL 主机（默认 localhost）
 * - TEST_PG_PORT: PostgreSQL 端口（默认 5432）
 * - TEST_PG_USER: PostgreSQL 用户（默认 postgres）
 * - TEST_PG_PASSWORD: PostgreSQL 密码（默认 postgres）
 * - TEST_PG_DATABASE: PostgreSQL 数据库（默认 claude_test）
 *
 * 运行测试前需要创建测试数据库：
 * ```sql
 * CREATE DATABASE claude_test;
 * ```
 */

describe('PgContentStore', () => {
  const getConfig = () => ({
    host: process.env.TEST_PG_HOST ?? 'localhost',
    port: parseInt(process.env.TEST_PG_PORT ?? '5432'),
    user: process.env.TEST_PG_USER ?? 'postgres',
    password: process.env.TEST_PG_PASSWORD ?? 'postgres',
    database: process.env.TEST_PG_DATABASE ?? 'claude_test',
  })

  let store: PgContentStore
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
      DROP TABLE IF EXISTS session_contents;
      CREATE TABLE session_contents (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 创建索引提高查询性能
      CREATE INDEX idx_session_contents_session_id ON session_contents(session_id);
      CREATE INDEX idx_session_contents_timestamp ON session_contents(timestamp DESC);
    `)

    // 创建 PgContentStore 实例
    store = new PgContentStore(config)
  })

  afterEach(async () => {
    // 清理资源
    await store.dispose()
    await sqlClient.unsafe('DROP TABLE IF EXISTS session_contents;')
    await sqlClient.end()
  })

  describe('基本操作', () => {
    test('append - 追加单条内容', async () => {
      await store.append('session-1', 'Hello, World!')

      const items = await store.read('session-1')
      expect(items).toHaveLength(1)
      expect(items[0]!.content).toBe('Hello, World!')
    })

    test('append - 追加多条内容', async () => {
      await store.append('session-1', 'First message')
      await store.append('session-1', 'Second message')
      await store.append('session-1', 'Third message')

      const items = await store.read('session-1')
      expect(items).toHaveLength(3)
      expect(items[0]!.content).toBe('First message')
      expect(items[1]!.content).toBe('Second message')
      expect(items[2]!.content).toBe('Third message')
    })

    test('append - 带元数据', async () => {
      const metadata = { type: 'user', userId: '123' }
      await store.append('session-1', 'User message', metadata)

      const items = await store.read('session-1')
      expect(items).toHaveLength(1)
      expect(items[0]!.metadata).toEqual(metadata)
    })

    test('append - 不同 Session 的内容隔离', async () => {
      await store.append('session-1', 'Content 1')
      await store.append('session-2', 'Content 2')

      const items1 = await store.read('session-1')
      const items2 = await store.read('session-2')

      expect(items1).toHaveLength(1)
      expect(items2).toHaveLength(1)
      expect(items1[0]!.content).toBe('Content 1')
      expect(items2[0]!.content).toBe('Content 2')
    })
  })

  describe('读取操作', () => {
    test('read - 空内容返回空数组', async () => {
      const items = await store.read('nonexistent')
      expect(items).toHaveLength(0)
    })

    test('read - 使用 from 选项', async () => {
      for (let i = 0; i < 10; i++) {
        await store.append('session-1', `Message ${i}`)
      }

      const items = await store.read('session-1', { from: 5 })
      expect(items).toHaveLength(5)
      expect(items[0]!.content).toBe('Message 5')
    })

    test('read - 使用 to 选项', async () => {
      for (let i = 0; i < 10; i++) {
        await store.append('session-1', `Message ${i}`)
      }

      const items = await store.read('session-1', { to: 5 })
      expect(items).toHaveLength(5)
      expect(items[4]!.content).toBe('Message 4')
    })

    test('read - 使用 from 和 to 选项', async () => {
      for (let i = 0; i < 10; i++) {
        await store.append('session-1', `Message ${i}`)
      }

      const items = await store.read('session-1', { from: 3, to: 7 })
      expect(items).toHaveLength(4)
      expect(items[0]!.content).toBe('Message 3')
      expect(items[3]!.content).toBe('Message 6')
    })

    test('read - 使用 limit 选项', async () => {
      for (let i = 0; i < 10; i++) {
        await store.append('session-1', `Message ${i}`)
      }

      const items = await store.read('session-1', { limit: 5 })
      expect(items).toHaveLength(5)
      expect(items[0]!.content).toBe('Message 0')
    })

    test('read - 组合使用 from 和 limit', async () => {
      for (let i = 0; i < 10; i++) {
        await store.append('session-1', `Message ${i}`)
      }

      const items = await store.read('session-1', { from: 5, limit: 3 })
      expect(items).toHaveLength(3)
      expect(items[0]!.content).toBe('Message 5')
      expect(items[2]!.content).toBe('Message 7')
    })

    test('read - 超出范围的 from 返回空数组', async () => {
      await store.append('session-1', 'Message 0')

      const items = await store.read('session-1', { from: 10 })
      expect(items).toHaveLength(0)
    })

    test('read - 负数 from 视为 0', async () => {
      await store.append('session-1', 'Message 0')

      const items = await store.read('session-1', { from: -5 })
      expect(items).toHaveLength(1)
    })
  })

  describe('截断操作', () => {
    test('truncate - 保留最后 N 条', async () => {
      for (let i = 0; i < 10; i++) {
        await store.append('session-1', `Message ${i}`)
      }

      await store.truncate('session-1', 5)

      const items = await store.read('session-1')
      expect(items).toHaveLength(5)
      expect(items[0]!.content).toBe('Message 5')
      expect(items[4]!.content).toBe('Message 9')
    })

    test('truncate - keepLastN 大于现有条数时不做任何操作', async () => {
      await store.append('session-1', 'Message 0')
      await store.append('session-1', 'Message 1')

      await store.truncate('session-1', 10)

      const items = await store.read('session-1')
      expect(items).toHaveLength(2)
    })

    test('truncate - keepLastN 为 0 时清空所有内容', async () => {
      for (let i = 0; i < 5; i++) {
        await store.append('session-1', `Message ${i}`)
      }

      await store.truncate('session-1', 0)

      const items = await store.read('session-1')
      expect(items).toHaveLength(0)
    })

    test('truncate - 对不存在的 Session 不报错', async () => {
      const result = store.truncate('nonexistent', 5)
      await expect(result).resolves.toBeUndefined()
    })
  })

  describe('计数操作', () => {
    test('count - 空内容返回 0', async () => {
      const count = await store.count('nonexistent')
      expect(count).toBe(0)
    })

    test('count - 返回内容条数', async () => {
      for (let i = 0; i < 7; i++) {
        await store.append('session-1', `Message ${i}`)
      }

      const count = await store.count('session-1')
      expect(count).toBe(7)
    })

    test('count - 不同 Session 的计数独立', async () => {
      for (let i = 0; i < 3; i++) {
        await store.append('session-1', `Message ${i}`)
      }
      for (let i = 0; i < 5; i++) {
        await store.append('session-2', `Message ${i}`)
      }

      const count1 = await store.count('session-1')
      const count2 = await store.count('session-2')

      expect(count1).toBe(3)
      expect(count2).toBe(5)
    })
  })

  describe('清理操作', () => {
    test('clear - 清空指定 Session 的内容', async () => {
      await store.append('session-1', 'Message 0')
      await store.append('session-1', 'Message 1')

      await store.clear('session-1')

      const items = await store.read('session-1')
      expect(items).toHaveLength(0)
    })

    test('clear - 对不存在的 Session 不报错', async () => {
      const result = store.clear('nonexistent')
      await expect(result).resolves.toBeUndefined()
    })
  })

  describe('时间戳', () => {
    test('append - 自动设置时间戳', async () => {
      const before = Date.now()
      await store.append('session-1', 'Message')
      const after = Date.now()

      const items = await store.read('session-1')
      expect(items).toHaveLength(1)
      expect(items[0]!.timestamp).toBeGreaterThanOrEqual(before)
      expect(items[0]!.timestamp).toBeLessThanOrEqual(after)
    })

    test('append - 多条内容时间戳递增', async () => {
      await store.append('session-1', 'Message 0')
      await new Promise(resolve => setTimeout(resolve, 10))
      await store.append('session-1', 'Message 1')

      const items = await store.read('session-1')
      expect(items).toHaveLength(2)
      expect(items[1]!.timestamp).toBeGreaterThan(items[0]!.timestamp)
    })
  })

  describe('并发操作', () => {
    test('并发追加', async () => {
      const promises = []
      for (let i = 0; i < 50; i++) {
        promises.push(store.append('session-1', `Message ${i}`))
      }
      await Promise.all(promises)

      const count = await store.count('session-1')
      expect(count).toBe(50)
    })

    test('并发读取', async () => {
      for (let i = 0; i < 10; i++) {
        await store.append('session-1', `Message ${i}`)
      }

      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(store.read('session-1'))
      }
      const results = await Promise.all(promises)

      expect(results.every(r => r.length === 10)).toBe(true)
    })
  })

  describe('持久化', () => {
    test('dispose 后数据仍然存在于数据库', async () => {
      await store.append('session-1', 'Message 0')
      await store.dispose()

      // 创建新的 store 实例，数据应该仍然存在
      const newStore = new PgContentStore(getConfig())
      const items = await newStore.read('session-1')
      expect(items).toHaveLength(1)
      expect(items[0]!.content).toBe('Message 0')

      await newStore.dispose()
    })
  })

  describe('边界条件', () => {
    test('空内容字符串', async () => {
      await store.append('session-1', '')

      const items = await store.read('session-1')
      expect(items).toHaveLength(1)
      expect(items[0]!.content).toBe('')
    })

    test('特殊字符内容', async () => {
      const specialContent = 'Special chars: \n\r\t\\"\'\\'
      await store.append('session-1', specialContent)

      const items = await store.read('session-1')
      expect(items).toHaveLength(1)
      expect(items[0]!.content).toBe(specialContent)
    })

    test('长内容', async () => {
      const longContent = 'A'.repeat(10000)
      await store.append('session-1', longContent)

      const items = await store.read('session-1')
      expect(items).toHaveLength(1)
      expect(items[0]!.content).toBe(longContent)
    })

    test('null 和 undefined metadata', async () => {
      await store.append('session-1', 'Message 1', null as unknown as Record<string, unknown>)
      await store.append('session-1', 'Message 2', undefined)

      const items = await store.read('session-1')
      expect(items).toHaveLength(2)
    })
  })
})
