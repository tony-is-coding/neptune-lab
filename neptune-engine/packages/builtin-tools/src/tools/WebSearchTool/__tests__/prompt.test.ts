import {describe, expect, test} from 'bun:test'
import {getWebSearchPrompt} from '../prompt.js'

describe('getWebSearchPrompt', () => {
	test('uses the current local month and year', () => {
		const expectedMonthYear = new Date().toLocaleString('en-US', {
			month: 'long',
			year: 'numeric',
		})

		expect(getWebSearchPrompt()).toContain(
			`The current month is ${expectedMonthYear}.`,
		)
	})
})
