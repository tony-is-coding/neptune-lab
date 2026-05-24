import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {Session} from '@neptune/engine/Session.js'
import type {SessionSnapshot} from '@neptune/engine/Session.js'
import type {ISessionStore} from '@neptune/engine/storage/ISessionStore.js'
import type {ProviderConfig} from '@neptune/engine/types.js'
import {LogUtil} from '@neptune/engine/log/LogUtil.js'

/**
 * PostgreSQL 连接配置
 */
export interface PgSessionStoreConfig {
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
interface SessionRow {
	session_id: string
	workspace: string
	created_at: number
	status: 'active' | 'paused' | 'destroyed'
	metadata: Record<string, unknown>
	system_prompt?: string
	provider_config?: Record<string, unknown>
}

/**
 * 基于 PostgreSQL + drizzle-orm 的 Session 持久化存储
 *
 * 特性：
 * - 使用 drizzle-orm + postgres 驱动
 * - 连接池管理
 * - JSONB 存储 metadata 和 provider_config
 * - 自动初始化表结构
 * - UPSERT 语义（save 即 upsert）
 */
export class PgSessionStore implements ISessionStore {
	private db: ReturnType<typeof drizzle>
	private client: postgres.Sql<Record<string, never>>
	private _closed = false
	private _initPromise: Promise<void> | null = null

	constructor(config: PgSessionStoreConfig) {
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

		// 创建 drizzle 实例
		this.db = drizzle(this.client)

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
				// 后续操作会自然失败并给出更具体的错误信息
				LogUtil.warn('PgSessionStore 初始化失败，操作可能会失败', {error: String(error)})
				this._initPromise = null
			}
		}
	}

	/**
	 * 初始化数据库表
	 * 使用原生 SQL 执行建表，避免依赖 drizzle schema
	 *
	 * 使用 CREATE TABLE IF NOT EXISTS 和 CREATE INDEX IF NOT EXISTS 确保幂等性
	 * 即使多次调用也不会报错
	 */
	private async initTable(): Promise<void> {
		try {
			await this.client.unsafe(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          workspace TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'destroyed')),
          metadata JSONB NOT NULL DEFAULT '{}',
          system_prompt TEXT,
          provider_config JSONB
        );

        -- 创建索引提高查询性能（IF NOT EXISTS 确保幂等）
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
      `)
			LogUtil.info('PgSessionStore 表初始化完成')
		} catch (error) {
			LogUtil.error('PgSessionStore 表初始化失败', {error: String(error)})
			// 不抛出错误，允许连接建立后重试
		}
	}

	async save(session: Session): Promise<void> {
		if (this._closed) {
			throw new Error('PgSessionStore 已关闭，无法执行操作')
		}

		// 确保表已初始化
		await this.ensureInitialized()

		const snap = session.toSnapshot()

		try {
			// 处理 systemPrompt：如果是函数则序列化为特殊标记，否则直接存储
			let systemPromptValue: string | null = null
			if (snap.systemPrompt !== undefined) {
				if (typeof snap.systemPrompt === 'function') {
					// 函数类型无法持久化，存储特殊标记
					systemPromptValue = '__function__'
				} else {
					systemPromptValue = snap.systemPrompt
				}
			}

			// 使用 INSERT ... ON CONFLICT DO UPDATE 实现 UPSERT
			await this.client.unsafe(
				`
        INSERT INTO sessions (session_id, workspace, created_at, status, metadata, system_prompt, provider_config)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (session_id)
        DO UPDATE SET
          workspace = EXCLUDED.workspace,
          created_at = EXCLUDED.created_at,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          system_prompt = EXCLUDED.system_prompt,
          provider_config = EXCLUDED.provider_config
        `,
				[
					snap.sessionId,
					snap.workspace,
					snap.createdAt,
					snap.status,
					JSON.stringify(snap.metadata),
					systemPromptValue,
					snap.providerConfig ? JSON.stringify(snap.providerConfig) : null,
				]
			)
		} catch (error) {
			LogUtil.error('PgSessionStore.save 失败', {sessionId: snap.sessionId, error: String(error)})
			throw error
		}
	}

	async load(sessionId: string): Promise<Session | null> {
		if (this._closed) {
			throw new Error('PgSessionStore 已关闭，无法执行操作')
		}

		// 确保表已初始化
		await this.ensureInitialized()

		try {
			const rows = await this.client.unsafe<SessionRow[]>(
				'SELECT session_id, workspace, created_at, status, metadata, system_prompt, provider_config FROM sessions WHERE session_id = $1',
				[sessionId]
			)

			if (rows.length === 0) {
				return null
			}

			return this.rowToSession(rows[0]!)
		} catch (error) {
			LogUtil.error('PgSessionStore.load 失败', {sessionId, error: String(error)})
			throw error
		}
	}

	async delete(sessionId: string): Promise<void> {
		if (this._closed) {
			throw new Error('PgSessionStore 已关闭，无法执行操作')
		}

		// 确保表已初始化
		await this.ensureInitialized()

		try {
			await this.client.unsafe('DELETE FROM sessions WHERE session_id = $1', [sessionId])
		} catch (error) {
			LogUtil.error('PgSessionStore.delete 失败', {sessionId, error: String(error)})
			throw error
		}
	}

	async list(): Promise<Session[]> {
		if (this._closed) {
			throw new Error('PgSessionStore 已关闭，无法执行操作')
		}

		// 确保表已初始化
		await this.ensureInitialized()

		try {
			const rows = await this.client.unsafe<SessionRow[]>(
				'SELECT session_id, workspace, created_at, status, metadata, system_prompt, provider_config FROM sessions ORDER BY created_at DESC'
			)

			return rows.map(row => this.rowToSession(row))
		} catch (error) {
			LogUtil.error('PgSessionStore.list 失败', {error: String(error)})
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

	/**
	 * 将数据库行转换为 Session 对象
	 */
	private rowToSession(row: SessionRow): Session {
		// 处理 systemPrompt：如果是特殊标记则返回函数
		let systemPrompt: string | (() => Promise<string>) | undefined = undefined
		if (row.system_prompt === '__function__') {
			// 恢复为空函数（实际使用时需要重新设置）
			systemPrompt = async () => ''
		} else if (row.system_prompt) {
			systemPrompt = row.system_prompt
		}

		// 处理 providerConfig：使用双重断言确保类型正确
		let providerConfig: ProviderConfig | undefined = undefined
		if (row.provider_config) {
			providerConfig = row.provider_config as unknown as ProviderConfig
		}

		const snapshot: SessionSnapshot = {
			sessionId: row.session_id,
			workspace: row.workspace,
			createdAt: row.created_at,
			status: row.status,
			metadata: (row.metadata as Record<string, unknown>) ?? {},
			systemPrompt,
			providerConfig,
		}
		return Session.restore(snapshot)
	}
}
