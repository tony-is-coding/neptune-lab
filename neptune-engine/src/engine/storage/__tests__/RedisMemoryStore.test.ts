import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {RedisMemoryStore} from '../RedisMemoryStore'
import Redis from 'ioredis'

/**
 * RedisMemoryStore 测试
 *
 * 测试环境变量：
 * - TEST_REDIS_HOST: Redis 主机（默认 localhost）
 * - TEST_REDIS_PORT: Redis 端口（默认 6379）
 * - TEST_REDIS_PASSWORD: Redis 密码（默认空）
 * - TEST_REDIS_DB: Redis 数据库编号（默认 1，避免与开发环境冲突）
 *
 * 运行测试前需要确保 Redis 服务正在运行：
 * ```bash
 * redis-server
 * ```
 */

describe('RedisMemoryStore', () => {
	const getConfig = () => ({
		host: process.env.TEST_REDIS_HOST ?? 'localhost',
		port: parseInt(process.env.TEST_REDIS_PORT ?? '6379'),
		password: process.env.TEST_REDIS_PASSWORD ?? undefined,
		db: parseInt(process.env.TEST_REDIS_DB ?? '1'),
	})

	let store: RedisMemoryStore
	let redis: Redis

	beforeEach(async () => {
		const config = getConfig()

		// 创建 Redis 客户端用于清理
		redis = new Redis({
			host: config.host,
			port: config.port,
			password: config.password,
			db: config.db,
		})

		// 清空测试数据库
		await redis.flushdb()

		// 创建 RedisMemoryStore 实例
		store = new RedisMemoryStore(config)
	})

	afterEach(async () => {
		// 清理资源
		await store.dispose()
		await redis.flushdb()
		await redis.quit()
	})

	describe('基本 CRUD 操作', () => {
		test('save 和 load - 保存和加载记忆', async () => {
			await store.save('user-1', 'key1', 'value1')

			const value = await store.load('user-1', 'key1')
			expect(value).toBe('value1')
		})

		test('load - 不存在的键返回 undefined', async () => {
			const value = await store.load('user-1', 'nonexistent')
			expect(value).toBeUndefined()
		})

		test('save - 覆盖已存在的值', async () => {
			await store.save('user-1', 'key1', 'value1')
			await store.save('user-1', 'key1', 'value2')

			const value = await store.load('user-1', 'key1')
			expect(value).toBe('value2')
		})

		test('delete - 删除存在的键', async () => {
			await store.save('user-1', 'key1', 'value1')
			await store.delete('user-1', 'key1')

			const value = await store.load('user-1', 'key1')
			expect(value).toBeUndefined()
		})

		test('delete - 删除不存在的键不报错', async () => {
			const result = store.delete('user-1', 'nonexistent')
			await expect(result).resolves.toBeUndefined()
		})

		test('list - 返回所有键值对', async () => {
			await store.save('user-1', 'key1', 'value1')
			await store.save('user-1', 'key2', 'value2')
			await store.save('user-1', 'key3', 'value3')

			const items = await store.list('user-1')
			expect(items).toHaveLength(3)

			const keyValueMap = new Map(items.map(item => [item.key, item.value]))
			expect(keyValueMap.get('key1')).toBe('value1')
			expect(keyValueMap.get('key2')).toBe('value2')
			expect(keyValueMap.get('key3')).toBe('value3')
		})

		test('list - 空用户返回空数组', async () => {
			const items = await store.list('user-1')
			expect(items).toHaveLength(0)
		})
	})

	describe('用户隔离', () => {
		test('不同用户的数据隔离', async () => {
			await store.save('user-1', 'key1', 'value1')
			await store.save('user-2', 'key1', 'value2')

			const value1 = await store.load('user-1', 'key1')
			const value2 = await store.load('user-2', 'key1')

			expect(value1).toBe('value1')
			expect(value2).toBe('value2')
		})

		test('delete 只影响指定用户', async () => {
			await store.save('user-1', 'key1', 'value1')
			await store.save('user-2', 'key1', 'value2')

			await store.delete('user-1', 'key1')

			const value1 = await store.load('user-1', 'key1')
			const value2 = await store.load('user-2', 'key1')

			expect(value1).toBeUndefined()
			expect(value2).toBe('value2')
		})

		test('clear 只清理指定用户', async () => {
			await store.save('user-1', 'key1', 'value1')
			await store.save('user-1', 'key2', 'value2')
			await store.save('user-2', 'key1', 'value3')

			await store.clear('user-1')

			const items1 = await store.list('user-1')
			const items2 = await store.list('user-2')

			expect(items1).toHaveLength(0)
			expect(items2).toHaveLength(1)
		})
	})

	describe('前缀过滤', () => {
		test('list - 使用前缀过滤', async () => {
			await store.save('user-1', 'pref:key1', 'value1')
			await store.save('user-1', 'pref:key2', 'value2')
			await store.save('user-1', 'other:key3', 'value3')

			const items = await store.list('user-1', 'pref:')
			expect(items).toHaveLength(2)

			const keys = items.map(item => item.key)
			expect(keys).toContain('pref:key1')
			expect(keys).toContain('pref:key2')
			expect(keys).not.toContain('other:key3')
		})

		test('list - 空前缀返回所有', async () => {
			await store.save('user-1', 'key1', 'value1')
			await store.save('user-1', 'key2', 'value2')

			const items1 = await store.list('user-1', '')
			const items2 = await store.list('user-1')

			expect(items1).toHaveLength(2)
			expect(items2).toHaveLength(2)
		})

		test('list - 不存在的前缀返回空数组', async () => {
			await store.save('user-1', 'key1', 'value1')

			const items = await store.list('user-1', 'nonexistent:')
			expect(items).toHaveLength(0)
		})
	})

	describe('数据类型', () => {
		test('保存和加载字符串', async () => {
			await store.save('user-1', 'str', 'hello')
			const value = await store.load('user-1', 'str')
			expect(value).toBe('hello')
		})

		test('保存和加载数字', async () => {
			await store.save('user-1', 'num', 42)
			const value = await store.load('user-1', 'num')
			expect(value).toBe(42)
		})

		test('保存和加载布尔值', async () => {
			await store.save('user-1', 'bool', true)
			const value = await store.load('user-1', 'bool')
			expect(value).toBe(true)
		})

		test('保存和加载对象', async () => {
			const obj = {nested: {value: 123}, arr: [1, 2, 3]}
			await store.save('user-1', 'obj', obj)
			const value = await store.load('user-1', 'obj')
			expect(value).toEqual(obj)
		})

		test('保存和加载数组', async () => {
			const arr = ['a', 'b', 'c']
			await store.save('user-1', 'arr', arr)
			const value = await store.load('user-1', 'arr')
			expect(value).toEqual(arr)
		})

		test('保存和加载 null', async () => {
			await store.save('user-1', 'null', null)
			const value = await store.load('user-1', 'null')
			expect(value).toBeNull()
		})
	})

	describe('清理操作', () => {
		test('clear - 清空指定用户的所有数据', async () => {
			await store.save('user-1', 'key1', 'value1')
			await store.save('user-1', 'key2', 'value2')
			await store.save('user-2', 'key1', 'value3')

			await store.clear('user-1')

			const items1 = await store.list('user-1')
			const items2 = await store.list('user-2')

			expect(items1).toHaveLength(0)
			expect(items2).toHaveLength(1)
		})

		test('clear - 对不存在的用户不报错', async () => {
			const result = store.clear('nonexistent')
			await expect(result).resolves.toBeUndefined()
		})
	})

	describe('持久化', () => {
		test('dispose 后数据仍然存在于 Redis', async () => {
			await store.save('user-1', 'key1', 'value1')
			await store.dispose()

			// 创建新的 store 实例，数据应该仍然存在
			const newStore = new RedisMemoryStore(getConfig())
			const value = await newStore.load('user-1', 'key1')
			expect(value).toBe('value1')

			await newStore.dispose()
		})
	})

	describe('并发操作', () => {
		test('并发保存', async () => {
			const promises = []
			for (let i = 0; i < 50; i++) {
				promises.push(store.save('user-1', `key${i}`, `value${i}`))
			}
			await Promise.all(promises)

			const items = await store.list('user-1')
			expect(items).toHaveLength(50)
		})

		test('并发读取', async () => {
			await store.save('user-1', 'key1', 'value1')

			const promises = []
			for (let i = 0; i < 10; i++) {
				promises.push(store.load('user-1', 'key1'))
			}
			const results = await Promise.all(promises)

			expect(results.every(r => r === 'value1')).toBe(true)
		})
	})

	describe('边界条件', () => {
		test('特殊字符的键', async () => {
			const specialKeys = [
				'key-with-dashes',
				'key_with_underscores',
				'key.with.dots',
				'key:with:colons',
				'key/with/slashes',
			]

			for (const key of specialKeys) {
				await store.save('user-1', key, `value-${key}`)
			}

			for (const key of specialKeys) {
				const value = await store.load('user-1', key)
				expect(value).toBe(`value-${key}`)
			}
		})

		test('空字符串键和值', async () => {
			await store.save('user-1', '', 'empty-key')
			await store.save('user-1', 'empty-value', '')

			expect(await store.load('user-1', '')).toBe('empty-key')
			expect(await store.load('user-1', 'empty-value')).toBe('')
		})

		test('长值', async () => {
			const longValue = 'A'.repeat(10000)
			await store.save('user-1', 'long', longValue)

			const value = await store.load('user-1', 'long')
			expect(value).toBe(longValue)
		})

		test('Unicode 内容', async () => {
			const unicodeValue = '你好世界 🌍🌎🌏'
			await store.save('user-1', 'unicode', unicodeValue)

			const value = await store.load('user-1', 'unicode')
			expect(value).toBe(unicodeValue)
		})
	})

	describe('键过期', () => {
		test('TTL 过期机制（如果实现）', async () => {
			// 这个测试是可选的，取决于是否实现 TTL 功能
			await store.save('user-1', 'key1', 'value1')

			// 等待一小段时间
			await new Promise(resolve => setTimeout(resolve, 100))

			// 数据应该仍然存在
			const value = await store.load('user-1', 'key1')
			expect(value).toBe('value1')
		})
	})
})
