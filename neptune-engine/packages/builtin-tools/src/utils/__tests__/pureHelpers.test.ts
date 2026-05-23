import {describe, expect, test} from 'bun:test'
import {z} from 'zod/v4'
import {jsonParse, safeParseJSON} from '../json.js'
import {extractTag, extractTextContent} from '../messages.js'
import {semanticBoolean} from '../semanticBoolean.js'
import {semanticNumber} from '../semanticNumber.js'

describe('builtin-tools pure helpers', () => {
	test('parses JSON without product slow-operation state', () => {
		expect(jsonParse('{"ok":true}')).toEqual({ok: true})
		expect(safeParseJSON('\ufeff{"ok":true}')).toEqual({ok: true})
		expect(safeParseJSON('{bad')).toBeNull()
	})

	test('coerces semantic booleans and numbers narrowly', () => {
		expect(semanticBoolean().parse('true')).toBe(true)
		expect(semanticBoolean().parse('false')).toBe(false)
		expect(semanticNumber().parse('3.14')).toBe(3.14)
		expect(() => semanticNumber(z.number()).parse('')).toThrow()
	})

	test('extracts simple tagged content and text blocks', () => {
		expect(extractTag('<tag>value</tag>', 'tag')).toBe('value')
		expect(extractTag('', 'tag')).toBeNull()
		expect(
			extractTextContent([
				{type: 'text', text: 'a'},
				{type: 'tool_use'},
				{type: 'text', text: 'b'},
			], ','),
		).toBe('a,b')
	})
})
