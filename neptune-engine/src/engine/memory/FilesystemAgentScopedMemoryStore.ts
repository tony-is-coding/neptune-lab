/**
 * FilesystemAgentScopedMemoryStore — AgentScopedMemoryStore 默认实现（filesystem 后端）
 *
 * 设计目的（Stage B1.1）：
 * - 在 substrate 提供 cc agentMemory + agentMemorySnapshot 等价的功能契约
 * - 不依赖 cc 的 getMemoryBaseDir / findCanonicalGitRoot / buildMemoryPrompt 业务函数
 * - 三 scope 路径完全注入化（构造时传 baseDir，避免硬编码 .claude/）
 *
 * 与 cc 行为对齐：
 * - 同样的目录布局 + snapshot.json + .snapshot-synced.json 元数据机制
 * - 同样的 sanitize 逻辑（: → -，避免 Windows 文件名问题）
 * - 同样的 atomic write 行为（先写 .tmp 再 rename）
 *
 * 设计原则：
 * - 0 外部依赖（仅 node:fs + node:path）
 * - 不抛 ENOENT —— 文件不存在按 'none' 或空字符串处理（让 caller 简单）
 * - JSON 解析失败 → 视为没有元数据（fault-tolerant）
 */

import {mkdir, readdir, readFile, rename, rm, stat, writeFile, unlink} from 'node:fs/promises'
import {join} from 'node:path'
import type {
	AgentMemoryScope,
	AgentScopedMemoryStore,
	SnapshotCheckResult,
} from './AgentScopedMemoryStore.js'

const SNAPSHOT_BASE = 'agent-memory-snapshots'
const SNAPSHOT_JSON = 'snapshot.json'
const SYNCED_JSON = '.snapshot-synced.json'

/**
 * 三 scope 路径配置 —— 构造时显式传入，避免硬编码。
 */
export interface FilesystemAgentScopedMemoryStoreConfig {
	/** user scope 根目录（typically `~/.claude/agent-memory/`） */
	readonly userBaseDir: string
	/** project scope 根目录（typically `<cwd>/.claude/agent-memory/`） */
	readonly projectBaseDir: string
	/** local scope 根目录（typically `<cwd>/.claude/agent-memory-local/`） */
	readonly localBaseDir: string
	/** snapshot 根目录（typically `<cwd>/.claude/agent-memory-snapshots/`） */
	readonly snapshotBaseDir: string
}

/**
 * Sanitize agent type for path use.
 *
 * cc 实测：plugin namespace 用 `:` 分隔（如 'my-plugin:my-agent'），但
 * Windows 文件名禁用 `:`，所以替换为 `-`。
 */
function sanitizeAgentType(agentType: string): string {
	return agentType.replace(/:/g, '-')
}

/** 容错读 JSON。失败返 null。 */
async function readJsonSafe<T>(path: string): Promise<T | null> {
	try {
		const content = await readFile(path, 'utf-8')
		return JSON.parse(content) as T
	} catch {
		return null
	}
}

/** Atomic write JSON via tmp + rename. */
async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
	const tmpPath = `${path}.tmp.${process.pid}.${Date.now()}`
	await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
	await rename(tmpPath, path)
}

export class FilesystemAgentScopedMemoryStore implements AgentScopedMemoryStore {
	constructor(private readonly config: FilesystemAgentScopedMemoryStoreConfig) {}

	private getScopeDir(agentType: string, scope: AgentMemoryScope): string {
		const sanitized = sanitizeAgentType(agentType)
		switch (scope) {
			case 'user':
				return join(this.config.userBaseDir, sanitized)
			case 'project':
				return join(this.config.projectBaseDir, sanitized)
			case 'local':
				return join(this.config.localBaseDir, sanitized)
		}
	}

	private getSnapshotDir(agentType: string): string {
		const sanitized = sanitizeAgentType(agentType)
		return join(this.config.snapshotBaseDir, sanitized)
	}

	private getSnapshotJsonPath(agentType: string): string {
		return join(this.getSnapshotDir(agentType), SNAPSHOT_JSON)
	}

	private getSyncedJsonPath(agentType: string, scope: AgentMemoryScope): string {
		return join(this.getScopeDir(agentType, scope), SYNCED_JSON)
	}

	async load(agentType: string, scope: AgentMemoryScope): Promise<string> {
		const dir = this.getScopeDir(agentType, scope)
		try {
			const dirents = await readdir(dir, {withFileTypes: true})
			const mdFiles = dirents
				.filter(d => d.isFile() && d.name.endsWith('.md'))
				.map(d => d.name)
				.sort() // 稳定顺序
			const parts: string[] = []
			for (const fileName of mdFiles) {
				try {
					const content = await readFile(join(dir, fileName), 'utf-8')
					parts.push(`<!-- ${fileName} -->\n${content}`)
				} catch {
					// 单文件读取失败不阻断整体（partial 加载）
				}
			}
			return parts.join('\n\n')
		} catch {
			return ''
		}
	}

