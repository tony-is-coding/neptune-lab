/**
 * StreamWatchdog 单测
 *
 * 用 generator 控制事件到达时机，验证：
 * - 每个事件按时到达 → 不触发
 * - idle 超过 idleTimeoutMs → emit api_error + 停止
 * - 超过 stallWarningMs → 调 onStall
 * - reset 计时器：每事件刷新
 */

import {describe, expect, it} from 'bun:test'
import {withStreamWatchdog} from '../StreamWatchdog.js'
import type {ParsedSSEEvent} from '../../types.js'
import {CancellationToken} from '../../cancellation/CancellationToken.js'

const successEvent: ParsedSSEEvent = {
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
}

/** 按延迟列表逐个 yield 的 mock stream。 */
async function* delayedStream(delays: number[]): AsyncGenerator<ParsedSSEEvent> {
	for (const ms of delays) {
		await new Promise(resolve => setTimeout(resolve, ms))
		yield successEvent
	}
}

async function drain(
	gen: AsyncGenerator<ParsedSSEEvent, void, unknown>,
): Promise<ParsedSSEEvent[]> {
	const out: ParsedSSEEvent[] = []
	for await (const e of gen) out.push(e)
	return out
}

describe('withStreamWatchdog', () => {
	it('事件按时到达 → 不触发 watchdog', async () => {
		const events = await drain(
			withStreamWatchdog(delayedStream([10, 10, 10]), {
				idleTimeoutMs: 100,
				stallWarningMs: 50,
			}),
		)
		expect(events).toHaveLength(3)
		expect(events.every(e => e.type === 'message_start')).toBe(true)
	})

	it('idle 超过 timeout → emit api_error + 停止', async () => {
		const events = await drain(
			withStreamWatchdog(delayedStream([100, 200]), {
				idleTimeoutMs: 50,
				stallWarningMs: 0,
			}),
		)
		// 触发后 emit 一个 error，stream 不再产出 message_start
		expect(events.some(e => e.type === 'error')).toBe(true)
		const error = events.find(e => e.type === 'error')!
		if (error.type === 'error') {
			expect(error.source).toBe('api_error')
			expect(error.error.message).toContain('idle')
		}
	})

	it('stallWarningMs 触发 onStall 回调', async () => {
		let stallCount = 0
		await drain(
			withStreamWatchdog(delayedStream([200]), {
				idleTimeoutMs: 300,
				stallWarningMs: 30,
				onStall: () => {
					stallCount++
				},
			}),
		)
		expect(stallCount).toBeGreaterThanOrEqual(1)
	})

	it('每事件 reset 计时器（多事件 idle 之间不累加）', async () => {
		// 3 个事件，每个间隔 30ms，idle 50ms → 不应触发（每次 reset）
		const events = await drain(
			withStreamWatchdog(delayedStream([30, 30, 30]), {
				idleTimeoutMs: 50,
				stallWarningMs: 0,
			}),
		)
		expect(events).toHaveLength(3)
		expect(events.find(e => e.type === 'error')).toBeUndefined()
	})

	it('注入 CancellationToken：watchdog 触发时调 cancel', async () => {
		const token = new CancellationToken()
		await drain(
			withStreamWatchdog(delayedStream([200]), {
				idleTimeoutMs: 30,
				cancellation: token,
			}),
		)
		expect(token.aborted).toBe(true)
		expect(token.cancellationInfo?.reason).toBe('watchdog')
	})

	it('onWatchdogAbort 回调收到 idleMs', async () => {
		let receivedIdle: number | undefined
		await drain(
			withStreamWatchdog(delayedStream([200]), {
				idleTimeoutMs: 50,
				onWatchdogAbort: ({idleMs}) => {
					receivedIdle = idleMs
				},
			}),
		)
		expect(receivedIdle).toBe(50)
	})

	it('idleTimeoutMs=0 关闭 watchdog', async () => {
		const events = await drain(
			withStreamWatchdog(delayedStream([200]), {
				idleTimeoutMs: 0,
			}),
		)
		expect(events).toHaveLength(1)
	})
})
