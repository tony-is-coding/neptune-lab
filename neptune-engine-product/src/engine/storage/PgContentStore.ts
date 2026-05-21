import postgres from 'postgres'
import type {ISessionContentStore, ReadOptions, SessionContentItem} from './ISessionContentStore'
import {LogUtil} from '../log/LogUtil.js'

/**
 * PostgreSQL 连接配置
 */
export interface PgContentStoreConfig {
	/** PostgreSQL 主机地址 */
	host: string
	/** PostgreSQL 端口 */
	port: number
	/** PostgreSQL 用户名 */
	user: string
	/** PostgreSQL 密码 */
	password: string
	/** PostgreSQL 数据库名 */
	database: string
	/** 连接池最大连接数（默认 10） */
	max?: number
	/** 是否启用 SSL（默认 false） */
	ssl?: boolean
}

/**
 * 数据库行类型定义
 */
interface ContentRow {
	id: number
	session_id: string
	content: string
	timestamp: number
	metadata: Record<string, unknown> | null
}

/**
 * 基于 PostgreSQL 的 Session 内容存储实现
 *
 * 特性：
 * - 使用 postgres 驱动（轻量级，无 ORM 依赖）
 * - 连接池管理
 * - JSONB 存储 metadata
 * - 自动初始化表结构
 * - 支持追加、读取、截断、计数、清理操作
 */
export class PgContentStore implements ISessionContentStore {
	private client: postgres.Sql<Record<string, never>>
	private _closed = false
	private _initPromise: Promise<void> | null = null

	constructor(config: PgContentStoreConfig) {
		// 创建 postgres 连接
		this.client = postgres({
			host: config.host,
			port: config.port,
			user: config.user,
			password: config.password,
			database: config.database,
			max: config.max ?? 10,
			ssl: config.ssl,
		})

		// 启动初始化，但不等待
		this._initPromise = this.initTable()
	}

	/**
	 * 确保表已初始化
	 * 每个操作前调用，确保表结构存在
	 */
	private async ensureInitialized(): Promise<void> {
		if (this._initPromise) {
			try {
				await this._initPromise
				this._initPromise = null // 初始化完成后清除引用
			} catch (error) {
				// 初始化失败，记录错误但不阻塞操作
				LogUtil.warn('PgContentStore 初始化失败，操作可能会失败', {error: String(error)})
				this._initPromise = null
			}
		}
	}

	/**
	 * 初始化数据库表
	 * 使用 CREATE TABLE IF NOT EXISTS 和 CREATE INDEX IF NOT EXISTS 确保幂等性
	 */
	private async initTable(): Promise<void> {
		try {
			await this.client.unsafe(`
        CREATE TABLE IF NOT EXISTS session_contents (
          id SERIAL PRIMARY KEY,
          session_id TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          metadata JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- 创建索引提高查询性能（IF NOT EXISTS 确保幂等）
        CREATE INDEX IF NOT EXISTS idx_session_contents_session_id ON session_contents(session_id);
        CREATE INDEX IF NOT EXISTS idx_session_contents_timestamp ON session_contents(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_session_contents_session_timestamp ON session_contents(session_id, timestamp);
      `)
			LogUtil.info('PgContentStore 表初始化完成')
		} catch (error) {
			LogUtil.error('PgContentStore 表初始化失败', {error: String(error)})
			// 不抛出错误，允许连接建立后重试
		}
	}

	async append(sessionId: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
		if (this._closed) {
			throw new Error('PgContentStore 已关闭，无法执行操作')
		}

		// 确保表已初始化
		await this.ensureInitialized()

		try {
			// 将 metadata 转换为 JSON 字符串或 null
			const metadataValue = metadata ? JSON.stringify(metadata) : null
			await this.client.unsafe(
				'INSERT INTO session_contents (session_id, content, timestamp, metadata) VALUES ($1, $2, $3, $4)',
				[sessionId, content, Date.now(), metadataValue]
			)
		} catch (error) {
			LogUtil.error('PgContentStore.append 失败', {sessionId, error: String(error)})
			throw error
		}
	}

