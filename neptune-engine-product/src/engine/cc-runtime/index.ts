/**
 * CCRuntime 模块导出
 *
 * 统一导出 CCRuntime 相关类型和工厂函数。
 */

export type {
	BootstrapState,
	CwdContextFn,
	MacroDefines,
	QueryEngineFactory,
	QueryEngineWrapper,
	TranscriptLoadResult,
	QueryEngineConfig,
	CCRuntime,
} from './CCRuntime.js'

export {DEFAULT_MACROS} from './CCRuntime.js'

export {
	DefaultCCRuntime,
	createDefaultCCRuntime,
	createHeadlessCCRuntime,
	getGlobalCCRuntime,
	resetGlobalCCRuntimeForTesting,
} from './DefaultCCRuntime.js'

export {MockCCRuntime, createMockCCRuntime} from './MockCCRuntime.js'
export type {MockCCRuntimeOptions} from './MockCCRuntime.js'
