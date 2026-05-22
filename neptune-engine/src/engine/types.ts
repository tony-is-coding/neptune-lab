// ============================================================
// Provider 类型 — import from AgentEngine（单一真相来源）
// ============================================================

import type {ProviderConfig, ProviderType} from './AgentEngine.js'

// ============================================================
// Session 相关类型
// ============================================================

// Session 状态枚举
export type SessionStatus = 'active' | 'paused' | 'destroyed'

// 创建 Session 的配置
export interface SessionConfig {
	workspace: string
	metadata?: Record<string, unknown>
	/** per-session 系统提示词（可选） */
	systemPrompt?: string | (() => Promise<string>)
	/** per-session Provider 配置（可选） */
	providerConfig?: ProviderConfig
}

// Re-export Provider 类型供外部使用
export type {ProviderConfig, ProviderType}

// SessionManager 配置
export interface SessionManagerConfig {
	maxConcurrentSessions?: number
}

// Session 元数据（listSessions 返回）
export interface SessionMetadata {
	id: string
	workspace: string
	status: SessionStatus
	createdAt: number
	metadata?: Record<string, unknown>
}

/**
 * Session 信息
 * 对外暴露的 Session 摘要信息
 */
export interface SessionInfo {
	/** Session ID */
	id: string
	/** Session ID（别名，与 id 相同） */
	sessionId: string
	/** 工作区路径 */
	workspace: string
	/** Session 状态 */
	status: SessionStatus
	/** 创建时间戳 */
	createdAt: number
	/** 用户自定义元数据 */
	metadata?: Record<string, unknown>
	/** per-session 系统提示词（可选） */
	systemPrompt?: string | (() => Promise<string>)
	/** per-session Provider 配置（可选） */
	providerConfig?: ProviderConfig
}

// ============================================================
// 分布式序列化协议（T15）
// ============================================================

/** 序列化协议版本号，用于前后兼容 */
export const SERIALIZATION_PROTOCOL_VERSION = 1

/**
 * EventBusMessage — 可跨进程传输的事件消息格式
 *
 * 所有 EventBus 事件在跨进程传输时必须序列化为此格式。
 * 包含事件元信息（type、timestamp、sessionId）和业务 payload。
 */
export interface EventBusMessage {
	/** 协议版本号 */
	version: number
	/** 事件类型 */
	type: string
	/** 事件负载（必须是 JSON 可序列化的） */
	payload: unknown
	/** 关联的 Session ID（可选） */
	sessionId?: string
	/** 事件时间戳（毫秒） */
	timestamp: number
}

/**
 * SessionContextSnapshot — SessionContext 核心字段的序列化格式
 *
 * 只包含 [ENGINE] 分组的字段，这些是 engine/ 实际使用的字段。
 * [CC_COMPAT] 和 [CC_INTERNAL] 字段由 CC 原始代码自行管理，不纳入序列化。
 */
export interface SessionContextSnapshot {
	version: number
	sessionId: string
	cwd: string
	projectRoot: string
	memoryPath?: string
	originalCwd?: string
	/** 成本数据 */
	totalCostUSD?: number
	totalAPIDuration?: number
	totalAPIDurationWithoutRetries?: number
	totalToolDuration?: number
	totalLinesAdded?: number
	totalLinesRemoved?: number
	/** 模型使用情况 */
	modelUsage?: Record<string, unknown>
}

/**
 * EngineSnapshot — 完整的引擎状态快照
 *
 * 用于跨进程传输或持久化存储。
 * 包含 Session 状态 + SessionContext 核心字段 + EventBus 消息。
 */
export interface EngineSnapshot {
	version: number
	session: {
		sessionId: string
		workspace: string
		createdAt: number
		status: SessionStatus
		metadata: Record<string, unknown>
	}
	context: SessionContextSnapshot
}

// ============================================================
// AgentEngine.query() 事件类型
// ============================================================
// 注意：以下类型已被移除，因为它们不再被使用：
// - EngineEvent, TextEvent, ResultEvent, SystemEvent
// 这些是旧的事件类型定义，现在框架使用不同的事件系统
