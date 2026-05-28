/**
 * TeammateBackend — substrate 协议：spawn teammate 后端接口
 *
 * 设计目的（Stage B1.5）：
 * - cc agent teams 有 3 类后端：tmux / in-process / splitpane
 *   每个后端各自 ~300-500 行 业务代码（spawnTmuxPane / inProcessRunner / etc）
 * - substrate 不引入这些业务实现，仅定义接口
 * - product 注入具体后端：
 *   * SDK 用户：用 InProcessTeammateBackend（同进程多 LLM 循环，0 deps）
 *   * cc 产品：注入 TmuxTeammateBackend（cc 业务实现）
 *   * cluster 部署：注入 RemoteTeammateBackend（k8s pod 等）
 *
 * 与 cc 行为差异：
 * - cc spawnMultiAgent.ts 1089 行硬编码 tmux 业务，substrate 不抄
 * - substrate 仅定义 spawn 输入/输出 + lifecycle 接口，不规定后端形态
 *
 * 设计原则：
 * - 配合 TeammateChannel 协议使用：spawn 后 backend 负责把 teammate 拉起来，
 *   teammate 自己通过 TeammateChannel 通信
 * - lifecycle: spawn → status 查询 → kill / shutdown
 * - 0 外部依赖
 */

/**
 * Spawn teammate 的输入参数。
 *
 * 与 cc SpawnTeammateConfig（spawnMultiAgent.ts:138-164）字段对齐。
 */
export interface SpawnTeammateInput {
	/** Teammate name（mailbox 索引、broadcast roster 用）。 */
	readonly name: string
	/** Team 名（隔离边界）。 */
	readonly teamName: string
	/** 初始 prompt（teammate 第一轮看到的 user message）。 */
	readonly prompt: string
	/** 短描述（UI 展示用）。 */
	readonly description?: string
	/** 模型 ID（如 'claude-sonnet-4-20250514' / 'inherit'）。 */
	readonly model?: string
	/** Agent type（指向 AgentRegistry 内的 manifest type）。 */
	readonly agentType?: string
	/** 工作目录（teammate 进程的 cwd）。 */
	readonly cwd?: string
	/** 是否 plan-mode required（teammate 启动后先 enter plan mode）。 */
	readonly planModeRequired?: boolean
	/** 业务扩展（model alias / tmux pane id 等）。 */
	readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Spawn teammate 的返回结果。
 *
 * 业务字段（tmuxPaneId / pid 等）通过 metadata 携带。
 */
export interface SpawnTeammateResult {
	/** 启动成功的 teammate name（与输入一致或 sanitize 后的）。 */
	readonly name: string
	/** Teammate 唯一 id（agentId 形态，typically uuid）。 */
	readonly agentId: string
	/** Team 名。 */
	readonly teamName: string
	/** 后端类型标识（如 'in-process' / 'tmux' / 'remote'）。 */
	readonly backendType: string
	/** 业务扩展（tmuxPaneId / sessionId / pid 等）。 */
	readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Teammate 状态查询结果。
 */
export type TeammateStatus =
	| 'starting'
	| 'running'
	| 'idle' // 等待新消息
	| 'shutting_down'
	| 'stopped'
	| 'failed'

export interface TeammateInfo {
	readonly agentId: string
	readonly name: string
	readonly teamName: string
	readonly backendType: string
	readonly status: TeammateStatus
	readonly startedAt: string
	readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * TeammateBackend 协议 — 注入到 ToolUseContext.kernel.teammateBackend。
 *
 * 4 类核心操作：
 * - spawn: 拉起一个 teammate（具体形态：同进程 / 子进程 / 远程 pod）
 * - status: 查询 teammate 当前状态
 * - kill: 强制结束 teammate（abort signal）
 * - shutdown: 优雅关闭（teammate 完成当前 turn 后退出）
 */
export interface TeammateBackend {
	/**
	 * 启动一个 teammate。
	 *
	 * 实现保证：
	 * - 同 name 已存在时抛错（caller 自决要不要 unregister + spawn）
	 * - spawn 后 status 应为 'starting' 或 'running'
	 * - teammate 启动完成后通过 TeammateChannel 接收消息
	 */
	spawn(input: SpawnTeammateInput): Promise<SpawnTeammateResult>

	/** 查询某个 teammate 当前信息。不存在返 null。 */
	status(agentId: string): Promise<TeammateInfo | null>

	/** 列出 team 内所有 teammate（含已停止）。 */
	list(teamName: string): Promise<readonly TeammateInfo[]>

	/**
	 * 强制结束 teammate（abort）。
	 *
	 * 实现保证：
	 * - status 立即变 'stopped' / 'failed'
	 * - teammate 进程 / 异步循环被 abort
	 * - mailbox 数据保留（caller 自决要不要清）
	 */
	kill(agentId: string, reason?: string): Promise<void>

	/**
	 * 请求 teammate 优雅关闭（完成当前 turn 后退出）。
	 *
	 * 实现保证：
	 * - 通过 TeammateChannel 发 shutdown_request 结构化消息
	 * - status 变 'shutting_down'
	 * - 实际退出由 teammate 自己决定（status_response 接受/拒绝）
	 */
	shutdown(agentId: string, reason?: string): Promise<void>

	/** 释放底层资源（kill all teammates / 关 fs handle / 等）。 */
	dispose?(): Promise<void>
}
