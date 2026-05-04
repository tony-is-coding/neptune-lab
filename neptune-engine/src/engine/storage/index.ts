export type { IBackend } from './IBackend.js'
export { InMemoryBackend } from './InMemoryBackend.js'
export { FilesystemBackend } from './FilesystemBackend.js'
export { CompositeBackend } from './CompositeBackend.js'

// 向后兼容：保留原有的 SessionStore 接口和实现
export type { ISessionStore } from './ISessionStore.js'
export { InMemorySessionStore } from './InMemorySessionStore.js'
export { SQLiteSessionStore } from './SQLiteSessionStore.js'
export { PgSessionStore } from './PgSessionStore.js'
export type { PgSessionStoreConfig } from './PgSessionStore.js'

// SessionContentStore 接口和实现
export type { ISessionContentStore, ReadOptions, SessionContentItem } from './ISessionContentStore.js'
export { InMemorySessionContentStore } from './InMemorySessionContentStore.js'
export { PgContentStore } from './PgContentStore.js'
export type { PgContentStoreConfig } from './PgContentStore.js'

// MemoryStore 接口和实现
export type { IMemoryStore } from './IMemoryStore.js'
export { InMemoryMemoryStore } from './InMemoryMemoryStore.js'
export { RedisMemoryStore } from './RedisMemoryStore.js'
export type { RedisMemoryStoreConfig } from './RedisMemoryStore.js'
