import {escapeRegExp} from './string.js'

export function extractTag(html: string, tagName: string): string | null {
	if (!html.trim() || !tagName.trim()) {
		return null
	}

	const escapedTag = escapeRegExp(tagName)
	const pattern = new RegExp(
		`<${escapedTag}(?:\\s+[^>]*)?>` +
			'([\\s\\S]*?)' +
			`<\\/${escapedTag}>`,
		'gi',
	)

	let match
	let depth = 0
	let lastIndex = 0
	const openingTag = new RegExp(`<${escapedTag}(?:\\s+[^>]*?)?>`, 'gi')
	const closingTag = new RegExp(`<\\/${escapedTag}>`, 'gi')

	while ((match = pattern.exec(html)) !== null) {
		const content = match[1]
		const beforeMatch = html.slice(lastIndex, match.index)

		depth = 0
		openingTag.lastIndex = 0
		while (openingTag.exec(beforeMatch) !== null) {
			depth++
		}

		closingTag.lastIndex = 0
		while (closingTag.exec(beforeMatch) !== null) {
			depth--
		}

		if (depth === 0) {
			return content
		}

		lastIndex = match.index + match[0].length
	}

	return null
}

export function extractTextContent(
	blocks: readonly {readonly type: string}[],
	separator = '',
): string {
	return blocks
		.filter((block): block is {type: 'text'; text: string} => block.type === 'text')
		.map(block => block.text)
		.join(separator)
}
