/**
 * CancellationToken — 包装 AbortController，附加 reason 和 timestamp
 *
 * 设计原则：
 * - 让上层区分 user-abort vs watchdog-abort vs budget-abort vs error-abort
 * - 多次 abort 幂等（只记录第一次）
 * - 可链：父 token abort → 子 token 自动 abort（用于嵌套 subagent）
 *
 * 与 cc 行为差异：
 * - 不抄 cc 的 startSessionActivity / sessionActivity（业务关注点）
 * - 不抄 cc 的 streamWatchdogFiredAt 标记（合并到这里的 abortInfo）
 */

export type CancellationReason =
	| 'user'
	| 'watchdog'
	| 'budget'
	| 'error'
	| 'parent'
	| 'unknown'

export interface CancellationInfo {
	reason: CancellationReason
	timestamp: number
	detail?: string
}

export class CancellationToken {
	private readonly controller: AbortController
	private info: CancellationInfo | null = null
	private readonly children: CancellationToken[] = []

	constructor(controller: AbortController = new AbortController()) {
		this.controller = controller
	}

	/** 拿到底层 AbortController（注入给 fetch / SDK / tool）。 */
	get abortController(): AbortController {
		return this.controller
	}

	/** 拿到 AbortSignal。 */
	get signal(): AbortSignal {
		return this.controller.signal
	}

	/** 已经 abort 了？ */
	get aborted(): boolean {
		return this.controller.signal.aborted
	}

	/** 拿到 abort 信息（reason + timestamp）；未 abort 时返回 null。 */
	get cancellationInfo(): CancellationInfo | null {
		return this.info
	}

	/**
	 * 触发 abort。多次调用幂等（只记录第一次的 reason）。
	 *
	 * @param reason 触发来源
	 * @param detail 可选描述
	 */
	cancel(reason: CancellationReason, detail?: string): void {
		if (this.info !== null) return // 已经 abort，幂等
		this.info = {reason, timestamp: Date.now(), detail}
		try {
			this.controller.abort()
		} catch {
			// node 某些版本 abort 可能 throw，吞掉避免污染
		}
		// 级联 abort 子 token
		for (const child of this.children) {
			child.cancel('parent', `parent cancelled: ${reason}`)
		}
	}

	/**
	 * 创建子 token：父 token abort 时自动 abort 子。
	 * 用于嵌套 agent / subagent 场景。
	 */
	createChild(): CancellationToken {
		const child = new CancellationToken()
		this.children.push(child)
		// 如果父已经 abort，立即 abort 子
		if (this.aborted) {
			child.cancel('parent', `parent already cancelled: ${this.info?.reason}`)
		}
		return child
	}
}
