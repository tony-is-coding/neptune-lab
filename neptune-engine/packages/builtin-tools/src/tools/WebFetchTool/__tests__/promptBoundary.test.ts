import {describe, expect, test} from 'bun:test'
import {DESCRIPTION} from '../prompt.js'

describe('WebFetchTool prompt runtime boundary', () => {
	test('excludes product GitHub CLI routing guidance', () => {
		expect(DESCRIPTION).not.toContain('For GitHub URLs')
		expect(DESCRIPTION).not.toContain('gh CLI')
		expect(DESCRIPTION).not.toContain('gh pr view')
		expect(DESCRIPTION).not.toContain('gh issue view')
		expect(DESCRIPTION).not.toContain('gh api')
	})
})
