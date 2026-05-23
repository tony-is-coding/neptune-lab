export function roughTokenCountEstimation(
	content: string,
	bytesPerToken: number = 4,
): number {
	return Math.round(content.length / bytesPerToken)
}

export function bytesPerTokenForFileType(fileExtension: string): number {
	switch (fileExtension) {
		case 'json':
		case 'jsonl':
		case 'jsonc':
			return 2
		default:
			return 4
	}
}

export function roughTokenCountEstimationForFileType(
	content: string,
	fileExtension: string,
): number {
	return roughTokenCountEstimation(
		content,
		bytesPerTokenForFileType(fileExtension),
	)
}
