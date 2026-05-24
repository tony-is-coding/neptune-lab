/**
 * FilesystemAgentRegistry — 每个 manifest 一个 JSON 文件
 *
 * 存储格式：{rootDir}/{type}.agent.json，atomicWrite 写入。
 * NFS 友好：tmp + rename 跨实例并发安全。
 *
 * 设计原则：
 * - 借鉴 cc loadAgentsDir 的目录扫描语义，但不解析 markdown frontmatter
 *   （markdown 解析放 product，registry 只认 JSON manifest）
 * - register() 是按 type upsert（同名覆盖），不抛冲突错误
 */

import {readdir, readFile, unlink} from 'node:fs/promises'
import {join} from 'node:path'
import type {AgentManifest, AgentRegistry} from './AgentRegistry.js'
import {atomicWrite} from '../utils/atomicWrite.js'
import {sanitizePath} from '../utils/sanitizePath.js'

const SUFFIX = '.agent.json'

export class FilesystemAgentRegistry implements AgentRegistry {
	constructor(private readonly rootDir: string) {}

	async get(type: string): Promise<AgentManifest | undefined> {
		try {
			const raw = await readFile(this.pathFor(type), 'utf8')
			return JSON.parse(raw) as AgentManifest
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
			throw err
		}
	}

	async list(): Promise<AgentManifest[]> {
		let entries: string[]
		try {
			entries = await readdir(this.rootDir)
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
			throw err
		}
		const files = entries.filter(e => e.endsWith(SUFFIX))
		const out: AgentManifest[] = []
		for (const f of files) {
			try {
				const raw = await readFile(join(this.rootDir, f), 'utf8')
				out.push(JSON.parse(raw) as AgentManifest)
			} catch {
				// 损坏文件跳过
			}
		}
		return out
	}

	async register(manifest: AgentManifest): Promise<void> {
		await atomicWrite(this.pathFor(manifest.type), JSON.stringify(manifest, null, 2))
	}

	async unregister(type: string): Promise<void> {
		try {
			await unlink(this.pathFor(type))
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
			throw err
		}
	}

	private pathFor(type: string): string {
		// type 通常是 alphanum/dash，但保险起见 sanitize
		return join(this.rootDir, `${sanitizePath(type)}${SUFFIX}`)
	}
}
