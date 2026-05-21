/**
 * collectText() — 从 query() 流中收集所有文本内容的便捷方法
 *
 * 这个辅助函数会遍历整个 AsyncGenerator，提取所有 assistant 消息中的文本内容，
 * 合并成完整字符串返回。适用于只需要最终文本响应的场景。
 */

import type {SDKMessage} from '../types/query-events'

/**
 * 从 SDKMessage 中提取文本内容
 *
 * @param message SDK 原始消息
 * @returns 提取的文本字符串，无法提取时返回空字符串
 */
function extractTextFromMessage(message: SDKMessage): string {
	const {type, content} = message

	// 处理 assistant 消息的文本内容
	if (type === 'assistant') {
		// content 可能是字符串或 ContentBlock[]，尝试转换为文本
		if (typeof content === 'string') {
			return content
		}
		if (Array.isArray(content)) {
			// ContentBlock[] 格式，提取 text 类型的块
			return content
				.filter((block: unknown) => typeof block === 'object' && block !== null && (block as {
					type: string
				}).type === 'text')
				.map((block: unknown) => {
					const textBlock = block as { text?: string }
					return textBlock.text || ''
				})
				.join('')
		}
	}

	// 其他消息类型不产生文本内容
	return ''
}

/**
 * collectText — 从 query() 流中收集所有文本内容
 *
 * @param messages query() 返回的 AsyncGenerator
 * @returns Promise<string> 所有文本内容的拼接结果
 *
 * @example
 * ```ts
 * const engine = AgentEngine.create(config)
 * const sessionId = await engine.createSession({ workspace: '/tmp/ws' })
 *
 * const messages = engine.query(sessionId, 'Say hello')
 * const fullText = await collectText(messages)
 * console.log(fullText) // "Hello! How can I help you today?"
 * ```
 */
export async function collectText(messages: AsyncGenerator<SDKMessage>): Promise<string> {
	const texts: string[] = []

	for await (const message of messages) {
		const text = extractTextFromMessage(message)
		if (text) {
			texts.push(text)
		}
	}

	return texts.join('')
}

/**
 * collectTextWithMeta — 收集文本并返回元数据
 *
 * 除了文本内容外，还返回消息数量、类型分布等统计信息。
 * 适用于需要了解响应结构的场景。
 *
 * @param messages query() 返回的 AsyncGenerator
 * @returns Promise 包含文本和元数据的对象
 *
 * @example
 * ```ts
 * const messages = engine.query(sessionId, 'List files')
 * const { text, metadata } = await collectTextWithMeta(messages)
 * console.log(`Received ${metadata.messageCount} messages`)
 * console.log(`Text: ${text}`)
 * ```
 */
export async function collectTextWithMeta(messages: AsyncGenerator<SDKMessage>): Promise<{
	text: string
	metadata: {
		messageCount: number
		typeCounts: Record<string, number>
	}
}> {
	const texts: string[] = []
	let messageCount = 0
	const typeCounts: Record<string, number> = {}

	for await (const message of messages) {
		messageCount++
		const messageType = message.type
		typeCounts[messageType] = (typeCounts[messageType] || 0) + 1

		const text = extractTextFromMessage(message)
		if (text) {
			texts.push(text)
		}
	}

	return {
		text: texts.join(''),
		metadata: {
			messageCount,
			typeCounts,
		},
	}
}
