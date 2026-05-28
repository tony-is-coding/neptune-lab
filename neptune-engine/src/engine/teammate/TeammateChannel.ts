/**
 * TeammateChannel — Substrate 协议：agent teams 多 agent 通信
 *
 * 设计目的（Stage B1.4，参考 cc teammateMailbox.ts 已证明的 mailbox 协议）：
 * - cc agent teams 是 sub-agent 之外的第二大多 agent 协作模式
 * - cc 实现：file-based inbox（json 文件 per agent）+ lockfile + read flag
 * - substrate 协议化：抽象成 TeammateChannel 接口，让 product 注入 file/Redis/NATS 实现
 *
 * 与 cc 行为对齐（基于 cc TeammateMessage 类型）：
 * - 每个 teammate 有独立 mailbox（按 agentName 索引，不是 agentId）
 * - 消息含 from / text / timestamp / read / color? / summary?
 * - 支持 4 类结构化消息：plain text / shutdown_request / shutdown_response / plan_approval_response
 * - 支持 broadcast（写到 team 所有 teammate 除发送者）
 * - read flag 让 receiver 区分新消息 vs 已读
 *
 * 与 cc 业务差异：
 * - cc 硬编码 ~/.claude/teams/{team}/inboxes/{agent}.json，substrate 不绑路径
 * - cc 用 lockfile 防并发，substrate 协议不强制（实现自决）
 * - cc 用 TEAM_LEAD_NAME 默认值，substrate 不预设 lead 角色
 *
 * 设计原则：
 * - 与已有 Channel 协议互补：Channel 是单消息 send/receive，TeammateChannel
 *   是 mailbox 模型（read flag + history + broadcast）
 * - per-team 隔离 + per-agent inbox 索引
 * - 所有方法异步（兼容 fs / DB / 远程后端）
 */

/**
 * Teammate 消息基本类型（plain text 路径）。
 *
 * 与 cc TeammateMessage 字段同步：
 * - from: 发送者 agentName
 * - text: 消息正文（plain text 或结构化 JSON 序列化）
 * - timestamp: ISO8601 写入时间
 * - read: 是否已读
 * - color: 发送者颜色（UI 装饰，可选）
 * - summary: 5-10 词预览（UI 装饰，可选）
 */
export interface TeammateMessage {
	readonly from: string
	readonly text: string
	readonly timestamp: string
	readonly read: boolean
	readonly color?: string
	readonly summary?: string
}

/**
 * 写入消息时的输入（read 字段由 channel 自动填默认 false）。
 */
export interface TeammateMessageInput {
	readonly from: string
	readonly text: string
	readonly timestamp?: string // 可选；channel 自动填 ISO now()
	readonly color?: string
	readonly summary?: string
}

/**
 * 4 类 cc 已证明的结构化消息（cc SendMessageTool.ts:46-65 等价）：
 *
 * - shutdown_request:    team lead 请求 teammate 关闭
 * - shutdown_response:   teammate 响应 shutdown_request（approve/reject + reason）
 * - plan_approval_response: team lead 批准 / 拒绝 teammate 的 plan
 *
 * 这 3 类通过 text 字段 JSON.stringify 后传输（cc 等价行为）。
 */
export type StructuredMessage =
	| {
			readonly type: 'shutdown_request'
			readonly request_id: string
			readonly reason?: string
	  }
	| {
			readonly type: 'shutdown_response'
			readonly request_id: string
			readonly approve: boolean
			readonly reason?: string
	  }
	| {
			readonly type: 'plan_approval_response'
			readonly request_id: string
			readonly approve: boolean
			readonly feedback?: string
	  }

/**
 * TeammateChannel 协议 — 注入到 ToolUseContext.kernel.teammateChannel。
 *
 * 4 类核心操作：
 * - send(team, recipient, msg): 单播消息到 recipient inbox
 * - broadcast(team, sender, msg): 广播到 team 内除 sender 外所有 teammate
 * - readMailbox(team, agentName): 读全部消息（含已读）
 * - readUnreadMessages(team, agentName): 读未读消息（read=false）
 * - markAsRead(team, agentName, indexOrTimestamp): 标记已读
 *
 * 设计对齐 cc：
 * - cc readMailbox 返 TeammateMessage[]（含已读），caller 自己 filter
 * - cc readUnreadMessages 返 read=false 的子集
 * - cc markAsRead 操作是 mailbox 内的批量更新（read=true）
 */
export interface TeammateChannel {
	/**
	 * 单播消息到 recipient（team + agentName 索引）。
	 *
	 * 实现保证：
	 * - read 默认 false
	 * - timestamp 不传时填 ISO now()
	 * - inbox 不存在自动创建
	 */
	send(
		teamName: string,
		recipientAgentName: string,
		message: TeammateMessageInput,
	): Promise<void>

	/**
	 * 广播到 team 内所有 teammate（除 sender）。
	 *
	 * 实现保证：
	 * - 需要先调 listTeammates(team) 拿到 roster
	 * - sender 自己不收
	 * - 任一 send 失败不影响其他（best-effort）
	 *
	 * @returns 实际发送到的 recipient 列表
	 */
	broadcast(
		teamName: string,
		senderAgentName: string,
		message: TeammateMessageInput,
	): Promise<readonly string[]>

	/**
	 * 读 inbox 全部消息（按时间序，含已读）。
	 *
	 * 不存在 inbox 返 []。
	 */
	readMailbox(
		teamName: string,
		agentName: string,
	): Promise<readonly TeammateMessage[]>

	/**
	 * 读未读消息（read=false 子集，按时间序）。
	 */
	readUnreadMessages(
		teamName: string,
		agentName: string,
	): Promise<readonly TeammateMessage[]>

	/**
	 * 标记消息为已读。
	 *
	 * 默认行为：标记全部 read=false 为 read=true。
	 * 可选 timestamp：仅标记 timestamp <= 该时间的消息。
	 */
	markAsRead(
		teamName: string,
		agentName: string,
		options?: {beforeTimestamp?: string},
	): Promise<void>

	/**
	 * 列出 team 内所有已注册的 teammate（agentName 列表）。
	 *
	 * 实现可以基于 mailbox 文件存在性 / team 配置 / 显式注册。
	 */
	listTeammates(teamName: string): Promise<readonly string[]>

	/**
	 * 注册一个 teammate 到 team（broadcast 用 roster）。
	 *
	 * 同名 idempotent。
	 */
	registerTeammate(teamName: string, agentName: string): Promise<void>

	/**
	 * 注销 teammate（teammate exit 时调）。同名 idempotent。
	 */
	unregisterTeammate(teamName: string, agentName: string): Promise<void>

	/** 释放底层资源（fs handle / pg connection 等）。 */
	dispose?(): Promise<void>
}

/**
 * 把 StructuredMessage 序列化为 text 字段（cc 等价行为）。
 */
export function encodeStructuredMessage(msg: StructuredMessage): string {
	return JSON.stringify(msg)
}

/**
 * 反序列化 text 为 StructuredMessage；非结构化返 null。
 */
export function decodeStructuredMessage(text: string): StructuredMessage | null {
	try {
		const parsed = JSON.parse(text) as {type?: string}
		if (parsed && typeof parsed.type === 'string') {
			if (
				parsed.type === 'shutdown_request' ||
				parsed.type === 'shutdown_response' ||
				parsed.type === 'plan_approval_response'
			) {
				return parsed as StructuredMessage
			}
		}
		return null
	} catch {
		return null
	}
}
