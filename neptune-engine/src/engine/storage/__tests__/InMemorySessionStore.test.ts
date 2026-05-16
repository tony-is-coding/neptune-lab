import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {InMemorySessionStore} from '../InMemorySessionStore'
import {Session} from '../../Session'
import type {SessionSnapshot} from '../../Session'

describe('InMemorySessionStore', () => {
	let store: InMemorySessionStore

	beforeEach(() => {
		store = new InMemorySessionStore()
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

		test('save - 覆盖已存在的 Session', async () => {
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
			expect(sessions.map(s => s.sessionId)).toContain('session-1')
			expect(sessions.map(s => s.sessionId)).toContain('session-2')
		})

		test('list - 空存储返回空数组', async () => {
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

	describe('dispose 操作', () => {
		test('dispose 清空所有存储', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))
			await store.dispose()

			const sessions = await store.list()
			expect(sessions).toHaveLength(0)
		})

		test('dispose 后可以重新使用', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {},
			}

			await store.save(Session.restore(snapshot))
			await store.dispose()

			// dispose 后应该可以重新保存
			await store.save(Session.restore(snapshot))
			const loaded = await store.load('session-1')
			expect(loaded).not.toBeNull()
		})
	})

	describe('并发操作', () => {
		test('并发保存多个 Session', async () => {
			const promises = []
			for (let i = 0; i < 100; i++) {
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
			expect(sessions).toHaveLength(100)
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

	describe('引用语义', () => {
		test('保存的是 Session 对象的引用', async () => {
			const snapshot: SessionSnapshot = {
				sessionId: 'session-1',
				workspace: '/workspace',
				createdAt: Date.now(),
				status: 'active',
				metadata: {counter: 0},
			}

			const session = Session.restore(snapshot)
			await store.save(session)

			// 修改原对象
			session.setMetadata('counter', 1)

			const loaded = await store.load('session-1')
			// 因为是引用，所以应该看到修改后的值
			expect(loaded?.getMetadata('counter')).toBe(1)
		})
	})
})
