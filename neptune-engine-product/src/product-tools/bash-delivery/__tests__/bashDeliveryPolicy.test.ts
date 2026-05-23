import {describe, expect, mock, test} from 'bun:test'

mock.module('src/utils/envUtils.js', () => ({
	isEnvTruthy() {
		return false
	},
}))

mock.module('src/utils/gitSettings.js', () => ({
	shouldIncludeGitInstructions() {
		return true
	},
}))

mock.module('src/utils/attribution.js', () => ({
	getAttributionTexts() {
		return {
			commit: 'Co-Authored-By: Test <test@example.com>',
			pr: 'Generated with Test',
		}
	},
}))

mock.module('src/utils/undercover.js', () => ({
	getUndercoverInstructions() {
		return 'UNDERCOVER TEST'
	},
	isUndercover() {
		return false
	},
}))

const {applyBashDeliveryPolicy, getBashDeliveryPolicyPrompt} = await import(
	'../prompt.js'
)

describe('product Bash delivery policy', () => {
	test('builds commit and PR delivery policy outside builtin Bash runtime', () => {
		const prompt = getBashDeliveryPolicyPrompt()

		expect(prompt).toContain('# Committing changes with git')
		expect(prompt).toContain('# Creating pull requests')
		expect(prompt).toContain('gh pr create')
		expect(prompt).toContain('NEVER skip hooks')
		expect(prompt).toContain('NEVER run destructive git commands')
		expect(prompt).toContain('Co-Authored-By: Test <test@example.com>')
		expect(prompt).toContain('Generated with Test')
	})

	test('appends delivery policy to a product Bash tool wrapper', async () => {
		const baseTool = {
			name: 'Bash',
			async prompt(_options: unknown) {
				return 'Base Bash runtime prompt'
			},
		} as never

		const wrapped = applyBashDeliveryPolicy(baseTool)
		const prompt = await wrapped.prompt({} as never)

		expect(prompt).toContain('Base Bash runtime prompt')
		expect(prompt).toContain('# Committing changes with git')
		expect(prompt).toContain('# Creating pull requests')
	})
})
