/**
 * StreamWatchdog — 流卡死自救
 *
 * 算法纲要（参考 cc claude.ts 1944-2010 stream watchdog 段）：
 *
 *   - 每个 SSE 事件到达时 reset 定时器
 *   - 超过 idleTimeoutMs 没事件 → emit api_error + 退出 generator
 *   - 超过 stallWarningMs 没事件 → 调 onStall（默认 no-op）
 *
 * 设计原则：
 * - 用 Promise.race 让"下个事件"和"timer 触发"竞争，timer 赢就 emit error
 * - per-stream 实例，不共享 timer
 * - 可注入 CancellationToken：watchdog 触发时记录 reason='watchdog'
 *
 * 默认值（可注入覆盖）：
 *   - idleTimeoutMs: 90_000
 *   - stallWarningMs: 30_000（idle 的 1/3）
 *
 * 不抄 cc 的 streamWatchdogFiredAt 字段（用 CancellationToken.cancellationInfo 替代）
 */

import type {ParsedSSEEvent} from '../types.js'
import type {CancellationToken} from '../cancellation/CancellationToken.js'

export interface StreamWatchdogOptions {
	/** 多久没事件视为 idle（ms）。默认 90_000。 */
	idleTimeoutMs?: number
	/** 多久警告 stall（ms）。默认 30_000。 */
	stallWarningMs?: number
	/** stall 警告回调（idle 还在继续）。 */
	onStall?: (info: {elapsedSinceLastEventMs: number}) => void | Promise<void>
	/** abort 实际触发的回调（用于 logging）。 */
	onWatchdogAbort?: (info: {idleMs: number}) => void | Promise<void>
	/** CancellationToken 来源（用于级联 abort）。 */
	cancellation?: CancellationToken
}

const TIMER_TRIGGERED = Symbol('watchdog-timer-triggered')

/**
 * 包一层 stream 加 watchdog。
 */
export async function* withStreamWatchdog(
	stream: AsyncIterable<ParsedSSEEvent>,
	options: StreamWatchdogOptions = {},
): AsyncGenerator<ParsedSSEEvent, void, unknown> {
	const idleTimeoutMs = options.idleTimeoutMs ?? 90_000
	const stallWarningMs = options.stallWarningMs ?? 30_000

	const iterator = stream[Symbol.asyncIterator]()
	let stallTimer: ReturnType<typeof setTimeout> | null = null
	let idleTimer: ReturnType<typeof setTimeout> | null = null

	const clearTimers = () => {
		if (stallTimer !== null) {
			clearTimeout(stallTimer)
			stallTimer = null
		}
		if (idleTimer !== null) {
			clearTimeout(idleTimer)
			idleTimer = null
		}
	}

	type TimerWin = typeof TIMER_TRIGGERED
	type NextResult = IteratorResult<ParsedSSEEvent>

	const nextWithRace = (): Promise<NextResult | TimerWin> => {
		clearTimers()
		const winner = new Promise<TimerWin>(resolve => {
			if (stallWarningMs > 0) {
				stallTimer = setTimeout(() => {
					if (options.onStall) {
						Promise.resolve(
							options.onStall({elapsedSinceLastEventMs: stallWarningMs}),
						).catch(() => {
							/* 静默 hook 错误 */
						})
					}
				}, stallWarningMs)
			}
			if (idleTimeoutMs > 0) {
				idleTimer = setTimeout(() => {
					resolve(TIMER_TRIGGERED)
				}, idleTimeoutMs)
			}
		})
		return Promise.race([iterator.next() as Promise<NextResult>, winner])
	}

	try {
		while (true) {
			const result = await nextWithRace()
			if (result === TIMER_TRIGGERED) {
				if (options.cancellation) {
					options.cancellation.cancel('watchdog', `idle ${idleTimeoutMs}ms`)
				}
				if (options.onWatchdogAbort) {
					await Promise.resolve(
						options.onWatchdogAbort({idleMs: idleTimeoutMs}),
					).catch(() => {
						/* 静默 */
					})
				}
				yield {
					type: 'error',
					source: 'api_error',
					error: new Error(
						`Stream watchdog: idle for ${idleTimeoutMs}ms, aborting`,
					),
				}
				// 关掉 inner stream
				if (typeof iterator.return === 'function') {
					try {
						await iterator.return(undefined)
					} catch {
						/* 静默 */
					}
				}
				return
			}
			if (result.done) return
			yield result.value
		}
	} finally {
		clearTimers()
	}
}
