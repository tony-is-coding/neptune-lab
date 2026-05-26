/**
 * AnthropicStreamingProvider 集成测试
 *
 * 用注入的 mock SDK client 验证：
 * - apiKey 缺失 → emit error
 * - 序列化后正确传给 SDK params
 * - SDK 返回的 stream 通过 SSEParser 转成 ParsedSSEEvent
 * - SDK throw → emit error (api_error)
 * - signal 透传
 */

import {describe, expect, it, beforeEach, afterEach} from 'bun:test'
import {AnthropicStreamingProvider} from '../AnthropicStreamingProvider.js'
import type {ParsedSSEEvent} from '../../types.js'
import type {RawSSEEvent} from '../../sse/sseEvents.js'
import {textOnlyFixture} from '../../sse/__tests__/fixtures/text-only.js'
import {randomUUID} from 'crypto'
import type {Message} from '../../../types/message.js'

function userMsg(text: string): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: text},
	}
}

async function* fromArray(arr: RawSSEEvent[]): AsyncGenerator<RawSSEEvent> {
	for (const e of arr) yield e
}

async function drain(gen: AsyncGenerator<ParsedSSEEvent>): Promise<ParsedSSEEvent[]> {
	const out: ParsedSSEEvent[] = []
	for await (const e of gen) out.push(e)
	return out
}

/**
 * 生产 mock SDK client：实现最小的 beta.messages.create 接口。
 */
function makeMockClient(opts: {
	stream?: RawSSEEvent[]
	throwOnCreate?: Error
	captureCall?: (params: unknown, options: unknown) => void
}) {
	return {
		beta: {
			messages: {
				async create(params: unknown, options: unknown) {
					opts.captureCall?.(params, options)
					if (opts.throwOnCreate) throw opts.throwOnCreate
					return fromArray(opts.stream ?? [])
				},
			},
		},
	} as unknown as ConstructorParameters<typeof AnthropicStreamingProvider>[1] extends infer F
		? F extends (opts: infer O) => infer R
			? R
			: never
		: never
}

