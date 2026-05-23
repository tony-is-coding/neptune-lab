/**
 * engine/types/tool-extension.ts
 *
 * Tool 扩展类型定义
 *
 * 定义 SDK 工具接口和扩展类型，避免 engine/ 向外穿透到 src/Tool.ts。
 *
 * @module
 */

/**
 * SDK 工具接口
 *
 * 只包含 SDK 需要的 Tool 方法子集，不包含完整的 CC Tool 接口。
 * 用于 Bridge 层的 adaptToolExtension 返回类型，消除 as unknown as 断言。
 */
export interface SDKTool {
	/** 工具名称 */
	name: string
	/** 输入模式（opaque schema，由宿主或 API adapter 解释） */
	inputSchema: unknown
	/** 输入 JSON Schema（可选） */
	inputJSONSchema?: {
		[x: string]: unknown
		type: 'object'
		properties?: {
			[x: string]: unknown
		}
	}

	/** 是否启用 */
	isEnabled(): boolean

	/** 是否只读 */
	isReadOnly(): boolean

	/** 是否并发安全 */
	isConcurrencySafe(): boolean

	/** 用户可见名称 */
	userFacingName(): string

	/** 工具提示（兼容 CC Tool.prompt 调用方式） */
	prompt(options?: Record<string, unknown>): Promise<string>

	/** 工具描述（异步获取完整描述） */
	description(callback?: (arg: string) => string): Promise<string>

	/** 工具调用方法 */
	call(input: Record<string, unknown>): Promise<{
		type: 'result'
		resultForAssistant: string
		data: unknown
	}>
}

/**
 * Tool 扩展接口
 *
 * 从 Bridge 层的 ToolExtension 提取核心类型，用于 SDK 集成。
 */
export interface ToolExtension {
	name: string
	description: string

	execute(input: Record<string, unknown>): Promise<{
		content: string
	}>
}
