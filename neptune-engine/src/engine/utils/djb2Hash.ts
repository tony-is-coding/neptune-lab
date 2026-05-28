/**
 * djb2 string hash — fast non-cryptographic hash returning a signed 32-bit int.
 * Deterministic across runtimes (Bun.hash uses wyhash, not portable across
 * versions). Use this for on-disk-stable output (e.g. directory names that
 * must survive runtime upgrades).
 */
export function djb2Hash(str: string): number {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
	}
	return hash
}
