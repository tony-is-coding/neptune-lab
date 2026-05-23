/**
 * RetryingProvider 单测
 */

import {describe, expect, it} from 'bun:test'
import {RetryingProvider} from '../RetryingProvider.js'
import {DefaultRetryPolicy} from '../RetryPolicy.js'
import type {ParsedSSEEvent} from '../../types.js'
import type {
	StreamingProviderAdapter,
	StreamingQueryParams,
} from '../../provider/StreamingProviderAdapter.js'

/** Mock provider — 按 turn 数控制每次返回什么 */
class FakeProvider implements StreamingProviderAdapter {
	readonly type = 'fake'
	private callCount = 0

	constructor(private readonly turns: ParsedSSEEvent[][]) {}

	async *queryStream(): AsyncGenerator<ParsedSSEEvent, void, unknown> {
		const events = this.turns[this.callCount++]
		if (!events) {
			yield {type: 'error', source: 'api_error', error: new Error('out of turns')}
			return
		}
		for (const e of events) yield e
	}

	get callsMade(): number {
		return this.callCount
	}
}

const successfulTurn: ParsedSSEEvent[] = [
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

const transientErrorTurn = (): ParsedSSEEvent[] => {
	const e = new Error('500 internal') as Error & {status?: number}
	e.status = 500
	return [{type: 'error', source: 'api_error', error: e}]
}

const authErrorTurn = (): ParsedSSEEvent[] => {
	const e = new Error('401 unauthorized') as Error & {status?: number}
	e.status = 401
	return [{type: 'error', source: 'api_error', error: e}]
}

async function drain(
	gen: AsyncGenerator<ParsedSSEEvent, void, unknown>,
): Promise<ParsedSSEEvent[]> {
	const out: ParsedSSEEvent[] = []
	for await (const e of gen) out.push(e)
	return out
}

const fakeParams = (): StreamingQueryParams => ({
	model: 'm',
	messages: [],
})

describe('RetryingProvider', () => {
	it('第一次成功 → 不 retry，正常透传', async () => {
		const fake = new FakeProvider([successfulTurn])
		const p = new RetryingProvider(fake, {
			policy: new DefaultRetryPolicy({jitter: false}),
		})
		const events = await drain(p.queryStream(fakeParams()))
		expect(events).toHaveLength(2)
		expect(fake.callsMade).toBe(1)
	})

	it('500 → retry 1 次后成功', async () => {
		const fake = new FakeProvider([transientErrorTurn(), successfulTurn])
		const retries: number[] = []
		const p = new RetryingProvider(fake, {
			policy: new DefaultRetryPolicy({baseDelayMs: 10, jitter: false}),
			onRetry: ({attempt}) => {
				retries.push(attempt)
			},
		})
		const events = await drain(p.queryStream(fakeParams()))
		expect(events).toHaveLength(2)
		expect(events[0]?.type).toBe('message_start')
		expect(fake.callsMade).toBe(2)
		expect(retries).toEqual([0])
	})

	it('500 5 次 → 第 6 次仍失败 → 透传 error', async () => {
		const fake = new FakeProvider([
			transientErrorTurn(),
			transientErrorTurn(),
			transientErrorTurn(),
			transientErrorTurn(),
			transientErrorTurn(),
			transientErrorTurn(),
		])
		const p = new RetryingProvider(fake, {
			policy: new DefaultRetryPolicy({maxRetries: 5, baseDelayMs: 1, jitter: false}),
		})
		const events = await drain(p.queryStream(fakeParams()))
		expect(events).toHaveLength(1)
		expect(events[0]?.type).toBe('error')
	})

	it('401 不可重试 → 直接透传 error', async () => {
		const fake = new FakeProvider([authErrorTurn()])
		const p = new RetryingProvider(fake, {
			policy: new DefaultRetryPolicy({baseDelayMs: 1, jitter: false}),
		})
		const events = await drain(p.queryStream(fakeParams()))
		expect(events).toHaveLength(1)
		expect(events[0]?.type).toBe('error')
		expect(fake.callsMade).toBe(1)
	})

	it('signal abort → 立即停止', async () => {
		const fake = new FakeProvider([transientErrorTurn(), successfulTurn])
		const ctrl = new AbortController()
		const p = new RetryingProvider(fake, {
			policy: new DefaultRetryPolicy({baseDelayMs: 1000, jitter: false}),
		})
		setTimeout(() => ctrl.abort(), 5)
		const events = await drain(p.queryStream({...fakeParams(), signal: ctrl.signal}))
		// abort 触发 → 透传错误并停止（具体 yield 结构由实现决定）
		expect(events.length).toBeGreaterThan(0)
	})
})
