/**
 * InMemorySkillRegistry — engine 默认 SkillRegistry 实现
 *
 * 零外部依赖，每个 session 独立实例。register/unregister 立即生效，
 * find/list 返回稳定排序快照（按 name 升序），保证 prompt 注入幂等。
 *
 * 持久化版本（如 SqliteSkillRegistry）应实现相同接口，把读操作改成对
 * 实际后端的查询；因为接口定义已经返回 Promise（写）和同步快照（读），
 * 持久化实现只需在内部维护一份内存索引 + 后端持久化即可。
 */

import {validateSkillManifest} from './SkillFormatter.js'
import type {SkillManifest, SkillRegistry, SkillSource} from './types.js'

export class InMemorySkillRegistry implements SkillRegistry {
	private readonly manifests = new Map<string, SkillManifest>()
	private readonly sources = new Map<string, SkillSource>()

	async register(manifest: SkillManifest, source: SkillSource): Promise<void> {
		const validation = validateSkillManifest(manifest)
		if (!validation.ok) {
			throw new Error(`invalid skill manifest: ${validation.errors.join('; ')}`)
		}
		this.manifests.set(manifest.name, manifest)
		this.sources.set(manifest.name, source)
	}

	async unregister(name: string): Promise<void> {
		this.manifests.delete(name)
		this.sources.delete(name)
	}

	find(name: string): SkillManifest | undefined {
		return this.manifests.get(name)
	}

	list(): readonly SkillManifest[] {
		return [...this.manifests.values()].sort((a, b) =>
			a.name.localeCompare(b.name),
		)
	}

	source(name: string): SkillSource | undefined {
		return this.sources.get(name)
	}
}
