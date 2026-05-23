/**
 * Memory protocol — public exports.
 *
 * See docs/strategy/neptune-engine-runtime-kernel-design.md §7.
 */

export type {
	MemoryEntry,
	MemoryEntryInput,
	MemoryQuery,
	MemoryRef,
	MemoryStore,
	MemorySource,
} from './types.js'

export {InMemoryMemoryStore} from './InMemoryMemoryStore.js'
