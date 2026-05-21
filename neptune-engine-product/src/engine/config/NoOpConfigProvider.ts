/**
 * engine/config/NoOpConfigProvider.ts
 *
 * No-Op 配置提供者实现
 *
 * 用于：
 * - 测试环境：提供零配置的默认实现
 * - SDK 最小化模式：消除配置读取开销
 * - 占位实现：在配置系统初始化之前提供空实现
 *
 * 所有方法都是零开销操作：
 * - get() 返回 undefined
 * - getWithDefault() 返回默认值条目（来源为 DEFAULT）
 * - getRequired() 抛出错误
 * - has() 返回 false
 * - keys() 返回空数组
 *
 * @example
 * ```ts
 * import { NoOpConfigProvider } from './engine/config/index.js'
 *
 * // 测试中使用
 * const config = new NoOpConfigProvider()
 * assert(config.get('model') === undefined)
 *
 * // SDK 最小化模式
 * const engine = AgentEngine.create({
 *   configProvider: new NoOpConfigProvider(),
 * })
 * ```
 */

import type {IConfigProvider, ConfigEntry, ConfigSource} from './IConfigProvider.js'

/**
 * No-Op 配置提供者
 *
 * 实现 IConfigProvider 接口，但所有操作都是零开销。
 * 用于测试环境或 SDK 最小化模式。
 */
export class NoOpConfigProvider implements IConfigProvider {
	/**
	 * 空操作的 get
	 *
	 * @param _key - 配置键（忽略）
	 * @returns 始终返回 undefined
	 */
	get<T = unknown>(_key: string): ConfigEntry<T> | undefined {
		return undefined
	}

	/**
	 * 带默认值的 get
	 *
	 * @param _key - 配置键（忽略）
	 * @param defaultValue - 默认值
	 * @returns 包含默认值的配置条目，来源为 DEFAULT
	 */
	getWithDefault<T = unknown>(_key: string, defaultValue: T): ConfigEntry<T> {
		return {
			value: defaultValue,
			source: 'default' as ConfigSource,
		}
	}

	/**
	 * 获取必需配置（始终抛出错误）
	 *
	 * @param key - 配置键
	 * @throws {Error} 始终抛出错误，因为 NoOpConfigProvider 没有配置
	 */
	getRequired<T = unknown>(key: string): ConfigEntry<T> {
		throw new Error(`Required config "${key}" not found (NoOpConfigProvider has no configs)`)
	}

	/**
	 * 空操作的 has
	 *
	 * @param _key - 配置键（忽略）
	 * @returns 始终返回 false
	 */
	has(_key: string): boolean {
		return false
	}

	/**
	 * 空操作的 keys
	 *
	 * @returns 始终返回空数组
	 */
	keys(): string[] {
		return []
	}
}

/**
 * 单例 No-Op Config Provider 实例
 */
export const noOpConfigProvider = new NoOpConfigProvider()
