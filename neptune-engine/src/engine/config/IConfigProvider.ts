/**
 * engine/config/IConfigProvider.ts
 *
 * 统一配置提供者接口
 *
 * 职责：
 * - 定义统一的配置读取接口，支持多来源配置
 * - 提供配置来源追踪，便于诊断配置覆盖规则
 * - 支持类型安全的配置访问
 *
 * 设计原则：
 * - 包装不替代：只新增接口，不修改现有配置读取逻辑
 * - 零 React 依赖：纯接口定义
 * - 与 LogProvider 风格一致
 *
 * @example
 * ```ts
 * import type { IConfigProvider } from './engine/config/index.js'
 *
 * function readModel(config: IConfigProvider): string {
 *   const entry = config.get<string>('model')
 *   return entry?.value ?? 'claude-sonnet-4-20250514'
 * }
 * ```
 */

/**
 * 配置来源枚举
 *
 * 优先级从高到低：
 * - CODE: 代码中直接设置（最高优先级）
 * - ENV: 环境变量
 * - FILE: 配置文件
 * - DEFAULT: 默认值（最低优先级）
 */
export enum ConfigSource {
	/** 代码中直接设置（最高优先级） */
	CODE = 'code',
	/** 环境变量 */
	ENV = 'env',
	/** 配置文件 */
	FILE = 'file',
	/** 默认值（最低优先级） */
	DEFAULT = 'default',
}

/**
 * 配置来源条目
 *
 * 包含配置值及其来源信息，用于诊断配置覆盖规则。
 *
 * @template T - 配置值的类型
 */
export interface ConfigEntry<T = unknown> {
	/** 配置值 */
	value: T
	/** 配置来源 */
	source: ConfigSource
}

/**
 * 统一配置提供者接口
 *
 * 提供类型安全的配置读取方法，支持配置来源追踪。
 *
 * @example
 * ```ts
 * // 基础用法
 * const modelEntry = config.get<string>('model')
 * if (modelEntry) {
 *   console.log(`Model: ${modelEntry.value} (from ${modelEntry.source})`)
 * }
 *
 * // 带默认值
 * const timeout = config.getWithDefault<number>('timeout', 30000)
 *
 * // 必需配置（不存在时抛错）
 * const apiKey = config.getRequired<string>('API_KEY')
 *
 * // 检查配置是否存在
 * if (config.has('debug')) {
 *   // ...
 * }
 *
 * // 列出所有配置键
 * const allKeys = config.keys()
 * ```
 */
export interface IConfigProvider {
	/**
	 * 获取配置值（可选）
	 *
	 * @param key - 配置键
	 * @returns 配置条目，如果不存在则返回 undefined
	 * @template T - 配置值的类型
	 */
	get<T = unknown>(key: string): ConfigEntry<T> | undefined

	/**
	 * 获取配置值（带默认值）
	 *
	 * 如果配置不存在，返回包含默认值的条目，来源为 DEFAULT。
	 *
	 * @param key - 配置键
	 * @param defaultValue - 默认值
	 * @returns 配置条目
	 * @template T - 配置值的类型
	 */
	getWithDefault<T = unknown>(key: string, defaultValue: T): ConfigEntry<T>

	/**
	 * 获取必需的配置值
	 *
	 * 如果配置不存在，抛出错误。
	 *
	 * @param key - 配置键
	 * @returns 配置条目
	 * @throws {Error} 如果配置不存在
	 * @template T - 配置值的类型
	 */
	getRequired<T = unknown>(key: string): ConfigEntry<T>

	/**
	 * 检查配置是否存在
	 *
	 * @param key - 配置键
	 * @returns 如果配置存在则返回 true，否则返回 false
	 */
	has(key: string): boolean

	/**
	 * 获取所有配置键
	 *
	 * @returns 所有配置键的数组
	 */
	keys(): string[]
}