	async read(sessionId: string, options?: ReadOptions): Promise<SessionContentItem[]> {
		if (this._closed) {
			throw new Error('PgContentStore 已关闭，无法执行操作')
		}

		// 确保表已初始化
		await this.ensureInitialized()

		try {
			// 构建查询
			let sql = 'SELECT content, timestamp, metadata FROM session_contents WHERE session_id = $1 ORDER BY id'
			const params: (string | number)[] = [sessionId]

			// 添加 from 选项
			const from = options?.from ?? 0
			if (from > 0) {
				sql += ' OFFSET $2'
				params.push(from)
			}

			// 添加 limit 选项
			if (options?.limit !== undefined) {
				const paramIndex = params.length + 1
				sql += ` LIMIT $${paramIndex}`
				params.push(options.limit)
			} else if (options?.to !== undefined) {
				// 如果指定了 to，计算 limit
				const limit = options.to - from
				if (limit > 0) {
					const paramIndex = params.length + 1
					sql += ` LIMIT $${paramIndex}`
					params.push(limit)
				}
			}

			const rows = await this.client.unsafe<ContentRow[]>(sql, params)

			// 如果有 to 选项，在前端截断（因为 OFFSET 是跳过，不是结束位置）
			let result = rows.map(row => ({
				content: row.content,
				timestamp: row.timestamp,
				metadata: row.metadata ?? undefined,
			}))

			// 应用 to 选项（前端截断）
			if (options?.to !== undefined) {
				const limit = options.to - from
				if (limit >= 0 && limit < result.length) {
					result = result.slice(0, limit)
				}
			}

			return result
		} catch (error) {
			LogUtil.error('PgContentStore.read 失败', {sessionId, error: String(error)})
			throw error
		}
	}

	async truncate(sessionId: string, keepLastN: number): Promise<void> {
		if (this._closed) {
			throw new Error('PgContentStore 已关闭，无法执行操作')
		}

		// 确保表已初始化
		await this.ensureInitialized()

		try {
			if (keepLastN <= 0) {
				// 清空所有内容
				await this.client.unsafe('DELETE FROM session_contents WHERE session_id = $1', [sessionId])
			} else {
				// 保留最后 N 条，删除其他
				// 使用子查询找到要保留的 ID，然后删除不在这个列表中的记录
				await this.client.unsafe(
					`
          DELETE FROM session_contents
          WHERE session_id = $1
          AND id NOT IN (
            SELECT id FROM session_contents
            WHERE session_id = $1
            ORDER BY id DESC
            LIMIT $2
          )
          `,
					[sessionId, keepLastN]
				)
			}
		} catch (error) {
			LogUtil.error('PgContentStore.truncate 失败', {sessionId, keepLastN, error: String(error)})
			throw error
		}
	}

	async count(sessionId: string): Promise<number> {
		if (this._closed) {
			throw new Error('PgContentStore 已关闭，无法执行操作')
		}

		// 确保表已初始化
		await this.ensureInitialized()

		try {
			const result = await this.client.unsafe<{ count: bigint }[]>(
				'SELECT COUNT(*) as count FROM session_contents WHERE session_id = $1',
				[sessionId]
			)
			return Number(result[0]!.count)
		} catch (error) {
			LogUtil.error('PgContentStore.count 失败', {sessionId, error: String(error)})
			throw error
		}
	}

	async clear(sessionId: string): Promise<void> {
		if (this._closed) {
			throw new Error('PgContentStore 已关闭，无法执行操作')
		}

		// 确保表已初始化
		await this.ensureInitialized()

		try {
			await this.client.unsafe('DELETE FROM session_contents WHERE session_id = $1', [sessionId])
		} catch (error) {
			LogUtil.error('PgContentStore.clear 失败', {sessionId, error: String(error)})
			throw error
		}
	}

	/**
	 * 关闭数据库连接（同步方法）
	 */
	close(): void {
		if (this._closed) return
		this._closed = true
		this.client.end()
	}

	/**
	 * 释放资源（异步方法）
	 */
	async dispose(): Promise<void> {
		this.close()
	}
}
