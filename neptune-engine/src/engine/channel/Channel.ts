/**
 * Channel — 多 agent 通讯接口（substrate 协议预留）
 *
 * 设计目标（Stage 4.2）：
 * - 让 multi-agent 场景（A 给 B 发消息）有一个稳定接口
 * - engine 不实现具体后端（Redis pubsub / NATS / WebSocket / etc）
 * - 只提供 InMemoryChannel 作为单进程默认（测试 + 单机 multi-agent）
 *
 * 与 cc 行为差异：
 * - cc 通过 SendMessageTool / TeammateTask 等业务工具实现 multi-agent
 *   通讯；这里抽象为 Channel 协议（与具体工具解耦）
 * - product 可基于 Channel 接口实现 SendMessageTool（例如 wrap Redis
 *   pubsub）
 *
 * 设计原则：
 * - target 是字符串（agent id / topic / room name）
 * - send(target, message)：单播
 * - receive(target)：拉一条（不可阻塞 substrate 主循环；返 null 表示无消息）
 * - subscribe(target)：流式订阅（AsyncIterable，订阅者循环消费）
 * - 不假设 message 类型（unknown，业务自定义）
 */

export interface Channel<T = unknown> {
	/** 发送一条消息到 target。 */
	send(target: string, message: T): Promise<void>

	/**
	 * 取出一条 target 的待处理消息。无消息返 null。
	 *
	 * 实现可以是 FIFO 队列（默认）或 broadcast last-wins（业务自定义）。
	 */
	receive(target: string): Promise<T | null>

	/**
	 * 流式订阅 target —— 返回 AsyncIterable，每个新消息 yield 一次。
	 *
	 * 订阅完成时 caller 应 break 或调 generator.return() 释放资源。
	 * 同一 target 多个订阅者：每条消息对每个订阅者各 yield 一次（fan-out）。
	 */
	subscribe(target: string): AsyncIterable<T>

	/** 释放底层资源。 */
	dispose?(): Promise<void>
}
