import {describe, expect, test} from 'bun:test'
import {
	applyWebFetchDeliveryPolicy,
	getWebFetchDeliveryPolicyPrompt,
} from '../prompt.js'

describe('product WebFetch delivery policy', () => {
	test('builds GitHub CLI routing policy outside builtin WebFetch runtime', () => {
		const prompt = getWebFetchDeliveryPolicyPrompt()

		expect(prompt).toContain('# WebFetch product routing')
		expect(prompt).toContain('For GitHub URLs')
		expect(prompt).toContain('gh pr view')
		expect(prompt).toContain('gh issue view')
		expect(prompt).toContain('gh api')
	})

	test('appends GitHub CLI routing policy to a product WebFetch tool wrapper', async () => {
		const wrapped = applyWebFetchDeliveryPolicy({
			name: 'WebFetch',
			async prompt(_options: unknown) {
				return 'Base WebFetch runtime prompt'
			},
		} as never)

		const prompt = await wrapped.prompt({} as never)

		expect(prompt).toContain('Base WebFetch runtime prompt')
		expect(prompt).toContain('# WebFetch product routing')
		expect(prompt).toContain('For GitHub URLs')
	})
})
