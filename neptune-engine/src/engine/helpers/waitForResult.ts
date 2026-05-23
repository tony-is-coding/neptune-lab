/**
 * waitForResult() — 等待 query() 完成并返回最终结果的便捷方法
 *
 * 这个辅助函数会消费整个 AsyncGenerator，直到流结束或遇到错误事件。
 * 适用于只需要知道查询是否成功完成的场景。
 */

import type {SDKMessage} from '../types/query-events'

/**
 * 查询结果类型
 */
export interface QueryResult {
	/** 查询是否成功完成 */
	success: boolean
	/** 完成时的最后一条消息（如果有） */
	lastMessage?: SDKMessage
	/** 收集到的所有消息（可选，用于调试） */
	messages?: SDKMessage[]
	/** 错误信息（如果失败） */
	error?: unknown
}

/**
 * waitForResult — 等待 query() 完成
 *
 * @param messages query() 返回的 AsyncGenerator
 * @param options 选项
 * @returns Promise<QueryResult> 查询结果
 *
 * @example
 * ```ts
 * const engine = AgentEngine.create(config)
 * const sessionId = await engine.createSession({ workspace: '/tmp/ws' })
 *
 * const messages = engine.query(sessionId, 'Create a file')
 * const result = await waitForResult(messages)
 *
 * if (result.success) {
 *   console.log('Query completed successfully')
 * } else {
 *   console.error('Query failed:', result.error)
 * }
 * ```
 */
export async function waitForResult(
	messages: AsyncGenerator<SDKMessage>,
	options?: {
		/** 是否收集所有消息（默认 false，节省内存） */
		collectMessages?: boolean
	},
): Promise<QueryResult> {
	const result: QueryResult = {success: false}
	const collectedMessages: SDKMessage[] = []

	try {
		for await (const message of messages) {
			// 保存最后一条消息
			result.lastMessage = message

			// 可选：收集所有消息
			if (options?.collectMessages) {
				collectedMessages.push(message)
			}

			// 检测错误事件
			if (message.type === 'assistant_error' || message.type === 'error') {
				result.success = false
				result.error = message.error
				break
			}

			// 检测 result 消息（CC 原始代码的结束标记）
			if (message.type === 'result') {
				result.success = true
				break
			}
		}

		// 正常退出循环（没有错误或 result 消息）视为成功
		if (result.success === undefined) {
			result.success = true
		}

		// 返回收集的消息（如果启用）
		if (options?.collectMessages) {
			result.messages = collectedMessages
		}
	} catch (error) {
		result.success = false
		result.error = error
	}

	return result
}

/**
 * waitForResultWithTimeout — 等待 query() 完成，带超时控制
 *
 * @param messages query() 返回的 AsyncGenerator
 * @param timeoutMs 超时时间（毫秒）
 * @param options 选项
 * @returns Promise<QueryResult> 查询结果
 *
 * @example
 * ```ts
 * const messages = engine.query(sessionId, 'Long running task')
 * const result = await waitForResultWithTimeout(messages, 30000)
 *
 * if (!result.success && result.error === 'TIMEOUT') {
 *   console.error('Query timed out after 30 seconds')
 * }
 * ```
 */
export async function waitForResultWithTimeout(
	messages: AsyncGenerator<SDKMessage>,
	timeoutMs: number,
	options?: {
		collectMessages?: boolean
	},
): Promise<QueryResult> {
	let timeoutHandle: ReturnType<typeof setTimeout> | undefined

	// 创建超时 Promise
	const timeoutPromise = new Promise<QueryResult>((resolve) => {
		// 处理负数或零超时
		const actualTimeout = Math.max(0, timeoutMs)
		timeoutHandle = setTimeout(() => {
			resolve({success: false, error: 'TIMEOUT'})
		}, actualTimeout)
	})

	// 创建实际查询 Promise，完成后清理 timeout
	const queryPromise = waitForResult(messages, options).finally(() => {
		// 查询完成时清理 timeout
		if (timeoutHandle !== undefined) {
			clearTimeout(timeoutHandle)
			timeoutHandle = undefined
		}
	})

	// 竞速：先完成的返回结果
	const result = await Promise.race([timeoutPromise, queryPromise])

	// 如果是超时，需要显式关闭 generator
	if (result.error === 'TIMEOUT') {
		const iterator = messages[Symbol.asyncIterator]()
		if (typeof iterator.return === 'function') {
			try {
				await iterator.return(undefined)
			} catch {
				// 忽略 cleanup 中的错误
			}
		}
	}

	return result
}

/**
 * waitForEventType — 等待特定类型的事件
 *
 * @param messages query() 返回的 AsyncGenerator
 * @param eventType 等待的事件类型
 * @returns Promise<SDKMessage | null> 匹配的事件，未找到返回 null
 *
 * @example
 * ```ts
 * const messages = engine.query(sessionId, 'Use a tool')
 * const toolUse = await waitForEventType(messages, 'tool_use')
 *
 * if (toolUse) {
 *   console.log('Tool used:', toolUse.name)
 * }
 * ```
 */
export async function waitForEventType(
	messages: AsyncGenerator<SDKMessage>,
	eventType: string,
): Promise<SDKMessage | null> {
	for await (const message of messages) {
		if (message.type === eventType) {
			return message
		}
	}
	return null
}
