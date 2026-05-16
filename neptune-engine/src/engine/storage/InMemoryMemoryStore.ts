/**
 * InMemoryMemoryStore — 内存记忆存储实现
 *
 * 基于 Map 的内存存储，适合单机、短期场景。
 * 数据不持久化，进程重启后丢失。
 */

import type {IMemoryStore} from './IMemoryStore.js'

/**
 * 内存记忆存储实现
 *
 * 使用嵌套 Map 结构：Map<userId, Map<key, value>>
 */
export class InMemoryMemoryStore implements IMemoryStore {
	private readonly store = new Map<string, Map<string, unknown>>()

	async save(userId: string, key: string, value: unknown): Promise<void> {
		let userStore = this.store.get(userId)
		if (!userStore) {
			userStore = new Map<string, unknown>()
			this.store.set(userId, userStore)
		}
		userStore.set(key, value)
	}

	async load(userId: string, key: string): Promise<unknown | undefined> {
		const userStore = this.store.get(userId)
		return userStore?.get(key)
	}

	async delete(userId: string, key: string): Promise<void> {
		const userStore = this.store.get(userId)
		if (userStore) {
			userStore.delete(key)
			// 如果用户存储为空，删除用户 Map
			if (userStore.size === 0) {
				this.store.delete(userId)
			}
		}
	}

	async list(userId: string, prefix?: string): Promise<Array<{ key: string; value: unknown }>> {
		const userStore = this.store.get(userId)
		if (!userStore) {
			return []
		}

		const result: Array<{ key: string; value: unknown }> = []

		if (prefix) {
			// 前缀过滤
			for (const [key, value] of userStore.entries()) {
				if (key.startsWith(prefix)) {
					result.push({key, value})
				}
			}
		} else {
			// 返回全部
			for (const [key, value] of userStore.entries()) {
				result.push({key, value})
			}
		}

		return result
	}

	async clear(userId: string): Promise<void> {
		this.store.delete(userId)
	}

	async dispose(): Promise<void> {
		this.store.clear()
	}
}
