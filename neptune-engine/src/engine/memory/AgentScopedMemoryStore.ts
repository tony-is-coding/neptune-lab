/**
 * AgentScopedMemoryStore — Substrate 协议：agent 跨 session 持久化记忆
 *
 * 设计目的（Stage B1.1，基于 cc agentMemory 197 行 + agentMemorySnapshot 197 行
 * 已证明的复杂状态机抽取功能契约）：
 * - 让 sub-agent 跑完一次后，把"学到的经验"持久化到 markdown 文件
 * - 三 scope 隔离：
 *   * 'user'    — 跨项目共享，typically `~/.claude/agent-memory/<agentType>/`
 *   * 'project' — 项目内团队共享，入 git，typically `<cwd>/.claude/agent-memory/<agentType>/`
 *   * 'local'   — 本地不入 git，typically `<cwd>/.claude/agent-memory-local/<agentType>/`
 * - Snapshot 机制：项目级 snapshot 自动同步到本地 user-scope memory
 *   （让团队成员第一次开 IDE 就有项目积累的 agent 经验）
 *
 * 与 cc 行为差异：
 * - cc 硬编码 `.claude/agent-memory/` 路径 + `MEMORY.md` 文件名 + `getMemoryBaseDir`
 *   工具函数；substrate 把 baseDir 注入化（FilesystemAgentScopedMemoryStore 构造时传）
 * - cc 业务依赖 `findCanonicalGitRoot` / `buildMemoryPrompt` 等业务函数；substrate 不依赖 git
 * - cc 走 React UI 渲染 prompt 注入；substrate 只输出 markdown 字符串，product 自己
 *   决定怎么注入到 sub-agent system prompt
 *
 * 设计原则（红线 #2 — 参考 cc 设计经验，剥业务依赖后留协议）：
 * - 接口不预设后端（Filesystem / S3 / DB / 远端 mount 都可以）
 * - 写入操作返 Promise（兼容持久化后端）
 * - snapshot 同步是 idempotent（initialize / replace / markSynced 三方法）
 */

/**
 * Memory scope — agent 记忆的可见性范围。
 *
 * - user: 跨项目共享（个人私有偏好）
 * - project: 项目内团队共享（入 git）
 * - local: 本地不入 git（机器特定 + 实验性记忆）
 */
export type AgentMemoryScope = 'user' | 'project' | 'local'

/**
 * 检查 snapshot 是否需要同步的结果。
 */
export type SnapshotCheckResult =
	| {action: 'none'}
	/** 本地无 memory，应从 snapshot 初始化 */
	| {action: 'initialize'; snapshotTimestamp: string}
	/** snapshot 比本地新，应提示用户更新 */
	| {action: 'prompt-update'; snapshotTimestamp: string}

/**
 * AgentScopedMemoryStore 协议 — 注入到 ToolUseContext.kernel.agentScopedMemoryStore。
 *
 * 区别于 MemoryStore（基于 ref/namespace 的事实存储）：
 * - AgentScopedMemoryStore 是文件级（一份 markdown），按 agentType + scope 索引
 * - cc 实测：sub-agent 跑完后会主动 Write 一个 MEMORY.md 到对应 scope 目录
 * - 读取时把 markdown 内容注入到 sub-agent 的 system prompt
 */
export interface AgentScopedMemoryStore {
	/**
	 * 加载某个 agent + scope 下的全部 markdown 内容（拼成一个字符串）。
	 *
	 * 不存在返 ''（不抛错，让 caller 简单处理）。
	 *
	 * @param agentType 唯一类型标识（如 'general-purpose' / 'reviewer'）
	 * @param scope 'user' / 'project' / 'local'
	 */
	load(agentType: string, scope: AgentMemoryScope): Promise<string>

	/**
	 * 写入一份 markdown 到对应 scope 下。同名 file 覆盖。
	 *
	 * @param agentType
	 * @param scope
	 * @param fileName 文件名（如 'MEMORY.md' / 'lessons-learned.md'）
	 * @param content markdown 内容
	 */
	write(
		agentType: string,
		scope: AgentMemoryScope,
		fileName: string,
		content: string,
	): Promise<void>

	/**
	 * 列出某 agent + scope 下的所有 markdown 文件名。
	 */
	list(agentType: string, scope: AgentMemoryScope): Promise<readonly string[]>

	/**
	 * 删除某 agent + scope 下的某个文件。不存在不报错。
	 */
	delete(
		agentType: string,
		scope: AgentMemoryScope,
		fileName: string,
	): Promise<void>

	/**
	 * 检查 snapshot 与本地 scope 的同步状态。
	 *
	 * - 没有 snapshot → 'none'
	 * - 本地无 memory → 'initialize'（应该从 snapshot 拷贝）
	 * - snapshot 比本地新 → 'prompt-update'（提示用户更新）
	 * - 已同步 → 'none'
	 */
	checkSnapshot(
		agentType: string,
		scope: AgentMemoryScope,
	): Promise<SnapshotCheckResult>

	/**
	 * 从 snapshot 初始化本地 memory（首次设置）。
	 *
	 * 拷贝 snapshot 目录的所有 *.md 到对应 scope 目录。
	 */
	initializeFromSnapshot(
		agentType: string,
		scope: AgentMemoryScope,
		snapshotTimestamp: string,
	): Promise<void>

	/**
	 * 用 snapshot 替换本地 memory（先删本地 .md 再拷贝）。
	 */
	replaceFromSnapshot(
		agentType: string,
		scope: AgentMemoryScope,
		snapshotTimestamp: string,
	): Promise<void>

	/**
	 * 标记 snapshot 已同步（不实际拷贝，仅更新本地 syncedFrom 元数据）。
	 */
	markSnapshotSynced(
		agentType: string,
		scope: AgentMemoryScope,
		snapshotTimestamp: string,
	): Promise<void>

	/**
	 * 写入一份 snapshot（团队成员可以共享）。
	 *
	 * @param agentType
	 * @param fileName
	 * @param content
	 * @param updatedAt ISO8601 时间戳（写到 snapshot.json）
	 */
	writeSnapshot(
		agentType: string,
		fileName: string,
		content: string,
		updatedAt: string,
	): Promise<void>
}
