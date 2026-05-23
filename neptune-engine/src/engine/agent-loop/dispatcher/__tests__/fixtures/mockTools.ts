/**
 * Mock tools for ToolDispatcher tests
 */

import type {Tool, ToolResult} from '../../../../types/tool.js'

/** 简单同步工具：返回固定字符串 */
export function makeEchoTool(name: string, output: string): Tool {
	return {
		name,
		description: `Echo ${name}`,
		inputJSONSchema: {type: 'object', properties: {x: {type: 'string'}}},
		isEnabled: () => true,
		isReadOnly: () => true,
		isConcurrencySafe: () => true,
		async checkPermissions() {
			return {behavior: 'allow' as const}
		},
		async call(): Promise<ToolResult<string>> {
			return {data: output}
		},
	} as unknown as Tool
}

/** 抛错的工具 */
export function makeErrorTool(name: string, errMsg: string): Tool {
	return {
		name,
		description: `Errors with ${errMsg}`,
		inputJSONSchema: {type: 'object', properties: {}},
		isEnabled: () => true,
		isReadOnly: () => true,
		isConcurrencySafe: () => true,
		async checkPermissions() {
			return {behavior: 'allow' as const}
		},
		async call(): Promise<ToolResult<unknown>> {
			throw new Error(errMsg)
		},
	} as unknown as Tool
}

/** 监视 abort signal 的长任务工具 */
export function makeAbortableTool(name: string): Tool {
	return {
		name,
		description: 'Long task that aborts',
		inputJSONSchema: {type: 'object'},
		isEnabled: () => true,
		isReadOnly: () => true,
		isConcurrencySafe: () => true,
		async checkPermissions() {
			return {behavior: 'allow' as const}
		},
		async call(_input, ctx): Promise<ToolResult<string>> {
			// 检查 abort signal —— 真实工具通常会做类似的事
			const signal = (ctx as unknown as {abortController?: AbortController}).abortController?.signal
			await new Promise((resolve, reject) => {
				const onAbort = () => reject(new Error('Aborted by signal'))
				if (signal?.aborted) return reject(new Error('Aborted by signal'))
				signal?.addEventListener('abort', onAbort)
				setTimeout(() => {
					signal?.removeEventListener('abort', onAbort)
					resolve(undefined)
				}, 5)
			})
			return {data: 'completed'}
		},
	} as unknown as Tool
}

/** 用 progress 回调 emit 中间数据的工具 */
export function makeProgressingTool(name: string): Tool {
	return {
		name,
		description: 'Emits progress',
		inputJSONSchema: {type: 'object'},
		isEnabled: () => true,
		isReadOnly: () => true,
		isConcurrencySafe: () => true,
		async checkPermissions() {
			return {behavior: 'allow' as const}
		},
		async call(_input, _ctx, progress): Promise<ToolResult<string>> {
			progress({data: {type: 'tick', step: 1}})
			progress({data: {type: 'tick', step: 2}})
			return {data: 'done', resultForAssistant: 'final-output'}
		},
	} as unknown as Tool
}

/** 返回非字符串数据的工具（验证 JSON.stringify 序列化） */
export function makeObjectTool(name: string): Tool {
	return {
		name,
		description: 'Returns object',
		inputJSONSchema: {type: 'object'},
		isEnabled: () => true,
		isReadOnly: () => true,
		isConcurrencySafe: () => true,
		async checkPermissions() {
			return {behavior: 'allow' as const}
		},
		async call(): Promise<ToolResult<{a: number; b: string}>> {
			return {data: {a: 1, b: 'hello'}}
		},
	} as unknown as Tool
}
