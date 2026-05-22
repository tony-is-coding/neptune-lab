export function jsonStringify(
	value: unknown,
	replacer?: Parameters<typeof JSON.stringify>[1],
	space?: string | number,
): string {
	return JSON.stringify(value, replacer, space)
}
