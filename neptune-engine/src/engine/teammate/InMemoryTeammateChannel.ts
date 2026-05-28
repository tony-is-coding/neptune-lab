/**
 * InMemoryTeammateChannel — TeammateChannel 默认实现（内存后端）
 *
 * 设计目的（Stage B1.4）：
 * - 单进程默认实现：测试 + 开发 + in-process teammate 模式
 * - 不绑文件系统/数据库（Filesystem/Pg/Redis 实现由 product 注入）
 * - 0 外部依赖
 *
 * 与 cc 行为对齐：
 * - per-team mailbox：team → Map<agentName, TeammateMessage[]>
 * - read flag 写在 message 上（不是 inbox 元数据）
 * - 时间序保持插入顺序
 *
 * 设计原则：
 * - 进程内单点；多 worker 时用 product 注入 FilesystemTeammateChannel
 * - dispose() 清空所有 mailbox
 */

import type {
	TeammateChannel,
	TeammateMessage,
	TeammateMessageInput,
} from './TeammateChannel.js'

interface MutableTeammateMessage {
	from: string
	text: string
	timestamp: string
	read: boolean
	color?: string
	summary?: string
}

export class InMemoryTeammateChannel implements TeammateChannel {
	/** team → agentName → mailbox 消息列表 */
	private readonly mailboxes = new Map<
		string,
		Map<string, MutableTeammateMessage[]>
	>()
	/** team → registered agentName 集合（用于 broadcast roster） */
	private readonly teams = new Map<string, Set<string>>()

	private getOrCreateTeamMailboxes(
		teamName: string,
	): Map<string, MutableTeammateMessage[]> {
		let team = this.mailboxes.get(teamName)
		if (!team) {
			team = new Map()
			this.mailboxes.set(teamName, team)
		}
		return team
	}

	private getOrCreateInbox(
		teamName: string,
		agentName: string,
	): MutableTeammateMessage[] {
		const team = this.getOrCreateTeamMailboxes(teamName)
		let inbox = team.get(agentName)
		if (!inbox) {
			inbox = []
			team.set(agentName, inbox)
		}
		return inbox
	}

	private getOrCreateRoster(teamName: string): Set<string> {
		let roster = this.teams.get(teamName)
		if (!roster) {
			roster = new Set()
			this.teams.set(teamName, roster)
		}
		return roster
	}

	async send(
		teamName: string,
		recipientAgentName: string,
		message: TeammateMessageInput,
	): Promise<void> {
		const inbox = this.getOrCreateInbox(teamName, recipientAgentName)
		const stored: MutableTeammateMessage = {
			from: message.from,
			text: message.text,
			timestamp: message.timestamp ?? new Date().toISOString(),
			read: false,
		}
		if (message.color !== undefined) stored.color = message.color
		if (message.summary !== undefined) stored.summary = message.summary
		inbox.push(stored)
	}

	async broadcast(
		teamName: string,
		senderAgentName: string,
		message: TeammateMessageInput,
	): Promise<readonly string[]> {
		const roster = this.getOrCreateRoster(teamName)
		const recipients: string[] = []
		for (const recipient of roster) {
			if (recipient === senderAgentName) continue
			try {
				await this.send(teamName, recipient, message)
				recipients.push(recipient)
			} catch {
				// best-effort: 单个 send 失败不影响其他
			}
		}
		return recipients
	}

	async readMailbox(
		teamName: string,
		agentName: string,
	): Promise<readonly TeammateMessage[]> {
		const team = this.mailboxes.get(teamName)
		if (!team) return []
		const inbox = team.get(agentName)
		if (!inbox) return []
		// 返回不可变快照（防止 caller 修改内部状态）
		return inbox.map(msg => ({...msg}))
	}

	async readUnreadMessages(
		teamName: string,
		agentName: string,
	): Promise<readonly TeammateMessage[]> {
		const all = await this.readMailbox(teamName, agentName)
		return all.filter(m => !m.read)
	}

	async markAsRead(
		teamName: string,
		agentName: string,
		options?: {beforeTimestamp?: string},
	): Promise<void> {
		const team = this.mailboxes.get(teamName)
		if (!team) return
		const inbox = team.get(agentName)
		if (!inbox) return
		const cutoff = options?.beforeTimestamp
		for (const msg of inbox) {
			if (msg.read) continue
			if (cutoff && msg.timestamp > cutoff) continue
			msg.read = true
		}
	}

	async listTeammates(teamName: string): Promise<readonly string[]> {
		const roster = this.teams.get(teamName)
		if (!roster) return []
		return Array.from(roster).sort()
	}

	async registerTeammate(teamName: string, agentName: string): Promise<void> {
		this.getOrCreateRoster(teamName).add(agentName)
	}

	async unregisterTeammate(teamName: string, agentName: string): Promise<void> {
		const roster = this.teams.get(teamName)
		if (roster) roster.delete(agentName)
	}

	async dispose(): Promise<void> {
		this.mailboxes.clear()
		this.teams.clear()
	}
}
