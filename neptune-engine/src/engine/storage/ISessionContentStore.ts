/**
 * ISessionContentStore — Session 内容存储接口
 *
 * 定义按 session 的追加写入存储抽象。
 * 用于存储会话的增量内容（如消息、日志等）。
 *
 * 设计原则：
 * - 按 sessionId 隔离数据
 * - 支持追加写入（append）
 * - 支持读取和截断
 * - 异步接口，支持多种存储后端
 */

/**
 * 读取选项
 */
export interface ReadOptions {
	/** 起始位置（从 0 开始） */
	from?: number
	/** 结束位置（不包含） */
	to?: number
	/** 最大返回条数 */
	limit?: number
}

/**
 * Session 内容项
 */
export interface SessionContentItem {
	/** 内容 */
	content: string
	/** 时间戳 */
	timestamp: number
	/** 可选的元数据 */
	metadata?: Record<string, unknown>
}

/**
 * Session 内容存储接口
 *
 * 提供按 session 隔离的内容存储功能。
 */
export interface ISessionContentStore {
	/**
	 * 追加内容
	 *
	 * @param sessionId Session ID
	 * @param content 内容
	 * @param metadata 可选的元数据
	 */
	append(sessionId: string, content: string, metadata?: Record<string, unknown>): Promise<void>

	/**
	 * 读取内容
	 *
	 * @param sessionId Session ID
	 * @param options 读取选项
	 * @returns 内容项数组
	 */
	read(sessionId: string, options?: ReadOptions): Promise<SessionContentItem[]>

	/**
	 * 截断内容，只保留最后 N 条
	 *
	 * @param sessionId Session ID
	 * @param keepLastN 保留的条数
	 */
	truncate(sessionId: string, keepLastN: number): Promise<void>

	/**
	 * 获取内容条数
	 *
	 * @param sessionId Session ID
	 * @returns 内容条数
	 */
	count(sessionId: string): Promise<number>

	/**
	 * 清理指定 Session 的所有内容
	 *
	 * @param sessionId Session ID
	 */
	clear(sessionId: string): Promise<void>

	/**
	 * 释放存储资源
	 */
	dispose(): Promise<void>
}
