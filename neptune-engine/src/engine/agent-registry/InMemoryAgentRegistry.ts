/**
 * InMemoryAgentRegistry — Map 后端，进程内单点注册
 *
 * Stage B1.3 — 增加 getBuiltIns() 协议方法（默认返 4 个 substrate baseline）
 * Stage B3 — 提供 registerBuiltIns() 一键注册 helper
 */

import type {AgentManifest, AgentRegistry} from './AgentRegistry.js'
import {BUILT_IN_AGENT_MANIFESTS} from './builtins/index.js'

export class InMemoryAgentRegistry implements AgentRegistry {
	private readonly store = new Map<string, AgentManifest>()

	async get(type: string): Promise<AgentManifest | undefined> {
		return this.store.get(type)
	}

	async list(): Promise<AgentManifest[]> {
		return Array.from(this.store.values())
	}

	async register(manifest: AgentManifest): Promise<void> {
		this.store.set(manifest.type, manifest)
	}

	async unregister(type: string): Promise<void> {
		this.store.delete(type)
	}

	/**
	 * Stage B1.3 — 返回 substrate baseline 4 agents 的 manifest 列表（不实际注册）。
	 *
	 * Caller 决定是否调 register() 入库。
	 */
	getBuiltIns(): readonly AgentManifest[] {
		return BUILT_IN_AGENT_MANIFESTS
	}

	/**
	 * Stage B3 — 一键把 4 个 baseline 注册到自己的 store。
	 * Idempotent：重复调用按同 type 覆盖。
	 */
	async registerBuiltIns(): Promise<void> {
		for (const manifest of BUILT_IN_AGENT_MANIFESTS) {
			await this.register(manifest)
		}
	}
}
