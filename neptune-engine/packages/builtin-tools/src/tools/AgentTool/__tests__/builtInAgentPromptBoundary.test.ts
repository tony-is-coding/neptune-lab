import {describe, expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const files = [
	'../built-in/exploreAgent.ts',
	'../built-in/planAgent.ts',
	'../built-in/verificationAgent.ts',
]

function readSource(path: string): string {
	return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
}

describe('built-in Agent prompts runtime boundary', () => {
	test('keeps Explore, Plan, and Verification prompts free of product delivery language', () => {
		const source = files.map(readSource).join('\n')

		expect(source).not.toContain('git status')
		expect(source).not.toContain('git log')
		expect(source).not.toContain('git diff')
		expect(source).not.toContain('git add')
		expect(source).not.toContain('git commit')
		expect(source).not.toContain('commit/PR/lint')
		expect(source).not.toContain('CLAUDE.md')
		expect(source).not.toContain('commit message')
		expect(source).not.toContain('Claude Code')
		expect(source).not.toContain("Anthropic's official CLI")
		expect(source).not.toContain('Frontend changes')
		expect(source).not.toContain('Backend/API changes')
		expect(source).not.toContain('Mobile (iOS/Android)')
		expect(source).not.toContain('Database migrations')
		expect(source).not.toContain('mcp__playwright__')
		expect(source).not.toContain('mcp__claude-in-chrome__')
		expect(source).not.toContain('3+ file edits')
	})
})
