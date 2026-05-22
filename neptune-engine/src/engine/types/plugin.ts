/**
 * engine/types/plugin.ts
 *
 * Plugin 最小接口 — engine-local opaque types
 *
 * engine 层只需要 LoadedPlugin 和 PluginError 的最小结构，
 * 内联于此，消除对 @neptune/engine-product 的反向依赖。
 */

/** LoadedPlugin — engine 层最小接口 */
export type LoadedPlugin = {
	name: string
	path: string
	source: string
	repository: string
	enabled?: boolean
	isBuiltin?: boolean
	sha?: string
	manifest: {
		name: string
		version?: string
		description?: string
		[key: string]: unknown
	}
	commandsPath?: string
	commandsPaths?: string[]
	commandsMetadata?: Record<string, unknown>
	agentsPath?: string
}

/** PluginError — engine 层最小接口 */
export type PluginError = {
	name: string
	error: Error | string
	source?: string
}

/** PluginLoadResult — engine 层最小接口 */
export type PluginLoadResult = {
	plugins: LoadedPlugin[]
	errors: PluginError[]
}
