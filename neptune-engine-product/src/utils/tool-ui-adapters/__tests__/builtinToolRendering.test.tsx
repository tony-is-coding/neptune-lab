import {describe, expect, mock, test} from 'bun:test'
import {join} from 'path'

mock.module('../../slowOperations.js', () => ({
	jsonParse(value: string) {
		return JSON.parse(value)
	},
	jsonStringify(value: unknown) {
		return JSON.stringify(value)
	},
	slowLogging: {enabled: false},
}))

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
})
