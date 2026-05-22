/**
 * engine/types/ids.ts — Branded ID 类型（engine 自有定义）
 *
 * 从 product 迁入。engine 内部不再反向依赖 @neptune/engine-product/types/ids。
 * 反向方向：product src 也可从此处或自身定义引用（运行时等价的 branded string）。
 */

/** Session ID：唯一标识一次 Agent 会话 */
export type SessionId = string & {readonly __brand: 'SessionId'}

/** Agent ID：唯一标识会话内的子 agent */
export type AgentId = string & {readonly __brand: 'AgentId'}

/** 将原始字符串强制转换为 SessionId（谨慎使用） */
export function asSessionId(id: string): SessionId {
	return id as SessionId
}

/** 将原始字符串强制转换为 AgentId（谨慎使用） */
export function asAgentId(id: string): AgentId {
	return id as AgentId
}

const AGENT_ID_PATTERN = /^a(?:.+-)?[0-9a-f]{16}$/

/**
 * 验证并转换为 AgentId。
 * 格式：`a` + 可选 `<label>-` + 16 位 hex。不匹配返回 null。
 */
export function toAgentId(s: string): AgentId | null {
	return AGENT_ID_PATTERN.test(s) ? (s as AgentId) : null
}
