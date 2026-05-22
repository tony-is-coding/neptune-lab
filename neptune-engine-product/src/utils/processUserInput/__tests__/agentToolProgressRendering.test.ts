import {describe, expect, test} from 'bun:test'
import {renderToolUseProgressMessage} from '../agentToolProgressRendering.js'

describe('agentToolProgressRendering', () => {
	test('renders without progress messages', () => {
		const node = renderToolUseProgressMessage([], {tools: [], verbose: false})

		expect(node).toBeTruthy()
	})

	test('renders assistant text progress', () => {
		const node = renderToolUseProgressMessage(
			[
				{
					type: 'progress',
					uuid: 'progress-1',
					data: {
						type: 'agent_progress',
						message: {
							type: 'assistant',
							message: {
								content: [{type: 'text', text: 'Working on it'}],
							},
						},
					},
				} as never,
			],
			{tools: [], verbose: false},
		)

		expect(node).toBeTruthy()
	})

	test('renders assistant tool use progress', () => {
		const node = renderToolUseProgressMessage(
			[
				{
					type: 'progress',
					uuid: 'progress-1',
					data: {
						type: 'agent_progress',
						message: {
							type: 'assistant',
							message: {
								content: [
									{
										type: 'tool_use',
										id: 'toolu_1',
										name: 'Read',
										input: {file_path: 'README.md'},
									},
								],
							},
						},
					},
				} as never,
			],
			{tools: [], verbose: false},
		)

		expect(node).toBeTruthy()
	})
})
