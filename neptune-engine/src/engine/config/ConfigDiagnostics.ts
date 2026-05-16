/**
 * engine/config/ConfigDiagnostics.ts
 *
 * 配置诊断日志工具
 *
 * 职责：
 * - 记录配置决策链，追踪每个配置字段的来源
 * - 支持配置冲突诊断
 * - 生成配置摘要日志
 *
 * 设计原则：
 * - 零运行时开销（debug 模式下才记录）
 * - 不影响配置转换性能
 * - 日志格式清晰易读
 *
 * @example
 * ```ts
 * import { ConfigDiagnostics } from './engine/config/index.js'
 *
 * const diag = new ConfigDiagnostics('model')
 * diag.record('agentConfig', 'claude-3.5-sonnet')
 * diag.override('env', 'claude-3-opus') // 被环境变量覆盖
 * diag.finalize() // 打印决策链
 * ```
 */

import {LogUtil} from '../log/LogUtil.js'

/**
 * 检查是否启用 debug 模式
 *
 * 通过检查环境变量 DEBUG 或 AGENT_ENGINE_LOG_LEVEL。
 */
function isDebugEnabled(): boolean {
	const debugEnv = process.env.DEBUG
	const logLevel = process.env.AGENT_ENGINE_LOG_LEVEL
	return debugEnv !== undefined || logLevel === 'debug'
}

/**
 * 配置来源类型（用于诊断日志）
 */
export type ConfigSourceType =
	| 'agentConfig' // AgentEngineConfig（代码直接设置）
	| 'settings' // settings.json
	| 'env' // 环境变量
	| 'default' // 默认值
	| 'computed' // 计算得出

/**
 * 配置决策条目
 */
interface ConfigDecision {
	/** 来源 */
	source: ConfigSourceType
	/** 值 */
	value: unknown
	/** 是否被后续来源覆盖 */
	overridden: boolean
}

/**
 * 配置诊断记录器
 *
 * 记录单个配置字段的决策链。
 */
export class ConfigDiagnostics {
	private decisions: ConfigDecision[] = []
	private finalized = false

	constructor(
		private readonly key: string,
		private readonly debug: boolean = isDebugEnabled(),
	) {
	}

	/**
	 * 记录一个配置决策
	 *
	 * @param source 配置来源
	 * @param value 配置值
	 */
	record(source: ConfigSourceType, value: unknown): void {
		if (!this.debug) return

		const overridden = this.decisions.length > 0
		// 标记之前的决策为被覆盖
		if (overridden && this.decisions.length > 0) {
			this.decisions[this.decisions.length - 1].overridden = true
		}

		this.decisions.push({source, value, overridden})
	}

	/**
	 * 记录一个覆盖决策
	 *
	 * @param source 覆盖来源
	 * @param value 覆盖值
	 */
	override(source: ConfigSourceType, value: unknown): void {
		this.record(source, value)
	}

	/**
	 * 获取最终值
	 *
	 * @returns 最后一次记录的值，如果没有记录则返回 undefined
	 */
	getFinalValue(): unknown {
		if (this.decisions.length === 0) return undefined
		return this.decisions[this.decisions.length - 1].value
	}

	/**
	 * 打印决策链（debug 日志）
	 *
	 * 格式：config resolved: model = claude-3.5-sonnet (source: agentConfig, overrides: envModel=none, settingsModel=none)
	 */
	finalize(): void {
		if (!this.debug || this.finalized) return
		this.finalized = true

		if (this.decisions.length === 0) {
			LogUtil.debug(`config resolved: ${this.key} = <undefined> (source: none)`)
			return
		}

		const final = this.decisions[this.decisions.length - 1]
		const overrides = this.decisions
			.slice(0, -1)
			.map((d) => `${d.source}=${this.formatValue(d.value)}`)
			.join(', ')

		const overrideText = overrides ? `, overrides: ${overrides}` : ''
		LogUtil.debug(
			`config resolved: ${this.key} = ${this.formatValue(final.value)} (source: ${final.source}${overrideText})`,
		)
	}

	/**
	 * 格式化值用于日志输出
	 */
	private formatValue(value: unknown): string {
		if (value === undefined) return '<undefined>'
		if (value === null) return '<null>'
		if (typeof value === 'string') return `"${value}"`
		if (typeof value === 'object') return JSON.stringify(value)
		return String(value)
	}
}

/**
 * 配置摘要信息
 */
interface ConfigSummaryEntry {
	/** 配置键 */
	key: string
	/** 最终值 */
	value: string
	/** 来源 */
	source: ConfigSourceType
}

/**
 * 配置摘要生成器
 *
 * 收集所有配置的决策结果，生成摘要日志。
 */
export class ConfigSummary {
	private entries: Map<string, ConfigSummaryEntry> = new Map()

	/**
	 * 添加配置摘要条目
	 *
	 * @param key 配置键
	 * @param value 配置值
	 * @param source 配置来源
	 */
	add(key: string, value: string, source: ConfigSourceType): void {
		this.entries.set(key, {key, value, source})
	}

	/**
	 * 打印配置摘要（info 日志）
	 *
	 * 格式：
	 * ```
	 * Configuration Summary:
	 *   model: claude-3.5-sonnet (agentConfig)
	 *   cwd: /workspace (agentConfig)
	 *   verbose: true (agentConfig)
	 * ```
	 */
	print(): void {
		if (this.entries.size === 0) return

		LogUtil.info('Configuration Summary:')
		for (const entry of this.entries.values()) {
			LogUtil.info(`  ${entry.key}: ${entry.value} (${entry.source})`)
		}
	}
}
