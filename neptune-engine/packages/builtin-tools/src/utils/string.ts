export function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function plural(
	count: number,
	singular: string,
	pluralWord = `${singular}s`,
): string {
	return count === 1 ? singular : pluralWord
}

export function firstLineOf(str: string): string {
	const newline = str.indexOf('\n')
	return newline === -1 ? str : str.slice(0, newline)
}

export function countCharInString(
	str: {indexOf(search: string, start?: number): number},
	char: string,
	start = 0,
): number {
	let count = 0
	let index = str.indexOf(char, start)
	while (index !== -1) {
		count++
		index = str.indexOf(char, index + 1)
	}
	return count
}
