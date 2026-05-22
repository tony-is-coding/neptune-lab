export function jsonStringify(
	value: unknown,
	replacer?: Parameters<typeof JSON.stringify>[1],
	space?: string | number,
): string {
	return JSON.stringify(value, replacer, space)
}

export const jsonParse: typeof JSON.parse = (text, reviver) => {
	return typeof reviver === 'undefined'
		? JSON.parse(text)
		: JSON.parse(text, reviver)
}

export function safeParseJSON(
	json: string | null | undefined,
	_shouldLogError = true,
): unknown {
	if (!json) return null
	try {
		return JSON.parse(stripBOM(json))
	} catch {
		return null
	}
}

function stripBOM(json: string): string {
	return json.charCodeAt(0) === 0xfeff ? json.slice(1) : json
}
