import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {PgSessionStore} from '../PgSessionStore'
import {Session} from '../../Session'
import type {SessionSnapshot} from '../../Session'
import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {sql} from 'drizzle-orm'

/**
 * PgSessionStore 测试
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

describe('PgSessionStore', () => {
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
        status TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        system_prompt TEXT,
        provider_config JSONB
      );
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

	describe('基本 CRUD 操作', () => {
		test('save 和 load - 保存和加载 Session', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {key: 'value'},
			}

			const session = Session.restore(snapshot)
			await store.save(session)

			const loaded = await store.load('session-1')
			expect(loaded).not.toBeNull()
			expect(loaded?.sessionId).toBe('session-1')
			expect(loaded?.workspace).toBe('/workspace')
			expect(loaded?.status).toBe('active')
		})

		test('load - 不存在的 sessionId 返回 null', async () => {
			const loaded = await store.load('nonexistent')
			expect(loaded).toBeNull()
		})

		test('save - 覆盖已存在的 Session（UPSERT）', async () => {
			const snapshot1: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace1',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			const snapshot2: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace2',
				createdAt: Date.now(),
				status: 'paused',
				metadata: {},
			}

			await store.save(Session.restore(snapshot1))
			await store.save(Session.restore(snapshot2))

			const loaded = await store.load('session-1')
			expect(loaded?.workspace).toBe('/workspace2')
			expect(loaded?.status).toBe('paused')
		})

		test('delete - 删除存在的 Session', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))
			await store.delete('session-1')

			const loaded = await store.load('session-1')
			expect(loaded).toBeNull()
		})

		test('delete - 删除不存在的 Session 不报错', async () => {
			const result = store.delete('nonexistent')
			await expect(result).resolves.toBeUndefined()
		})

		test('list - 返回所有保存的 Session', async () => {
			const snapshot1: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace1',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			const snapshot2: SessionSnapshot = {
				sessionId: 'session-2',
				workspace: '/workspace2',
				createdAt: Date.now(),
				status: 'paused',
				metadata: {},
			}

			await store.save(Session.restore(snapshot1))
			await store.save(Session.restore(snapshot2))

			const sessions = await store.list()
			expect(sessions).toHaveLength(2)
			const sessionIds = sessions.map(s => s.sessionId)
			expect(sessionIds).toContain('session-1')
			expect(sessionIds).toContain('session-2')
		})

		test('list - 空数据库返回空数组', async () => {
			const sessions = await store.list()
			expect(sessions).toHaveLength(0)
		})
	})

	describe('Session 状态变化', () => {
		test('保存不同状态的 Session', async () => {
			const statuses: Array<'active' | 'paused' | 'destroyed'> = ['active', 'paused', 'destroyed']

			for (const status of statuses) {
				const snapshot: SessionSnapshot = {
					sessionId: `session-${status}`,
					workspace: '/workspace',
					createdAt: Date.now(),
					status,
					metadata: {},
				}
				await store.save(Session.restore(snapshot))
			}

			const sessions = await store.list()
			expect(sessions).toHaveLength(3)

			const loadedStatuses = sessions.map(s => s.status).sort()
			expect(loadedStatuses).toEqual(['active', 'destroyed', 'paused'])
		})
	})

	describe('metadata 处理', () => {
		test('保存和加载包含 metadata 的 Session', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {
					stringKey: 'stringValue',
					numberKey: 42,
					booleanKey: true,
					objectKey: {nested: 'value'},
					arrayKey: [1, 2, 3],
				},
			}

			await store.save(Session.restore(snapshot))
			const loaded = await store.load('session-1')

			expect(loaded?.getMetadata()).toEqual(snapshot.metadata)
		})

		test('保存空 metadata', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))
			const loaded = await store.load('session-1')

			expect(loaded?.getMetadata()).toEqual({})
		})
	})

	describe('持久化', () => {
		test('dispose 后数据仍然存在于数据库', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))
			await store.dispose()

			// 创建新的 store 实例，数据应该仍然存在
			const newStore = new PgSessionStore(getConfig())
			const loaded = await newStore.load('session-1')
			expect(loaded).not.toBeNull()
			expect(loaded?.sessionId).toBe('session-1')

			await newStore.dispose()
		})
	})

	describe('并发操作', () => {
		test('并发保存多个 Session', async () => {
			const promises = []
			for (let i = 0; i < 50; i++) {
				const snapshot: SessionSnapshot = {
					sessionId: `session-${i}`,
					workspace: `/workspace-${i}`,
					createdAt: Date.now(),
					status: 'active',
					metadata: {},
				}
				promises.push(store.save(Session.restore(snapshot)))
			}
			await Promise.all(promises)

			const sessions = await store.list()
			expect(sessions).toHaveLength(50)
		})

		test('并发读取同一 Session', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))

			const promises = []
			for (let i = 0; i < 10; i++) {
				promises.push(store.load('session-1'))
			}
			const results = await Promise.all(promises)

			expect(results.every(r => r !== null)).toBe(true)
			expect(results.every(r => r?.sessionId === 'session-1')).toBe(true)
		})
	})

	describe('边界条件', () => {
		test('特殊字符的 sessionId', async () => {
			const specialIds = [
				'session-with-dashes',
				'session_with_underscores',
				'session.with.dots',
				'session:with:colons',
			]

			for (const sessionId of specialIds) {
				const snapshot: SessionSnapshot = {
					sessionId,
					workspace: '/workspace',
					createdAt: Date.now(),
					status: 'active',
					metadata: {},
				}
				await store.save(Session.restore(snapshot))
			}

			for (const sessionId of specialIds) {
				const loaded = await store.load(sessionId)
				expect(loaded).not.toBeNull()
				expect(loaded?.sessionId).toBe(sessionId)
			}
		})

		test('空的 workspace 路径', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))
			const loaded = await store.load('session-1')
			expect(loaded?.workspace).toBe('')
		})

		test('零时间戳', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: 0,
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))
			const loaded = await store.load('session-1')
			expect(loaded?.createdAt).toBe(0)
		})
	})

	describe('扩展字段支持', () => {
		test('保存和加载 systemPrompt', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
				systemPrompt: 'Custom system prompt',
			}

			await store.save(Session.restore(snapshot))
			const loaded = await store.load('session-1')

			expect(loaded?.getSystemPrompt()).toBe('Custom system prompt')
		})

		test('保存和加载 providerConfig', async () => {
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
			const loaded = await store.load('session-1')

			expect(loaded?.getProviderConfig()).toEqual(snapshot.providerConfig)
		})
	})
})
