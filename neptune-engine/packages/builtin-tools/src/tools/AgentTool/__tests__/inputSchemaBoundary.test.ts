import {describe, expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const sourcePath = fileURLToPath(new URL('../AgentTool.tsx', import.meta.url))
const source = readFileSync(sourcePath, 'utf8')

function sourceBetween(start: string, end: string) {
	const startIndex = source.indexOf(start)
	const endIndex = source.indexOf(end, startIndex)
	expect(startIndex).toBeGreaterThanOrEqual(0)
	expect(endIndex).toBeGreaterThan(startIndex)
	return source.slice(startIndex, endIndex)
}

describe('AgentTool input schema runtime boundary', () => {
	test('keeps input and output schema descriptions free of product delivery language', () => {
		const schemaSource = sourceBetween(
			'// Base input schema without multi-agent parameters',
			'// Explicit type widens the schema inference',
		)
		const outputSchemaSource = sourceBetween(
			'// Output schema - multi-agent spawned schema added dynamically at runtime when enabled',
			'type OutputSchema = ReturnType<typeof outputSchema>',
		)
		const modelVisibleSchemaSource = `${schemaSource}\n${outputSchemaSource}`

		expect(modelVisibleSchemaSource).not.toContain('SendMessage')
		expect(modelVisibleSchemaSource).not.toContain('teammate')
		expect(modelVisibleSchemaSource).not.toContain('plan approval')
		expect(modelVisibleSchemaSource).not.toContain('notified when it completes')
		expect(modelVisibleSchemaSource).not.toContain('temporary git worktree')
		expect(modelVisibleSchemaSource).not.toContain('remote CCR environment')
		expect(modelVisibleSchemaSource).not.toContain('Read/Bash')
		expect(modelVisibleSchemaSource).not.toContain('frontmatter')
	})
})
