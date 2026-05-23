/**
 * Skill Protocol — 声明式 sub-agent 模板
 *
 * 设计原则（来自 docs/strategy/neptune-engine-runtime-kernel-design.md §3）：
 * - 协议层定义 SkillManifest 数据结构 + SkillRegistry 接口；engine 内置
 *   Markdown + YAML frontmatter 作为事实标准格式（SkillFormatter）
 * - SkillRegistry per-session 注入，不挂全局 singleton；createSession 时
 *   传入冻结快照，session 内不变
 * - 写入操作可异步（Promise），为持久化适配器预留；读取支持同步快照
 *   （prompt 注入用）和流式列表
 */

/** 一份 skill 的标准声明结构 */
export interface SkillManifest {
	/** 唯一标识，model 通过 Skill(name) 调用 */
	readonly name: string
	/** 给主 agent 看的能力描述（会被注入到 main system prompt 的 skill list） */
	readonly description: string
	/** 子 agent 启动时的 system prompt（markdown 正文） */
	readonly prompt: string
	/** 子 agent 允许使用的工具白名单；省略 = 继承主 agent 全集 */
	readonly tools?: readonly string[]
	/** 子 agent 显式禁用的工具 */
	readonly disallowedTools?: readonly string[]
	/** 子 agent 用什么模型；'inherit' = 跟主 agent；省略 = engine 默认 */
	readonly model?: 'inherit' | string
	/** 自定义元数据（product 可注入业务字段，engine 不解释也不依赖） */
	readonly metadata?: Readonly<Record<string, unknown>>
}

/** Skill 来源标识，用于审计和调试 */
export interface SkillSource {
	/** 来源类型：'filesystem' | 'plugin' | 'sdk-injected' | 任何 product 自定义 */
	readonly kind: string
	/** 具体来源标识（文件路径 / plugin id / 'inline'） */
	readonly origin: string
	/** 加载时间戳（ISO 8601） */
	readonly loadedAt: string
}

/** 注册 skill 时返回的 handle */
export interface RegisteredSkill {
	readonly manifest: SkillManifest
	readonly source: SkillSource
}

/**
 * SkillRegistry — 每个 session 独立持有的 skill 注册表。
 *
 * 实现合约：
 * - register/unregister 是写操作，可能异步（适配持久化后端）
 * - find/list/source 是读操作，必须返回 session 创建时的冻结快照视图
 * - 同名 skill 后注册 = 覆盖前一个；产品层若需要"插件优先级"应在送入 registry
 *   之前自行排序
 */
export interface SkillRegistry {
	register(manifest: SkillManifest, source: SkillSource): Promise<void>

	unregister(name: string): Promise<void>

	find(name: string): SkillManifest | undefined

	list(): readonly SkillManifest[]

	source(name: string): SkillSource | undefined
}
