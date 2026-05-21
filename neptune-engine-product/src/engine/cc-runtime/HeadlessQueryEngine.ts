import {randomUUID} from 'crypto'
import type {QueryEngineConfig, QueryEngineWrapper} from './CCRuntime.js'
import type {Message} from '../../types/message.js'
import type {ProviderConfig} from '../AgentEngine.js'
import {LogUtil} from '../log'

export class HeadlessQueryEngine implements QueryEngineWrapper {
	constructor(private readonly config: QueryEngineConfig) {}

	async* submitMessage(input: unknown): AsyncGenerator<unknown, void, unknown> {
		const content = String(input ?? '')
		const provider = this.getProvider()

		const model =
			String(this.config.userSpecifiedModel ?? '') ||
			String(provider?.config?.model ?? '') ||
			String(provider?.config?.defaultModel ?? '') ||
			'claude-sonnet-4-20250514'
		const systemPrompt = this.resolveSystemPrompt()
		const messages = this.buildMessages(content)

		yield {
			type: 'system',
			subtype: 'init',
			session_id: randomUUID(),
			model,
		}

		let assistantText = ''
		try {
			for await (const message of this.streamAnthropic({
				model,
				messages,
				systemPrompt,
				signal: this.config.abortController?.signal,
				provider,
			})) {
				if (message.type === 'text_delta') {
					const text = message.text
					assistantText += text
					yield {
						type: 'stream_event',
						event: {
							type: 'content_block_delta',
							delta: {
								type: 'text_delta',
								text,
							},
						},
					}
					continue
				}
			}
		} catch (error) {
			LogUtil.warn('[HeadlessQueryEngine] provider query failed:', {
				detail: (error as Error).message,
			})
			yield {
				type: 'error',
				error: error instanceof Error ? error.message : String(error),
			}
			return
		}

		if (assistantText) {
			yield {
				type: 'assistant',
				message: {
					role: 'assistant',
					content: [{type: 'text', text: assistantText}],
				},
				uuid: randomUUID(),
				timestamp: new Date().toISOString(),
			}
		}

		yield {
			type: 'result',
			subtype: 'success',
			is_error: false,
			result: assistantText,
		}
	}

	private resolveSystemPrompt(): string | undefined {
		if (typeof this.config.customSystemPrompt === 'string') {
			return this.config.customSystemPrompt
		}
		if (typeof this.config.appendSystemPrompt === 'string') {
			return this.config.appendSystemPrompt
		}
		return undefined
	}

	private buildMessages(content: string): Message[] {
		const message: Message = {
			type: 'user',
			message: {
				role: 'user',
				content,
			},
			uuid: randomUUID(),
			timestamp: new Date().toISOString(),
		}
		return [message]
	}

	private getProvider(): ProviderConfig | undefined {
		return (this.config as unknown as {provider?: ProviderConfig}).provider
	}

	private async* streamAnthropic({
		model,
		messages,
		systemPrompt,
		signal,
		provider,
	}: {
		model: string
		messages: Message[]
		systemPrompt?: string
		signal?: AbortSignal
		provider?: ProviderConfig
	}): AsyncGenerator<{type: 'text_delta'; text: string}, void, unknown> {
		const apiKey =
			typeof provider?.config?.apiKey === 'string'
				? provider.config.apiKey
				: process.env.ANTHROPIC_API_KEY
		if (!apiKey) {
			throw new Error('ANTHROPIC_API_KEY is required for headless query engine')
		}

		const baseURL =
			typeof provider?.config?.baseURL === 'string'
				? provider.config.baseURL.replace(/\/$/, '')
				: 'https://api.anthropic.com'
		const response = await fetch(`${baseURL}/v1/messages`, {
			method: 'POST',
			signal,
			headers: {
				'content-type': 'application/json',
				'anthropic-version': '2023-06-01',
				'x-api-key': apiKey,
			},
			body: JSON.stringify({
				model,
				max_tokens: 4096,
				stream: true,
				...(systemPrompt ? {system: systemPrompt} : {}),
				messages: messages.map(message => ({
					role: 'user',
					content: String(message.message?.content ?? ''),
				})),
			}),
		})

		if (!response.ok || !response.body) {
			const body = await response.text().catch(() => '')
			throw new Error(
				`Anthropic headless request failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`,
			)
		}

		const decoder = new TextDecoder()
		let buffer = ''
		const parseFrame = (frame: string): {type: 'text_delta'; text: string} | null => {
			const data = frame
				.split('\n')
				.filter(line => line.startsWith('data:'))
				.map(line => line.slice(5).trim())
				.join('\n')
			if (!data || data === '[DONE]') return null
			const event = JSON.parse(data) as {
				type?: string
				delta?: {type?: string; text?: string}
				error?: {message?: string}
			}
			if (event.type === 'error') {
				throw new Error(event.error?.message ?? 'Anthropic stream error')
			}
			if (event.delta?.type === 'text_delta' && event.delta.text) {
				return {type: 'text_delta', text: event.delta.text}
			}
			return null
		}

		for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
			buffer += decoder.decode(chunk, {stream: true})
			let boundary = buffer.indexOf('\n\n')
			while (boundary !== -1) {
				const frame = buffer.slice(0, boundary)
				buffer = buffer.slice(boundary + 2)
				const parsed = parseFrame(frame)
				if (parsed) yield parsed
				boundary = buffer.indexOf('\n\n')
			}
		}
		const tail = buffer.trim()
		if (tail) {
			const parsed = parseFrame(tail)
			if (parsed) yield parsed
		}
	}
}