	async write(
		agentType: string,
		scope: AgentMemoryScope,
		fileName: string,
		content: string,
	): Promise<void> {
		const dir = this.getScopeDir(agentType, scope)
		await mkdir(dir, {recursive: true})
		const filePath = join(dir, fileName)
		const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`
		await writeFile(tmpPath, content, 'utf-8')
		await rename(tmpPath, filePath)
	}

	async list(
		agentType: string,
		scope: AgentMemoryScope,
	): Promise<readonly string[]> {
		const dir = this.getScopeDir(agentType, scope)
		try {
			const dirents = await readdir(dir, {withFileTypes: true})
			return dirents
				.filter(d => d.isFile() && d.name.endsWith('.md'))
				.map(d => d.name)
				.sort()
		} catch {
			return []
		}
	}

	async delete(
		agentType: string,
		scope: AgentMemoryScope,
		fileName: string,
	): Promise<void> {
		const filePath = join(this.getScopeDir(agentType, scope), fileName)
		try {
			await unlink(filePath)
		} catch {
			// ENOENT 等错误吞掉（idempotent delete）
		}
	}

	async checkSnapshot(
		agentType: string,
		scope: AgentMemoryScope,
	): Promise<SnapshotCheckResult> {
		const snapshotMeta = await readJsonSafe<{updatedAt: string}>(
			this.getSnapshotJsonPath(agentType),
		)
		if (!snapshotMeta || typeof snapshotMeta.updatedAt !== 'string') {
			return {action: 'none'}
		}

		const localDir = this.getScopeDir(agentType, scope)
		let hasLocalMemory = false
		try {
			const dirents = await readdir(localDir, {withFileTypes: true})
			hasLocalMemory = dirents.some(d => d.isFile() && d.name.endsWith('.md'))
		} catch {
			// dir 不存在 → 无 local memory
		}

		if (!hasLocalMemory) {
			return {action: 'initialize', snapshotTimestamp: snapshotMeta.updatedAt}
		}

		const syncedMeta = await readJsonSafe<{syncedFrom: string}>(
			this.getSyncedJsonPath(agentType, scope),
		)
		if (
			!syncedMeta ||
			new Date(snapshotMeta.updatedAt) > new Date(syncedMeta.syncedFrom)
		) {
			return {action: 'prompt-update', snapshotTimestamp: snapshotMeta.updatedAt}
		}

		return {action: 'none'}
	}

	private async copySnapshotToScope(
		agentType: string,
		scope: AgentMemoryScope,
	): Promise<void> {
		const snapshotDir = this.getSnapshotDir(agentType)
		const localDir = this.getScopeDir(agentType, scope)
		await mkdir(localDir, {recursive: true})
		try {
			const dirents = await readdir(snapshotDir, {withFileTypes: true})
			for (const dirent of dirents) {
				if (!dirent.isFile()) continue
				if (dirent.name === SNAPSHOT_JSON) continue
				if (!dirent.name.endsWith('.md')) continue
				const content = await readFile(join(snapshotDir, dirent.name), 'utf-8')
				const dst = join(localDir, dirent.name)
				const tmp = `${dst}.tmp.${process.pid}.${Date.now()}`
				await writeFile(tmp, content, 'utf-8')
				await rename(tmp, dst)
			}
		} catch {
			// snapshot 不存在 → no-op
		}
	}

	async initializeFromSnapshot(
		agentType: string,
		scope: AgentMemoryScope,
		snapshotTimestamp: string,
	): Promise<void> {
		await this.copySnapshotToScope(agentType, scope)
		await this.markSnapshotSynced(agentType, scope, snapshotTimestamp)
	}

	async replaceFromSnapshot(
		agentType: string,
		scope: AgentMemoryScope,
		snapshotTimestamp: string,
	): Promise<void> {
		const localDir = this.getScopeDir(agentType, scope)
		try {
			const dirents = await readdir(localDir, {withFileTypes: true})
			for (const dirent of dirents) {
				if (dirent.isFile() && dirent.name.endsWith('.md')) {
					await unlink(join(localDir, dirent.name)).catch(() => {})
				}
			}
		} catch {
			// dir 不存在 → no-op
		}
		await this.copySnapshotToScope(agentType, scope)
		await this.markSnapshotSynced(agentType, scope, snapshotTimestamp)
	}

	async markSnapshotSynced(
		agentType: string,
		scope: AgentMemoryScope,
		snapshotTimestamp: string,
	): Promise<void> {
		const localDir = this.getScopeDir(agentType, scope)
		await mkdir(localDir, {recursive: true})
		await writeJsonAtomic(this.getSyncedJsonPath(agentType, scope), {
			syncedFrom: snapshotTimestamp,
		})
	}

	async writeSnapshot(
		agentType: string,
		fileName: string,
		content: string,
		updatedAt: string,
	): Promise<void> {
		const dir = this.getSnapshotDir(agentType)
		await mkdir(dir, {recursive: true})
		// 写文件
		const filePath = join(dir, fileName)
		const tmpFile = `${filePath}.tmp.${process.pid}.${Date.now()}`
		await writeFile(tmpFile, content, 'utf-8')
		await rename(tmpFile, filePath)
		// 写 snapshot.json metadata
		await writeJsonAtomic(this.getSnapshotJsonPath(agentType), {updatedAt})
	}
}
