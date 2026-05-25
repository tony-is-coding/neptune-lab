/**
 * AgentLoopObservability.test.ts — Stage 6 AgentLoop 集成 observability
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {AgentLoop} from '../AgentLoop.js'
import {createToolUseContext} from '../../dispatcher/ToolUseContext.js'
import {ScriptedProvider, textTurn, toolUseTurn} from './scriptedProvider.js'
import {InMemoryMetricsProvider, type ITracingProvider, type Span} from '../../../observability/index.js'
import {SpanStatus} from '../../../observability/index.js'
import type {Message} from '../../../types/message.js'
import type {Tool, ToolResult} from '../../../types/tool.js'
import type {LoopEvent} from '../loopEvents.js'

function userMsg(text: string): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: text},
	}
}

async function consume(
	gen: AsyncGenerator<LoopEvent, unknown, unknown>,
): Promise<{events: LoopEvent[]; result: unknown}> {
	const events: LoopEvent[] = []
	while (true) {
		const next = await gen.next()
		if (next.done) return {events, result: next.value}
		events.push(next.value as LoopEvent)
	}
}

class TestSpan implements Span {
	public events: Array<{name: string; attributes?: Record<string, unknown>}> = []
	public status: SpanStatus = SpanStatus.UNSET
	public ended = false
	constructor(public readonly name: string, public readonly attributes: Record<string, unknown> = {}) {}
	setStatus(status: SpanStatus): Span {
		this.status = status
		return this
	}
	addEvent(name: string, attributes?: Record<string, unknown>): Span {
		this.events.push({name, attributes})
		return this
	}
	end(): void {
		this.ended = true
	}
}

class TestTracingProvider implements ITracingProvider {
	public spans: TestSpan[] = []
	startSpan(name: string, attributes?: Record<string, unknown>): Span {
		const span = new TestSpan(name, attributes)
		this.spans.push(span)
		return span
	}
	runInSpan<T>(name: string, fn: (span: Span) => T): T {
		const span = this.startSpan(name)
		try {
			return fn(span)
		} finally {
			span.end()
		}
	}
}

describe('AgentLoop + Observability 集成', () => {
	it('单 turn run → root span 完整生命周期', async () => {
		const tracing = new TestTracingProvider()
		const metrics = new InMemoryMetricsProvider()
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = createToolUseContext()

		const {result} = await consume(
			AgentLoop.run({
				provider,
				messages: [userMsg('hi')],
				model: 'sonnet',
				context: ctx,
				tracingProvider: tracing,
				metricsProvider: metrics,
			}),
		)

		// Span 创建 + 结束
		expect(tracing.spans).toHaveLength(1)
		const root = tracing.spans[0]!
		expect(root.name).toBe('agent.run')
		expect(root.attributes.model).toBe('sonnet')
		expect(root.ended).toBe(true)
		expect(root.status).toBe(SpanStatus.OK)
		// 完成事件含 reason
		const completedEvent = root.events.find(e => e.name === 'run.completed')
		expect(completedEvent).toBeDefined()
		expect(completedEvent?.attributes?.reason).toBe('end_turn')

		// Metrics counter / histogram 都被记录
		const startedCounter = metrics.getMetric('agent.run.started')
		expect(startedCounter).toBeDefined()
		const endTurnCounter = metrics.getMetric('agent.run.end_turn')
		expect(endTurnCounter).toBeDefined()

		expect((result as {reason: string}).reason).toBe('end_turn')
	})

	it('error reason → span status=ERROR + exception event', async () => {
		const tracing = new TestTracingProvider()
		const metrics = new InMemoryMetricsProvider()
		const provider = new ScriptedProvider([
			[{type: 'error', source: 'api_error', error: new Error('api boom')}],
		])
		const ctx = createToolUseContext()

		await consume(
			AgentLoop.run({
				provider,
				messages: [userMsg('q')],
				model: 'sonnet',
				context: ctx,
				tracingProvider: tracing,
				metricsProvider: metrics,
			}),
		)

		const root = tracing.spans[0]!
		expect(root.status).toBe(SpanStatus.ERROR)
		const exceptionEvent = root.events.find(e => e.name === 'exception')
		expect(exceptionEvent).toBeDefined()
		expect(exceptionEvent?.attributes?.message).toBe('api boom')
		expect(metrics.getMetric('agent.run.error')).toBeDefined()
	})

	it('不传 tracingProvider / metricsProvider → 不影响 loop（向后兼容）', async () => {
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = createToolUseContext()
		const {result} = await consume(
			AgentLoop.run({
				provider,
				messages: [userMsg('hi')],
				model: 'm',
				context: ctx,
			}),
		)
		expect((result as {reason: string}).reason).toBe('end_turn')
	})

	it('tokens 累计写入 histogram', async () => {
		const metrics = new InMemoryMetricsProvider()
		const provider = new ScriptedProvider([
			textTurn('hi', 'sonnet', {input: 50, output: 30}),
		])
		const ctx = createToolUseContext()
		await consume(
			AgentLoop.run({
				provider,
				messages: [userMsg('q')],
				model: 'sonnet',
				context: ctx,
				metricsProvider: metrics,
			}),
		)
		const inputHist = metrics.getMetric('agent.run.tokens.input')
		expect(inputHist).toBeDefined()
	})
})
