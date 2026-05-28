/**
 * AgentRegistry — Substrate 协议：sub-agent 注册与发现
 *
 * 设计目标（Stage 3.2）：
 * - engine 不感知具体 agent 业务（cc 的 builtInAgents、teammate 模式等）
 * - product 注入业务 manifest，engine 通过 ctx.kernel.agentRegistry 提供给工具
 * - AgentRegistry 是 stateless 协议；具体后端可以是 InMemory / Filesystem / DB
 *
 * 与 cc 行为对齐：
 * - AgentManifest 提取 cc AgentDefinition 的稳定核心字段（type/name/description/
 *   tools/systemPrompt/modelHint/metadata）
 * - 不内嵌 React UI 字段、telemetry 字段等业务关注点 —— 走 metadata 字典扩展
 */

/**
 * Agent manifest — 描述一个可启动的 agent 模板。
 *
 * 业务字段（color / icon / sourceFile 等）通过 metadata 扩展。
 */
export interface AgentManifest {
	/** 唯一类型标识（如 'general-purpose' / 'reviewer' / 'tester'）。 */
	type: string
	/** 展示名（默认与 type 相同）。 */
	name?: string
	/** 模型可见的描述（影响 LLM 选择哪个 agent）。 */
	description: string
	/** 可用工具 name 列表（undefined = 全部可用）。 */
	tools?: string[]
	/** systemPrompt 文本（运行时按 modelHint 选模型 + 注入此 prompt）。 */
	systemPrompt?: string
	/** 推荐模型（如 'sonnet' / 'haiku'）。 */
	modelHint?: string
	/** 业务方扩展字段：color / icon / sourceFile / hooks / etc. */
	metadata?: Record<string, unknown>
}

/**
 * AgentRegistry 接口 — 注入到 ToolUseContext.kernel.agentRegistry。
 *
 * 所有方法返 Promise（兼容 fs / DB 后端）。
 *
 * Stage B1.3 — 增加 getBuiltIns() 协议方法，让 substrate 默认提供
 * baseline agents（generalPurpose / explore / plan / verification）。
 * Default 实现可选 —— 不实现时返回 []，不破坏现有 product 自定义注册表。
 */
export interface AgentRegistry {
	/** 按 type 取一个 manifest；不存在返 undefined。 */
	get(type: string): Promise<AgentManifest | undefined>
	/** 列出全部 manifest（按注册顺序）。 */
	list(): Promise<AgentManifest[]>
	/** 注册一个 manifest（同 type 覆盖）。 */
	register(manifest: AgentManifest): Promise<void>
	/** 注销一个 manifest（不存在不报错）。 */
	unregister(type: string): Promise<void>
	/**
	 * Stage B1.3 — 列出 substrate 提供的 baseline agents。
	 *
	 * 设计目的：
	 * - 让 product / SDK 用户开箱即用 4 个 cc 已证明的内置 agent 模板
	 * - product 可以选择 register 这些 baseline 到自己的 registry，或
	 *   完全 override 用自家 manifest
	 *
	 * 默认实现可选；返回 [] 表示不提供 baseline。
	 */
	getBuiltIns?(): readonly AgentManifest[]
}
