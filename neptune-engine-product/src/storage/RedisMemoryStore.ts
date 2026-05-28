import Redis from 'ioredis'
import type {IMemoryStore} from '@neptune/engine/storage/IMemoryStore.js'
import {LogUtil} from '@neptune/engine/log/LogUtil.js'

/**
 * Redis 连接配置
 */
export interface RedisMemoryStoreConfig {
	/** Redis 主机地址 */
	host: string
	/** Redis 端口 */
	port: number
	/** Redis 密码（可选） */
	password?: string
	/** Redis 数据库编号（默认 0） */
	db?: number
	/** 键前缀（默认 'memory:'） */
	keyPrefix?: string
	/** 连接超时时间（毫秒，默认 5000） */
	connectTimeout?: number
}

/**
 * 基于 Redis 的记忆存储实现
 *
 * 特性：
 * - 使用 ioredis 客户端
 * - 连接池管理
 * - JSON 序列化存储复杂类型
 * - 按用户隔离数据
 * - 支持前缀过滤查询
 * - 自动重连
 */
export class RedisMemoryStore implements IMemoryStore {
	private redis: Redis
	private keyPrefix: string
	private _closed = false

	constructor(config: RedisMemoryStoreConfig) {
		this.keyPrefix = config.keyPrefix ?? 'memory:'

		// 创建 Redis 客户端
		this.redis = new Redis({
			host: config.host,
			port: config.port,
			password: config.password,
			db: config.db ?? 0,
			connectTimeout: config.connectTimeout ?? 5000,
			retryStrategy: (times) => {
				const delay = Math.min(times * 50, 2000)
				return delay
			},
			maxRetriesPerRequest: 3,
		})

		// 监听连接事件
		this.redis.on('connect', () => {
			LogUtil.info('RedisMemoryStore: Redis 连接成功')
		})

		this.redis.on('error', (error) => {
			LogUtil.error('RedisMemoryStore: Redis 错误', {error: String(error)})
		})
	}

	/**
	 * 生成完整的 Redis 键
	 * 格式：{prefix}{userId}:{key}
	 */
	private makeKey(userId: string, key: string): string {
		return `${this.keyPrefix}${userId}:${key}`
	}

	/**
	 * 生成用户前缀键
	 * 格式：{prefix}{userId}:
	 */
	private makeUserPrefix(userId: string): string {
		return `${this.keyPrefix}${userId}:`
	}

	async save(userId: string, key: string, value: unknown): Promise<void> {
		if (this._closed) {
			throw new Error('RedisMemoryStore 已关闭，无法执行操作')
		}

		try {
			const redisKey = this.makeKey(userId, key)
			const serialized = JSON.stringify(value)
			await this.redis.set(redisKey, serialized)
		} catch (error) {
			LogUtil.error('RedisMemoryStore.save 失败', {userId, key, error: String(error)})
			throw error
		}
	}

	async load(userId: string, key: string): Promise<unknown | undefined> {
		if (this._closed) {
			throw new Error('RedisMemoryStore 已关闭，无法执行操作')
		}

		try {
			const redisKey = this.makeKey(userId, key)
			const value = await this.redis.get(redisKey)

			if (value === null) {
				return undefined
			}

			try {
				return JSON.parse(value)
			} catch {
				// 如果解析失败，返回原始字符串
				return value
			}
		} catch (error) {
			LogUtil.error('RedisMemoryStore.load 失败', {userId, key, error: String(error)})
			throw error
		}
	}

	async delete(userId: string, key: string): Promise<void> {
		if (this._closed) {
			throw new Error('RedisMemoryStore 已关闭，无法执行操作')
		}

		try {
			const redisKey = this.makeKey(userId, key)
			await this.redis.del(redisKey)
		} catch (error) {
			LogUtil.error('RedisMemoryStore.delete 失败', {userId, key, error: String(error)})
			throw error
		}
	}

	async list(userId: string, prefix?: string): Promise<Array<{ key: string; value: unknown }>> {
		if (this._closed) {
			throw new Error('RedisMemoryStore 已关闭，无法执行操作')
		}

		try {
			const userPrefix = this.makeUserPrefix(userId)
			const searchPattern = prefix ? `${userPrefix}${prefix}*` : `${userPrefix}*`

			// 使用 SCAN 遍历键（避免阻塞）
			const keys: string[] = []
			let cursor = '0'

			do {
				const [nextCursor, scannedKeys] = await this.redis.scan(
					cursor,
					'MATCH',
					searchPattern,
					'COUNT',
					100
				)
				cursor = nextCursor
				keys.push(...scannedKeys)
			} while (cursor !== '0')

			if (keys.length === 0) {
				return []
			}

			// 批量获取值
			const values = await this.redis.mget(...keys)

			// 构建结果数组
			const result: Array<{ key: string; value: unknown }> = []

			for (const redisKey of keys) {
				const rawValue = values[keys.indexOf(redisKey)]
				if (rawValue === null) {
					continue
				}

				// 去掉前缀，返回原始键名
				const originalKey = redisKey.slice(userPrefix.length)

				try {
					result.push({
						key: originalKey,
						value: JSON.parse(rawValue),
					})
				} catch {
					// 如果解析失败，使用原始值
					result.push({
						key: originalKey,
						value: rawValue,
					})
				}
			}

			return result
		} catch (error) {
			LogUtil.error('RedisMemoryStore.list 失败', {userId, prefix, error: String(error)})
			throw error
		}
	}

	async clear(userId: string): Promise<void> {
		if (this._closed) {
			throw new Error('RedisMemoryStore 已关闭，无法执行操作')
		}

		try {
			const userPrefix = this.makeUserPrefix(userId)
			const keys: string[] = []
			let cursor = '0'

			// 使用 SCAN 找到所有用户相关的键
			do {
				const [nextCursor, scannedKeys] = await this.redis.scan(
					cursor,
					'MATCH',
					`${userPrefix}*`,
					'COUNT',
					100
				)
				cursor = nextCursor
				keys.push(...scannedKeys)
			} while (cursor !== '0')

			// 批量删除
			if (keys.length > 0) {
				await this.redis.del(...keys)
			}
		} catch (error) {
			LogUtil.error('RedisMemoryStore.clear 失败', {userId, error: String(error)})
			throw error
		}
	}

	/**
	 * 关闭 Redis 连接（同步方法）
	 */
	close(): void {
		if (this._closed) return
		this._closed = true
		try {
			this.redis.disconnect()
		} catch (error) {
			LogUtil.error('RedisMemoryStore.close 失败', {error: String(error)})
		}
	}

	/**
	 * 释放资源（异步方法）
	 */
	async dispose(): Promise<void> {
		if (this._closed) return
		this._closed = true

		try {
			await this.redis.quit()
		} catch (error) {
			LogUtil.error('RedisMemoryStore.dispose 失败', {error: String(error)})
			// 如果 quit 失败，尝试断开连接
			this.redis.disconnect()
		}
	}
}
