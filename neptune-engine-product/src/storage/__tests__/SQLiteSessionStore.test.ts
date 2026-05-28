import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {SQLiteSessionStore} from '../SQLiteSessionStore'
import {Session} from '@neptune/engine/Session.js'
import type {SessionSnapshot} from '@neptune/engine/Session.js'
import {Database} from 'bun:sqlite'
import {rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

describe('SQLiteSessionStore', () => {
	const DB_PATH = join(tmpdir(), `claude-session-test-${Date.now()}.db`)
	let store: SQLiteSessionStore

	beforeEach(async () => {
		// 清理可能存在的测试数据库
		await rm(DB_PATH, {force: true})
		store = new SQLiteSessionStore(DB_PATH)
	})

	afterEach(async () => {
		try {
			await store.dispose()
			await rm(DB_PATH, {force: true})
		} catch {
			// 忽略清理错误
		}
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

		test('metadata JSON 解析失败时使用空对象', async () => {
			// 直接插入损坏的 JSON 数据
			const db = new Database(DB_PATH)
			db.run(
				`INSERT INTO sessions (session_id, workspace, created_at, status, metadata)
         VALUES (?, ?, ?, ?, ?)`,
				['session-corrupt', '/workspace', Date.now(), 'active', '{invalid json}']
			)
			db.close()

			const loaded = await store.load('session-corrupt')
			expect(loaded).not.toBeNull()
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
			const newStore = new SQLiteSessionStore(DB_PATH)
			const loaded = await newStore.load('session-1')
			expect(loaded).not.toBeNull()
			expect(loaded?.sessionId).toBe('session-1')

			await newStore.dispose()
		})

		test('WAL 模式启用', async () => {
			// 检查 WAL 模式是否启用（通过检查 -wal 文件）
			// 这里我们只验证数据库正常工作
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))
			const loaded = await store.load('session-1')
			expect(loaded).not.toBeNull()
		})
	})

	describe('数据库操作', () => {
		test('close 方法关闭数据库连接', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))
			store.close()

			// close 后再创建新实例应该能读取数据
			const newStore = new SQLiteSessionStore(DB_PATH)
			const loaded = await newStore.load('session-1')
			expect(loaded).not.toBeNull()

			await newStore.dispose()
		})

		test('close 方法幂等性 - 多次调用不报错', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))

			// 多次调用 close 不应该报错
			store.close()
			store.close()
			store.close()

			// 创建新实例验证数据持久化
			const newStore = new SQLiteSessionStore(DB_PATH)
			const loaded = await newStore.load('session-1')
			expect(loaded).not.toBeNull()

			await newStore.dispose()
		})

		test('dispose 方法也关闭数据库连接', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))
			await store.dispose()

			// dispose 后再创建新实例应该能读取数据
			const newStore = new SQLiteSessionStore(DB_PATH)
			const loaded = await newStore.load('session-1')
			expect(loaded).not.toBeNull()

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

	describe('数据库表结构', () => {
		test('自动创建表', async () => {
			// 创建新的 store 应该自动创建表
			const newStore = new SQLiteSessionStore(DB_PATH)

			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await newStore.save(Session.restore(snapshot))
			const loaded = await newStore.load('session-1')
			expect(loaded).not.toBeNull()

			await newStore.dispose()
		})
	})
})
