export function truncate(
	str: string,
	maxWidth: number,
	singleLine: boolean = false,
): string {
	let result = str

	if (singleLine) {
		const firstNewline = str.indexOf('\n')
		if (firstNewline !== -1) {
			result = str.substring(0, firstNewline)
			return result.length + 1 > maxWidth
				? `${result.slice(0, Math.max(0, maxWidth - 1))}…`
				: `${result}…`
		}
	}

	if (result.length <= maxWidth) {
		return result
	}
	if (maxWidth <= 1) {
		return '…'
	}
	return `${result.slice(0, maxWidth - 1)}…`
}
