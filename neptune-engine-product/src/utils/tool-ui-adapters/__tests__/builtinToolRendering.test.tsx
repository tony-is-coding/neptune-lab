import {describe, expect, test} from 'bun:test'
import {join} from 'path'

const {getBuiltinToolUiOverrides} = await import('../builtinToolRendering.js')

describe('built-in tool product UI rendering', () => {
	test('provides product UI overrides for Grep', () => {
		const overrides = getBuiltinToolUiOverrides('Grep')
		const pathInCwd = join(process.cwd(), 'neptune-engine')

		expect(overrides.userFacingName?.()).toBe('Search')
		expect(
			overrides.renderToolUseMessage?.(
				{pattern: 'TODO', path: '/tmp/project/src'},
				{verbose: true},
			),
		).toBe('pattern: "TODO", path: "/tmp/project/src"')
		expect(overrides.renderToolUseErrorMessage).toBeFunction()
		expect(overrides.renderToolResultMessage).toBeFunction()
		expect(
			overrides.renderToolUseMessage?.(
				{pattern: 'TODO', path: pathInCwd},
				{verbose: false},
			),
		).toBe('pattern: "TODO", path: "neptune-engine"')
	})

	test('provides product UI overrides for Glob', () => {
		const overrides = getBuiltinToolUiOverrides('Glob')
		const pathInCwd = join(process.cwd(), 'neptune-engine-product')

		expect(overrides.userFacingName?.()).toBe('Search')
		expect(
			overrides.renderToolUseMessage?.(
				{pattern: '**/*.ts', path: '/tmp/project/src'},
				{verbose: true},
			),
		).toBe('pattern: "**/*.ts", path: "/tmp/project/src"')
		expect(overrides.renderToolUseErrorMessage).toBeFunction()
		expect(overrides.renderToolResultMessage).toBeFunction()
		expect(
			overrides.renderToolUseMessage?.(
				{pattern: '**/*.ts', path: pathInCwd},
				{verbose: false},
			),
		).toBe('pattern: "**/*.ts", path: "neptune-engine-product"')
	})

	test('provides complete product UI overrides for TaskOutput', () => {
		const overrides = getBuiltinToolUiOverrides('TaskOutput')

		expect(overrides.renderToolUseTag).toBeFunction()
		expect(overrides.renderToolUseProgressMessage).toBeFunction()
		expect(overrides.renderToolResultMessage).toBeFunction()
		expect(overrides.renderToolUseRejectedMessage).toBeFunction()
		expect(overrides.renderToolUseErrorMessage).toBeFunction()
	})

	test('provides product UI overrides for SendUserMessage aliases', () => {
		for (const toolName of ['SendUserMessage', 'Brief']) {
			const overrides = getBuiltinToolUiOverrides(toolName)

			expect(overrides.userFacingName?.()).toBe('')
			expect(overrides.renderToolUseMessage?.({}, {verbose: false})).toBe('')
			expect(overrides.renderToolResultMessage).toBeFunction()
		}
	})

	test('provides product UI overrides for Monitor', () => {
		const overrides = getBuiltinToolUiOverrides('Monitor')

		expect(overrides.renderToolUseMessage?.(
			{command: 'tail -f app.log', description: 'Watch app log for errors'},
			{verbose: false},
		)).toBe('Monitor: Watch app log for errors')
		expect(
			overrides.renderToolResultMessage?.(
				{taskId: 'task-1', outputFile: '/tmp/task-1.out'},
				[],
				{verbose: false},
			),
		).not.toBeNull()
	})

	test('provides product UI overrides for team lifecycle tools', () => {
		const createOverrides = getBuiltinToolUiOverrides('TeamCreate')
		const deleteOverrides = getBuiltinToolUiOverrides('TeamDelete')

		expect(
			createOverrides.renderToolUseMessage?.(
				{team_name: 'reviewers'},
				{verbose: false},
			),
		).toBe('create team: reviewers')
		expect(deleteOverrides.renderToolUseMessage?.({}, {verbose: false})).toBe(
			'cleanup team: current',
		)
		expect(
			deleteOverrides.renderToolResultMessage?.(
				{success: true, message: 'done', team_name: 'reviewers'},
				[],
				{verbose: false},
			),
		).toBeNull()
	})
})
