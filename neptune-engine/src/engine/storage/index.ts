/**
 * storage/index.ts — Storage 协议 + zero-dep 默认实现导出
 *
 * 设计原则（Stage 3）：
 * - engine 自身只提供 InMemory + Filesystem 两类 zero-dep 默认实现
 * - 具体后端（PG / Redis / SQLite / S3 等）由 product 注入
 * - 所有协议遵循 ISessionStore / ISessionContentStore / IMemoryStore 接口
 */

export type {IBackend} from './IBackend.js'
export {InMemoryBackend} from './InMemoryBackend.js'
export {FilesystemBackend} from './FilesystemBackend.js'
export {CompositeBackend} from './CompositeBackend.js'

// SessionStore 接口 + 双默认
export type {ISessionStore} from './ISessionStore.js'
export {InMemorySessionStore} from './InMemorySessionStore.js'
export {FilesystemSessionStore} from './FilesystemSessionStore.js'

// SessionContentStore 接口 + 双默认
export type {ISessionContentStore, ReadOptions, SessionContentItem} from './ISessionContentStore.js'
export {InMemorySessionContentStore} from './InMemorySessionContentStore.js'
export {FilesystemContentStore} from './FilesystemContentStore.js'

// MemoryStore 接口 + 双默认
export type {IMemoryStore} from './IMemoryStore.js'
export {InMemoryMemoryStore} from './InMemoryMemoryStore.js'
export {FilesystemMemoryStore} from './FilesystemMemoryStore.js'
