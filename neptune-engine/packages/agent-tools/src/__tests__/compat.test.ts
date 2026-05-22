import {describe, expect, test} from 'bun:test'
import type {
	CoreTool,
	ToolResult,
	ValidationResult,
	PermissionResult,
} from '@neptune/engine-tools'

describe('agent-tools compatibility', () => {
	test('CoreTool structural fixture works without host source imports', async () => {
		const fixtureTool: CoreTool = {
			name: 'test',
			aliases: [],
			searchHint: 'test tool',
			inputSchema: {} as CoreTool['inputSchema'],
			async call(): Promise<ToolResult<string>> {
				return {data: 'ok'}
			},
			async description() {
				return 'test'
			},
			async prompt() {
				return 'test prompt'
			},
			isConcurrencySafe: () => false,
			isEnabled: () => true,
			isReadOnly: () => false,
			async checkPermissions(): Promise<PermissionResult> {
				return {behavior: 'allow', updatedInput: {}}
			},
			toAutoClassifierInput: () => '',
			userFacingName: () => 'test',
			maxResultSizeChars: 100000,
			mapToolResultToToolResultBlockParam: () => ({
				type: 'tool_result',
				tool_use_id: '1',
				content: 'ok',
			}),
		}

		const validation: ValidationResult = {result: true}
		const result = await fixtureTool.call({}, {}, async () => validation, {})

		expect(fixtureTool.name).toBe('test')
		expect(fixtureTool.isEnabled()).toBe(true)
		expect(result.data).toBe('ok')
	})
})
