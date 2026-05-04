/**
 * engine/config/index.ts
 *
 * 统一配置模块 — 统一导出
 *
 * 核心接口与实现：
 * - IConfigProvider：统一配置提供者接口
 * - ConfigSource：配置来源枚举（CODE > ENV > FILE > DEFAULT）
 * - ConfigEntry：配置来源条目
 * - NoOpConfigProvider：零开销默认实现
 * - UnifiedConfig：统一配置类型（合并 AgentEngineConfig 和 EngineConfig）
 * - normalizeConfig：配置归一化函数（带诊断日志）
 * - ConfigDiagnostics：配置诊断日志工具
 * - ConfigSummary：配置摘要生成器
 *
 * @example
 * ```ts
 * import type { IConfigProvider } from './engine/config/index.js'
 * import { NoOpConfigProvider, ConfigSource, normalizeConfig } from './engine/config/index.js'
 *
 * const config: IConfigProvider = new NoOpConfigProvider()
 * const entry = config.getWithDefault('timeout', 30000)
 * console.log(entry.source) // 'default'
 *
 * // 归一化配置（带诊断日志）
 * const unified = normalizeConfig(engineConfig, settingsJson)
 * // debug: config resolved: model = claude-3.5-sonnet (source: agentConfig)
 * // info: Configuration Summary:
 * //   model: claude-3.5-sonnet (agentConfig)
 * ```
 */

export type { IConfigProvider, ConfigEntry } from './IConfigProvider.js'
export { ConfigSource } from './IConfigProvider.js'
export { NoOpConfigProvider, noOpConfigProvider } from './NoOpConfigProvider.js'
export type { UnifiedConfig } from './UnifiedConfig.js'
export { normalizeConfig } from './UnifiedConfig.js'
export { ConfigDiagnostics, ConfigSummary } from './ConfigDiagnostics.js'
export type { ConfigSourceType } from './ConfigDiagnostics.js'
export type { EngineConfig, McpServerConfig } from './ConfigValidation.js'
export { validateEngineConfig } from './ConfigValidation.js'
