export function count<T>(arr: readonly T[], pred: (x: T) => unknown): number {
	let n = 0
	for (const x of arr) {
		n += +!!pred(x)
	}
	return n
}

export function uniq<T>(xs: Iterable<T>): T[] {
	return [...new Set(xs)]
}
