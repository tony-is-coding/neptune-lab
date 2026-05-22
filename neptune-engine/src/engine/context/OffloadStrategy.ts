/**
 * OffloadStrategy — 上下文卸载策略接口
 *
 * 当工具输出过大时，将完整输出卸载到文件系统，
 * 仅保留摘要信息在上下文窗口中，避免 token 浪费。
 *
 * @internal 预留接口，待上下文卸载集成后使用
 *
 * 设计原则：
 * - 策略模式：通过接口定义卸载行为，支持自定义策略
 * - 阈值控制：通过 shouldOffload 判断是否需要卸载
 * - 摘要保留：卸载后保留预览信息，不丢失关键上下文
 */

// ============================================================
// 类型定义
// ============================================================

/**
 * 卸载操作的结果
 */
export interface OffloadResult {
	/** 卸载文件的完整路径 */
	filePath: string
	/** 替代原始输出的摘要信息 */
	summary: string
	/** 原始输出的大小（字节数） */
	originalSize: number
}

/**
 * OffloadStrategy — 上下文卸载策略接口
 *
 * 所有卸载策略都必须满足此接口。
 */
export interface OffloadStrategy {
	/**
	 * 判断是否需要卸载
	 *
	 * @param toolName 工具名称
	 * @param outputLength 输出长度（字节数）
	 * @returns 是否需要卸载
	 */
	shouldOffload(toolName: string, outputLength: number): boolean

	/**
	 * 执行卸载操作
	 *
	 * 将完整输出写入文件，返回包含摘要信息的结果。
	 *
	 * @param sessionId 会话 ID（用于隔离不同会话的卸载文件）
	 * @param toolName 工具名称
	 * @param output 完整的工具输出
	 * @returns 卸载结果
	 */
	offload(sessionId: string, toolName: string, output: string): Promise<OffloadResult>
}
