/**
 * FilesystemSessionStore — Session 持久化的文件系统实现
 *
 * 设计：每个 session 一个 JSON 文件 `{rootDir}/{sessionId}.session.json`，
 * 用 atomicWrite (tmp + rename) 保证崩溃容错。
 *
 * 与 cc 风格对齐：
 * - 单文件存储 metadata（不存内容；内容用 SessionContentStore）
 * - 文件名直接用 sessionId（已是 UUID，本身 fs-safe）
 *
 * NFS 友好：tmp 与目标同目录 → rename 是 atomic
 */

import {readdir, readFile, unlink, stat} from 'node:fs/promises'
import {join} from 'node:path'
import {Session, type SessionSnapshot} from '../Session.js'
import type {ISessionStore} from './ISessionStore.js'
import {atomicWrite} from '../utils/atomicWrite.js'

const SESSION_FILE_SUFFIX = '.session.json'

export class FilesystemSessionStore implements ISessionStore {
	constructor(private readonly rootDir: string) {}

	async save(session: Session): Promise<void> {
		const path = this.pathFor(session.sessionId)
		const snapshot = session.toSnapshot()
		// systemPrompt 函数无法序列化 → 标记为 __function__（与 PgSessionStore 行为对齐）
		const persistable = this.toPersistable(snapshot)
		await atomicWrite(path, JSON.stringify(persistable))
	}

	async load(sessionId: string): Promise<Session | null> {
		const path = this.pathFor(sessionId)
		try {
			const raw = await readFile(path, 'utf8')
			const snapshot = this.fromPersistable(JSON.parse(raw) as PersistableSnapshot)
			return Session.restore(snapshot)
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
			throw err
		}
	}

	async delete(sessionId: string): Promise<void> {
		const path = this.pathFor(sessionId)
		try {
			await unlink(path)
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
			throw err
		}
	}

	async list(): Promise<Session[]> {
		let entries: string[]
		try {
			entries = await readdir(this.rootDir)
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
			throw err
		}
		const sessionFiles = entries.filter(e => e.endsWith(SESSION_FILE_SUFFIX))
		const sessions: Session[] = []
		for (const file of sessionFiles) {
			const sessionId = file.slice(0, -SESSION_FILE_SUFFIX.length)
			const session = await this.load(sessionId)
			if (session) sessions.push(session)
		}
		return sessions
	}

	async dispose(): Promise<void> {
		// no-op: filesystem store has no resources to release
	}

	private pathFor(sessionId: string): string {
		return join(this.rootDir, `${sessionId}${SESSION_FILE_SUFFIX}`)
	}

	private toPersistable(snap: SessionSnapshot): PersistableSnapshot {
		const persistable: PersistableSnapshot = {
			sessionId: snap.sessionId,
			workspace: snap.workspace,
			createdAt: snap.createdAt,
			status: snap.status,
			metadata: snap.metadata,
		}
		if (snap.systemPrompt !== undefined) {
			persistable.systemPrompt =
				typeof snap.systemPrompt === 'function' ? '__function__' : snap.systemPrompt
		}
		return persistable
	}

	private fromPersistable(p: PersistableSnapshot): SessionSnapshot {
		const snap: SessionSnapshot = {
			sessionId: p.sessionId,
			workspace: p.workspace,
			createdAt: p.createdAt,
			status: p.status,
			metadata: p.metadata ?? {},
		}
		if (p.systemPrompt === '__function__') {
			snap.systemPrompt = async () => ''
		} else if (p.systemPrompt !== undefined) {
			snap.systemPrompt = p.systemPrompt
		}
		return snap
	}
}

interface PersistableSnapshot {
	sessionId: string
	workspace: string
	createdAt: number
	status: SessionSnapshot['status']
	metadata?: Record<string, unknown>
	systemPrompt?: string
}
