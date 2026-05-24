/**
 * InMemoryAgentRegistry — Map 后端，进程内单点注册
 */

import type {AgentManifest, AgentRegistry} from './AgentRegistry.js'

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
}
