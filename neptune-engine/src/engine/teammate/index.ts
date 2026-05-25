/**
 * Teammate 协议 — substrate 多 agent 协作（Agent Teams）
 *
 * 公开 API：
 * - TeammateChannel 协议 + 4 类操作（send/broadcast/readMailbox/markAsRead）
 * - StructuredMessage 4 类（shutdown / plan_approval）
 * - InMemoryTeammateChannel 默认实现
 * - TeammateBackend 协议（spawn 后端接口，B1.5 — substrate 不绑 tmux/进程实现）
 */

export type {
	TeammateChannel,
	TeammateMessage,
	TeammateMessageInput,
	StructuredMessage,
} from './TeammateChannel.js'
export {
	encodeStructuredMessage,
	decodeStructuredMessage,
} from './TeammateChannel.js'
export {InMemoryTeammateChannel} from './InMemoryTeammateChannel.js'

// Stage B1.5 — TeammateBackend 协议（spawn 后端接口）
export type {
	TeammateBackend,
	SpawnTeammateInput,
	SpawnTeammateResult,
	TeammateStatus,
	TeammateInfo,
} from './TeammateBackend.js'
