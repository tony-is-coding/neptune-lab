import {describe, expect, test} from 'bun:test'

import {
	parseSkillMarkdown,
	serializeSkillToMarkdown,
	SkillFormatError,
	validateSkillManifest,
} from '../SkillFormatter.js'

const SAMPLE_FULL = `---
name: code-reviewer
description: 当用户让你审查代码或做 PR review 时调用
tools: [Read, Grep, Glob]
disallowedTools: [Bash]
model: claude-haiku-4-5
metadata:
  priority: high
---

你是一个严格的代码审查员。
重点检查 bug、安全风险、命名一致性。`

describe('parseSkillMarkdown', () => {
	test('parses required fields', () => {
		const m = parseSkillMarkdown(`---\nname: foo\ndescription: bar\n---\n\nhello`)
		expect(m.name).toBe('foo')
		expect(m.description).toBe('bar')
		expect(m.prompt).toBe('hello')
	})

	test('parses full manifest with arrays and metadata', () => {
		const m = parseSkillMarkdown(SAMPLE_FULL)
		expect(m.name).toBe('code-reviewer')
		expect(m.tools).toEqual(['Read', 'Grep', 'Glob'])
		expect(m.disallowedTools).toEqual(['Bash'])
		expect(m.model).toBe('claude-haiku-4-5')
		expect(m.metadata).toEqual({priority: 'high'})
		expect(m.prompt).toMatch(/严格的代码审查员/)
	})

	test('throws on missing frontmatter delimiter', () => {
		expect(() => parseSkillMarkdown('no frontmatter here')).toThrow(SkillFormatError)
	})

	test('throws on unclosed frontmatter', () => {
		expect(() => parseSkillMarkdown('---\nname: foo\ndescription: bar\nbody')).toThrow(
			SkillFormatError,
		)
	})

	test('throws on missing required name', () => {
		expect(() =>
			parseSkillMarkdown('---\ndescription: bar\n---\nbody'),
		).toThrow(/name/)
	})

	test('throws on missing required description', () => {
		expect(() => parseSkillMarkdown('---\nname: foo\n---\nbody')).toThrow(
			/description/,
		)
	})

	test('preserves unknown frontmatter fields into metadata', () => {
		const m = parseSkillMarkdown(
			`---\nname: foo\ndescription: bar\ncategory: qa\n---\nbody`,
		)
		expect(m.metadata).toEqual({category: 'qa'})
	})

	test('explicit metadata takes precedence over inferred fields with same key', () => {
		const m = parseSkillMarkdown(
			`---\nname: foo\ndescription: bar\ncategory: qa\nmetadata:\n  category: prod\n---\nbody`,
		)
		expect(m.metadata).toEqual({category: 'prod'})
	})

	test('strips quotes from quoted scalars', () => {
		const m = parseSkillMarkdown(
			`---\nname: foo\ndescription: "hello, world"\n---\nbody`,
		)
		expect(m.description).toBe('hello, world')
	})

	test('handles empty array', () => {
		const m = parseSkillMarkdown(`---\nname: foo\ndescription: bar\ntools: []\n---\nbody`)
		expect(m.tools).toEqual([])
	})

	test('rejects non-string tool entries', () => {
		// 极简 YAML 把所有 [..] 内的元素当字符串处理，所以这条测覆盖 validate 路径
		const ok = validateSkillManifest({
			name: 'foo',
			description: 'bar',
			prompt: '',
			tools: [123 as unknown as string],
		})
		expect(ok.ok).toBe(false)
	})

	test('round-trip preserves semantic content', () => {
		const m1 = parseSkillMarkdown(SAMPLE_FULL)
		const text = serializeSkillToMarkdown(m1)
		const m2 = parseSkillMarkdown(text)
		expect(m2.name).toBe(m1.name)
		expect(m2.description).toBe(m1.description)
		expect(m2.tools).toEqual(m1.tools as string[])
		expect(m2.disallowedTools).toEqual(m1.disallowedTools as string[])
		expect(m2.model).toBe(m1.model!)
		expect(m2.metadata).toEqual(m1.metadata as Record<string, unknown>)
		expect(m2.prompt).toBe(m1.prompt)
	})
})

describe('validateSkillManifest', () => {
	test('accepts a minimal valid manifest', () => {
		const r = validateSkillManifest({
			name: 'a',
			description: 'b',
			prompt: 'c',
		})
		expect(r.ok).toBe(true)
	})

	test('reports all errors at once', () => {
		const r = validateSkillManifest({})
		expect(r.ok).toBe(false)
		expect(r.errors.length).toBeGreaterThanOrEqual(2)
	})

	test('rejects non-object input', () => {
		expect(validateSkillManifest('hi').ok).toBe(false)
		expect(validateSkillManifest(null).ok).toBe(false)
	})
})
