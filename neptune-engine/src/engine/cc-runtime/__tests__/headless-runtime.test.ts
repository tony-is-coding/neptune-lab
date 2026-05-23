import {afterEach, describe, expect, test} from 'bun:test'
import {AgentEngine} from '../../AgentEngine.js'
import {createHeadlessCCRuntime} from '../DefaultCCRuntime.js'

describe('createHeadlessCCRuntime', () => {
	const originalFetch = globalThis.fetch

	afterEach(() => {
		globalThis.fetch = originalFetch
	})

	test('uses SDK tool registry without falling back to tools.ts', () => {
		const runtime = createHeadlessCCRuntime()
		const tools = runtime.getAllBaseTools()
		const toolNames = tools.map(tool => tool.name)

		expect(toolNames).toContain('Read')
		expect(toolNames).toContain('Write')
		expect(toolNames).toContain('Edit')
		expect(toolNames).toContain('Grep')
		expect(toolNames).toContain('TaskCreate')
		expect(toolNames).not.toContain('Config')
		expect(toolNames).not.toContain('EnterPlanMode')
	})

	test('installs a ToolRegistry adapter on the runtime', () => {
		const runtime = createHeadlessCCRuntime()

		expect(runtime.getToolRegistry?.()).toBeDefined()
		expect(runtime.getToolRegistry?.()?.getCoreToolCount()).toBeGreaterThan(0)
	})

	test('runs a headless query without loading CLI QueryEngine or UI modules', async () => {
		globalThis.fetch = async () =>
			new Response(
				[
					'event: content_block_delta',
					'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}',
					'',
					'event: content_block_delta',
					'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}',
					'',
				].join('\n'),
				{
					status: 200,
					headers: {'content-type': 'text/event-stream'},
				},
			)

		const engine = AgentEngine.create(
			{
				systemPrompt: 'You are a test assistant.',
				provider: {type: 'anthropic', config: {apiKey: 'test-key'}},
				extensions: {permissions: {bypassPermissions: true}},
				options: {maxTurns: 1},
			},
			createHeadlessCCRuntime(),
		)
		const sessionId = await engine.createSession({
			workspace: '/tmp/neptune-headless-test',
		})

		const events = []
		for await (const event of engine.query(sessionId, 'ping')) {
			events.push(event)
		}
		await engine.destroy()

		expect(events.map(event => (event as {type: string}).type)).toEqual([
			'system',
			'stream_event',
			'stream_event',
			'assistant',
			'result',
		])
		expect(
			events
				.filter(event => (event as {type: string}).type === 'stream_event')
				.map(
					event =>
						(event as {event: {delta: {text: string}}}).event.delta.text,
				)
				.join(''),
		).toBe('hello world')
	})
})
