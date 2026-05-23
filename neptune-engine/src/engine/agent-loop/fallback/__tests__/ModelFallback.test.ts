/**
 * ModelFallback 单测
 */

import {describe, expect, it} from 'bun:test'
import {FallbackProvider} from '../ModelFallback.js'
import type {ParsedSSEEvent} from '../../types.js'
import type {
	StreamingProviderAdapter,
	StreamingQueryParams,
} from '../../provider/StreamingProviderAdapter.js'

class TwoModelProvider implements StreamingProviderAdapter {
	readonly type = 'fake'
	public calls: string[] = []

	constructor(private readonly responses: Record<string, ParsedSSEEvent[]>) {}

	async *queryStream(
		params: StreamingQueryParams,
	): AsyncGenerator<ParsedSSEEvent, void, unknown> {
		this.calls.push(params.model)
		const events = this.responses[params.model]
		if (!events) {
			yield {
				type: 'error',
				source: 'api_error',
				error: new Error('unknown model'),
			}
			return
		}
		for (const e of events) yield e
	}
}

const successful: ParsedSSEEvent[] = [
	{
		type: 'message_start',
		message: {
			id: 'a',
			role: 'assistant',
			model: 'm',
			type: 'message',
			stop_reason: null,
			stop_sequence: null,
			usage: {
				input_tokens: 5,
				output_tokens: 1,
				cache_creation_input_tokens: 0,
				cache_read_input_tokens: 0,
			},
		},
	},
	{type: 'message_stop'},
]

function modelNotFound(): ParsedSSEEvent[] {
	const e = new Error('model not found') as Error & {status?: number}
	e.status = 404
	return [{type: 'error', source: 'api_error', error: e}]
}

function transient5xx(): ParsedSSEEvent[] {
	const e = new Error('overloaded') as Error & {status?: number}
	e.status = 503
	return [{type: 'error', source: 'api_error', error: e}]
}

function authError(): ParsedSSEEvent[] {
	const e = new Error('forbidden') as Error & {status?: number}
	e.status = 403
	return [{type: 'error', source: 'api_error', error: e}]
}

async function drain(
	gen: AsyncGenerator<ParsedSSEEvent, void, unknown>,
): Promise<ParsedSSEEvent[]> {
	const out: ParsedSSEEvent[] = []
	for await (const e of gen) out.push(e)
	return out
}

describe('FallbackProvider', () => {
	it('主 model 成功 → 不 fallback', async () => {
		const inner = new TwoModelProvider({primary: successful})
		const p = new FallbackProvider(inner, {fallbackModel: 'backup'})
		const events = await drain(p.queryStream({model: 'primary', messages: []}))
		expect(events).toHaveLength(2)
		expect(inner.calls).toEqual(['primary'])
	})

	it('主 model 404 model not found → fallback 切到 backup', async () => {
		const inner = new TwoModelProvider({
			primary: modelNotFound(),
			backup: successful,
		})
		const fallbackInfo: Array<{primaryModel: string; fallbackModel: string}> = []
		const p = new FallbackProvider(inner, {
			fallbackModel: 'backup',
			onFallback: info => {
				fallbackInfo.push({primaryModel: info.primaryModel, fallbackModel: info.fallbackModel})
			},
		})
		const events = await drain(p.queryStream({model: 'primary', messages: []}))
		expect(inner.calls).toEqual(['primary', 'backup'])
		expect(events).toHaveLength(2)
		expect(events[0]?.type).toBe('message_start')
		expect(fallbackInfo).toHaveLength(1)
		expect(fallbackInfo[0]?.fallbackModel).toBe('backup')
	})

	it('主 model 503 → fallback', async () => {
		const inner = new TwoModelProvider({
			primary: transient5xx(),
			backup: successful,
		})
		const p = new FallbackProvider(inner, {fallbackModel: 'backup'})
		const events = await drain(p.queryStream({model: 'primary', messages: []}))
		expect(inner.calls).toEqual(['primary', 'backup'])
		expect(events[0]?.type).toBe('message_start')
	})

	it('主 model 403（auth）→ 不 fallback，透传错误', async () => {
		const inner = new TwoModelProvider({
			primary: authError(),
			backup: successful,
		})
		const p = new FallbackProvider(inner, {fallbackModel: 'backup'})
		const events = await drain(p.queryStream({model: 'primary', messages: []}))
		expect(inner.calls).toEqual(['primary'])
		expect(events[0]?.type).toBe('error')
	})

	it('fallback model 也失败 → 透传错误（不再递归 fallback）', async () => {
		const inner = new TwoModelProvider({
			primary: modelNotFound(),
			backup: modelNotFound(),
		})
		const p = new FallbackProvider(inner, {fallbackModel: 'backup'})
		const events = await drain(p.queryStream({model: 'primary', messages: []}))
		expect(inner.calls).toEqual(['primary', 'backup'])
		// fallback 自己也是 error，不再递归
		expect(events[0]?.type).toBe('error')
	})
})
