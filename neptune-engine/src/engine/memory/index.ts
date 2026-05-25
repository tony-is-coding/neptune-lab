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

// Stage B1.1 — AgentScopedMemoryStore（cc agentMemory + agentMemorySnapshot 等价协议）
export type {
	AgentMemoryScope,
	AgentScopedMemoryStore,
	SnapshotCheckResult,
} from './AgentScopedMemoryStore.js'
export {FilesystemAgentScopedMemoryStore} from './FilesystemAgentScopedMemoryStore.js'
export type {FilesystemAgentScopedMemoryStoreConfig} from './FilesystemAgentScopedMemoryStore.js'