describe('AnthropicStreamingProvider', () => {
	const originalEnv = process.env.ANTHROPIC_API_KEY

	beforeEach(() => {
		// 测试都通过 config 注入 apiKey，env 清空避免污染
		delete process.env.ANTHROPIC_API_KEY
	})

	afterEach(() => {
		if (originalEnv !== undefined) process.env.ANTHROPIC_API_KEY = originalEnv
	})

	it('apiKey 缺失 → emit error (api_error)', async () => {
		const provider = new AnthropicStreamingProvider({}, () => makeMockClient({}) as never)
		const events = await drain(
			provider.queryStream({
				model: 'claude-sonnet-4-20250514',
				messages: [userMsg('hi')],
			}),
		)
		expect(events).toHaveLength(1)
		expect(events[0]).toMatchObject({type: 'error', source: 'api_error'})
		if (events[0].type === 'error') {
			expect(events[0].error.message).toContain('ANTHROPIC_API_KEY')
		}
	})

	it('config.apiKey 注入后能跑通完整 SSE 流', async () => {
		let capturedParams: Record<string, unknown> | undefined
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-test'},
			() =>
				makeMockClient({
					stream: textOnlyFixture,
					captureCall: p => {
						capturedParams = p as Record<string, unknown>
					},
				}) as never,
		)
		const events = await drain(
			provider.queryStream({
				model: 'claude-sonnet-4-20250514',
				messages: [userMsg('what is 3+5?')],
			}),
		)
		const types = events.map(e => e.type)
		expect(types).toEqual(['message_start', 'content_block_complete', 'message_delta', 'message_stop'])
		expect(capturedParams?.stream).toBe(true)
		expect(capturedParams?.model).toBe('claude-sonnet-4-20250514')
		expect(capturedParams?.max_tokens).toBe(4096)
		expect(capturedParams?.messages).toEqual([{role: 'user', content: 'what is 3+5?'}])
	})

	it('systemPrompt 透传给 SDK', async () => {
		let capturedParams: Record<string, unknown> | undefined
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-test'},
			() =>
				makeMockClient({
					stream: textOnlyFixture,
					captureCall: p => {
						capturedParams = p as Record<string, unknown>
					},
				}) as never,
		)
		await drain(
			provider.queryStream({
				model: 'm',
				messages: [userMsg('hi')],
				systemPrompt: 'you are helpful',
			}),
		)
		expect(capturedParams?.system).toBe('you are helpful')
	})

	it('resolvedTools 透传给 SDK', async () => {
		let capturedParams: Record<string, unknown> | undefined
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-test'},
			() =>
				makeMockClient({
					stream: textOnlyFixture,
					captureCall: p => {
						capturedParams = p as Record<string, unknown>
					},
				}) as never,
		)
		const tool = {
			name: 'TestTool',
			description: 'd',
			input_schema: {type: 'object'},
		} as never
		await drain(
			provider.queryStream({
				model: 'm',
				messages: [userMsg('hi')],
				resolvedTools: [tool],
			}),
		)
		expect(capturedParams?.tools).toEqual([tool])
	})

	it('extra 字段透传给 SDK（caching breakpoints / beta flags 用）', async () => {
		let capturedParams: Record<string, unknown> | undefined
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-test'},
			() =>
				makeMockClient({
					stream: textOnlyFixture,
					captureCall: p => {
						capturedParams = p as Record<string, unknown>
					},
				}) as never,
		)
		await drain(
			provider.queryStream({
				model: 'm',
				messages: [userMsg('hi')],
				extra: {anthropic_beta: ['some-flag']},
			}),
		)
		expect(capturedParams?.anthropic_beta).toEqual(['some-flag'])
	})

	it('signal 透传给 SDK options', async () => {
		let capturedOptions: Record<string, unknown> | undefined
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-test'},
			() =>
				makeMockClient({
					stream: textOnlyFixture,
					captureCall: (_p, o) => {
						capturedOptions = o as Record<string, unknown>
					},
				}) as never,
		)
		const ctrl = new AbortController()
		await drain(
			provider.queryStream({
				model: 'm',
				messages: [userMsg('hi')],
				signal: ctrl.signal,
			}),
		)
		expect(capturedOptions?.signal).toBe(ctrl.signal)
	})

	it('SDK throw → emit error (api_error)', async () => {
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-test'},
			() =>
				makeMockClient({
					throwOnCreate: new Error('Network kaboom'),
				}) as never,
		)
		const events = await drain(
			provider.queryStream({model: 'm', messages: [userMsg('hi')]}),
		)
		expect(events).toHaveLength(1)
		expect(events[0]).toMatchObject({type: 'error', source: 'api_error'})
		if (events[0].type === 'error') {
			expect(events[0].error.message).toContain('Network kaboom')
		}
	})

	it('serializer 抛错（thinking 缺 signature）→ emit error (api_error)', async () => {
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-test'},
			() => makeMockClient({stream: []}) as never,
		)
		const badAssistant: Message = {
			type: 'assistant',
			uuid: randomUUID() as unknown as Message['uuid'],
			message: {
				role: 'assistant',
				content: [{type: 'thinking', thinking: 'no sig', signature: ''}] as never,
			},
		}
		const events = await drain(
			provider.queryStream({
				model: 'm',
				messages: [userMsg('hi'), badAssistant, userMsg('continue')],
			}),
		)
		const error = events.find(e => e.type === 'error')!
		expect(error).toMatchObject({type: 'error', source: 'api_error'})
		if (error.type === 'error') {
			expect(error.error.message).toContain('thinking blocks without signature')
		}
	})

	it('config.defaultModel 兜底（query params model 为空时）', async () => {
		let capturedParams: Record<string, unknown> | undefined
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-test', defaultModel: 'claude-3-5-sonnet-20241022'},
			() =>
				makeMockClient({
					stream: textOnlyFixture,
					captureCall: p => {
						capturedParams = p as Record<string, unknown>
					},
				}) as never,
		)
		await drain(
			provider.queryStream({
				model: '',
				messages: [userMsg('hi')],
			}),
		)
		expect(capturedParams?.model).toBe('claude-3-5-sonnet-20241022')
	})

	it('env apiKey 兜底（config 未提供）', async () => {
		process.env.ANTHROPIC_API_KEY = 'sk-env'
		let capturedClientOptions: Record<string, unknown> | undefined
		const provider = new AnthropicStreamingProvider({}, opts => {
			capturedClientOptions = opts as Record<string, unknown>
			return makeMockClient({stream: textOnlyFixture}) as never
		})
		await drain(
			provider.queryStream({model: 'm', messages: [userMsg('hi')]}),
		)
		expect(capturedClientOptions?.apiKey).toBe('sk-env')
	})

	it('model 完全缺失 → emit error (CONFIGURATION_ERROR)', async () => {
		// Batch 0.1.A: substrate 不再硬编码默认 model
		// query.params.model='' && config.defaultModel 缺失 → emit error，禁止隐式兜底
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-test'}, // 无 defaultModel
			() => makeMockClient({stream: textOnlyFixture}) as never,
		)
		const events = await drain(
			provider.queryStream({
				model: '', // 显式空
				messages: [userMsg('hi')],
			}),
		)
		expect(events).toHaveLength(1)
		expect(events[0]).toMatchObject({type: 'error', source: 'api_error'})
		if (events[0].type === 'error') {
			expect(events[0].error.message.toLowerCase()).toContain('model')
		}
	})

	it('config.baseURL 注入 SDK client options', async () => {
		let capturedClientOptions: Record<string, unknown> | undefined
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-test', baseURL: 'https://proxy.example.com'},
			opts => {
				capturedClientOptions = opts as Record<string, unknown>
				return makeMockClient({stream: textOnlyFixture}) as never
			},
		)
		await drain(
			provider.queryStream({model: 'm', messages: [userMsg('hi')]}),
		)
		expect(capturedClientOptions?.baseURL).toBe('https://proxy.example.com')
	})

	it('config.authToken 注入 SDK client options（Bearer 第三方网关支持）', async () => {
		// 第三方 anthropic-compatible 网关（OpenCode Go / Vercel AI Gateway / OpenRouter / 等）
		// 通常用 Authorization: Bearer <token>，由 SDK 通过 authToken 字段控制
		let capturedClientOptions: Record<string, unknown> | undefined
		const provider = new AnthropicStreamingProvider(
			{authToken: 'oc-go-key-abc', baseURL: 'https://opencode.ai/zen/go/v1'},
			opts => {
				capturedClientOptions = opts as Record<string, unknown>
				return makeMockClient({stream: textOnlyFixture}) as never
			},
		)
		await drain(
			provider.queryStream({model: 'minimax-m2.7', messages: [userMsg('hi')]}),
		)
		expect(capturedClientOptions?.authToken).toBe('oc-go-key-abc')
		// authToken 路径下不应自动 fallback 到 apiKey（避免 SDK 同时设置两个 header）
		expect(capturedClientOptions?.apiKey).toBeUndefined()
		expect(capturedClientOptions?.baseURL).toBe('https://opencode.ai/zen/go/v1')
	})

	it('env ANTHROPIC_AUTH_TOKEN 兜底（config 未提供）', async () => {
		const ORIG_AUTH = process.env.ANTHROPIC_AUTH_TOKEN
		process.env.ANTHROPIC_AUTH_TOKEN = 'env-bearer-token'
		try {
			let capturedClientOptions: Record<string, unknown> | undefined
			const provider = new AnthropicStreamingProvider({}, opts => {
				capturedClientOptions = opts as Record<string, unknown>
				return makeMockClient({stream: textOnlyFixture}) as never
			})
			await drain(
				provider.queryStream({model: 'm', messages: [userMsg('hi')]}),
			)
			expect(capturedClientOptions?.authToken).toBe('env-bearer-token')
			expect(capturedClientOptions?.apiKey).toBeUndefined()
		} finally {
			if (ORIG_AUTH !== undefined) process.env.ANTHROPIC_AUTH_TOKEN = ORIG_AUTH
			else delete process.env.ANTHROPIC_AUTH_TOKEN
		}
	})

	it('apiKey 与 authToken 同时设时：authToken 优先（与 SDK 行为一致，避免两个认证 header）', async () => {
		let capturedClientOptions: Record<string, unknown> | undefined
		const provider = new AnthropicStreamingProvider(
			{apiKey: 'sk-anth', authToken: 'gw-bearer'},
			opts => {
				capturedClientOptions = opts as Record<string, unknown>
				return makeMockClient({stream: textOnlyFixture}) as never
			},
		)
		await drain(
			provider.queryStream({model: 'm', messages: [userMsg('hi')]}),
		)
		expect(capturedClientOptions?.authToken).toBe('gw-bearer')
		expect(capturedClientOptions?.apiKey).toBeUndefined()
	})

	it('authToken / apiKey / env 全部缺失 → emit error (api_error)', async () => {
		const ORIG_KEY = process.env.ANTHROPIC_API_KEY
		const ORIG_AUTH = process.env.ANTHROPIC_AUTH_TOKEN
		delete process.env.ANTHROPIC_API_KEY
		delete process.env.ANTHROPIC_AUTH_TOKEN
		try {
			const provider = new AnthropicStreamingProvider({}, () => makeMockClient({}) as never)
			const events = await drain(
				provider.queryStream({model: 'm', messages: [userMsg('hi')]}),
			)
			expect(events).toHaveLength(1)
			expect(events[0]).toMatchObject({type: 'error', source: 'api_error'})
			if (events[0].type === 'error') {
				const m = events[0].error.message
				expect(m).toMatch(/ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|authToken|apiKey/)
			}
		} finally {
			if (ORIG_KEY !== undefined) process.env.ANTHROPIC_API_KEY = ORIG_KEY
			if (ORIG_AUTH !== undefined) process.env.ANTHROPIC_AUTH_TOKEN = ORIG_AUTH
		}
	})
})
