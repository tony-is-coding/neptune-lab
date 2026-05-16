import type {IBackend} from './IBackend.js'
import {EngineError, EngineErrorCode} from '../errors.js'

/**
 * 组合后端，按 key 前缀路由到不同的子后端
 * 支持通配符路由，未匹配的 key 路由到默认后端
 *
 * @template T 存储的值类型
 */
export class CompositeBackend<T> implements IBackend<T> {
	private readonly routes: Array<{ prefix: string; backend: IBackend<T> }>
	private readonly defaultBackend?: IBackend<T>

	constructor(options: {
		routes: Array<{ prefix: string; backend: IBackend<T> }>
		default?: IBackend<T>
	}) {
		this.routes = options.routes.sort((a, b) => b.prefix.length - a.prefix.length) // 长前缀优先
		this.defaultBackend = options.default
	}

	/**
	 * 根据 key 查找对应的后端
	 */
	private findBackend(key: string): IBackend<T> | undefined {
		for (const route of this.routes) {
			if (key.startsWith(route.prefix)) {
				return route.backend
			}
		}
		return this.defaultBackend
	}

	async read(key: string): Promise<T | null> {
		const backend = this.findBackend(key)
		if (!backend) {
			return null
		}
		return backend.read(key)
	}

	async write(key: string, value: T): Promise<void> {
		const backend = this.findBackend(key)
		if (!backend) {
			throw new EngineError(EngineErrorCode.CONFIGURATION_ERROR, `No backend found for key: ${key}`)
		}
		return backend.write(key, value)
	}

	async delete(key: string): Promise<void> {
		const backend = this.findBackend(key)
		if (!backend) {
			return // 静默成功
		}
		return backend.delete(key)
	}

	async list(prefix?: string): Promise<T[]> {
		// 收集所有匹配后端的结果
		const results: T[] = []

		if (prefix) {
			// 如果指定了前缀，只查找匹配的后端
			const backend = this.findBackend(prefix)
			if (backend) {
				const values = await backend.list(prefix)
				results.push(...values)
			}
		} else {
			// 否则遍历所有后端
			for (const route of this.routes) {
				const values = await route.backend.list()
				results.push(...values)
			}
			if (this.defaultBackend) {
				const values = await this.defaultBackend.list()
				results.push(...values)
			}
		}

		return results
	}

	async dispose(): Promise<void> {
		// 释放所有后端
		const disposePromises = this.routes.map(r => r.backend.dispose())
		if (this.defaultBackend) {
			disposePromises.push(this.defaultBackend.dispose())
		}
		await Promise.all(disposePromises)
	}
}
