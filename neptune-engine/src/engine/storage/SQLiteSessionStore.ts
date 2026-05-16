import {Database} from 'bun:sqlite'
import {Session} from '../Session'
import type {SessionSnapshot} from '../Session'
import type {ISessionStore} from './ISessionStore'
import {LogUtil} from '../log/LogUtil.js'

/**
 * 数据库行类型定义
 */
interface SessionRow {
	session_id: string
	workspace: string
	created_at: number
	status: 'active' | 'paused' | 'destroyed'
	metadata: string
}

/**
 * 基于 bun:sqlite 的 Session 持久化存储
 * WAL 模式，自动建表，JSON 序列化 metadata
 */
export class SQLiteSessionStore implements ISessionStore {
	private db: Database
	private _closed = false

	constructor(dbPath: string) {
		this.db = new Database(dbPath, {create: true})
		try {
			this.db.exec('PRAGMA journal_mode=WAL')
		} catch (error) {
			LogUtil.warn('PRAGMA journal_mode=WAL 设置失败，继续使用默认模式', {
				dbPath,
				error: String(error),
			})
		}
		this.initTable()
	}

	private initTable(): void {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        workspace TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      )
    `)
	}

	/**
	 * 非阻塞包装：将同步数据库操作转为异步
	 * 使用 setImmediate 让出事件循环，避免阻塞
	 */
	private async runAsync(sql: string, params: unknown[]): Promise<void> {
		await new Promise(resolve => setImmediate(resolve))
		this.db.run(sql, params)
	}

	/**
	 * 非阻塞包装：将同步查询操作转为异步
	 */
	private async queryAsync(sql: string, params: unknown[]): Promise<SessionRow[]> {
		await new Promise(resolve => setImmediate(resolve))
		return this.db.query(sql).all(...params) as SessionRow[]
	}

	/**
	 * 非阻塞包装：查询单行
	 */
	private async queryGetAsync(sql: string, params: unknown[]): Promise<SessionRow | undefined> {
		await new Promise(resolve => setImmediate(resolve))
		return this.db.query(sql).get(...params) as SessionRow | undefined
	}

	async save(session: Session): Promise<void> {
		const snap = session.toSnapshot()
		await this.runAsync(
			`INSERT OR REPLACE INTO sessions (session_id, workspace, created_at, status, metadata)
       VALUES (?, ?, ?, ?, ?)`,
			[snap.sessionId, snap.workspace, snap.createdAt, snap.status, JSON.stringify(snap.metadata)]
		)
	}

	async load(sessionId: string): Promise<Session | null> {
		const row = await this.queryGetAsync(
			'SELECT session_id, workspace, created_at, status, metadata FROM sessions WHERE session_id = ?',
			[sessionId]
		)
		if (!row) return null
		return this.rowToSession(row)
	}

	async delete(sessionId: string): Promise<void> {
		await this.runAsync('DELETE FROM sessions WHERE session_id = ?', [sessionId])
	}

	async list(): Promise<Session[]> {
		const rows = await this.queryAsync(
			'SELECT session_id, workspace, created_at, status, metadata FROM sessions',
			[]
		)
		return rows.map(row => this.rowToSession(row))
	}

	close(): void {
		if (this._closed) return
		this._closed = true
		this.db.close()
	}

	async dispose(): Promise<void> {
		this.close()
	}

	private rowToSession(row: SessionRow): Session {
		let metadata: Record<string, unknown> = {}
		try {
			metadata = JSON.parse(row.metadata)
		} catch (error) {
			LogUtil.warn('metadata JSON.parse 失败，使用空对象', {sessionId: row.session_id, error: String(error)})
		}
		const snapshot: SessionSnapshot = {
			sessionId: row.session_id,
			workspace: row.workspace,
			createdAt: row.created_at,
			status: row.status,
			metadata,
		}
		return Session.restore(snapshot)
	}
}
