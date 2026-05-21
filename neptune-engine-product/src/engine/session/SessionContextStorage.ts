/**
 * SessionContextStorage — AsyncLocalStorage 管理逻辑
 *
 * 管理 SessionContext 的 AsyncLocalStorage 存储。
 * 从 SessionContext.ts 拆分出来，职责单一。
 */

import {AsyncLocalStorage} from 'async_hooks'
import type {SessionId} from '../types/ids.js'
import type {SessionContext} from './SessionContext.js'
import {
	tokenBudgetStates,
	type TokenBudgetState,
	initTokenBudgetState,
} from './TokenBudgetManager.js'

// ============================================================
// AsyncLocalStorage 实现
// ============================================================

const sessionContextStorage = new AsyncLocalStorage<SessionContext>()

// ============================================================
// SessionContext 访问接口
// ============================================================

/** 获取当前 SessionContext */
export function getSessionContext(): SessionContext | undefined {
	return sessionContextStorage.getStore()
}

/** 在 SessionContext 中执行函数 */
export function runInSessionContext<T>(
	ctx: SessionContext,
	fn: () => T,
): T {
	// 初始化 token budget 状态
	if (!tokenBudgetStates.has(ctx.sessionId)) {
		initTokenBudgetState(ctx.sessionId)
	}
	return sessionContextStorage.run(ctx, fn)
}

/** 在 SessionContext 中执行异步生成器函数
 *
 * 关键设计：不能仅在 run() 内创建 generator 后返回，因为
 * AsyncLocalStorage.run() 的作用域仅覆盖 fn() 的同步执行。
 * generator 的 .next() 调用发生在 run() 外部，ALS 上下文会丢失。
 *
 * 解决方案：返回一个 wrapper generator，每次迭代都显式在 run() 内执行，
 * 确保下游所有代码（包括 CC 原始代码中的 getSessionId() 调用）都能
 * 拿到正确的 session context。
 *
 * 资源清理：wrapper generator 需要正确处理 .return() 和 .throw()，
 * 确保内部 iterator 的 cleanup 逻辑被执行。
 */
export function runInSessionContextAsync<T>(
	ctx: SessionContext,
	fn: () => AsyncGenerator<T>,
): AsyncGenerator<T> {
	// 初始化 token budget 状态
	if (!tokenBudgetStates.has(ctx.sessionId)) {
		initTokenBudgetState(ctx.sessionId)
	}

	// 在 ALS 上下文内创建内部 generator
	const innerGen = sessionContextStorage.run(ctx, fn) as AsyncGenerator<T>

	// 创建手动实现的 AsyncIterator，确保正确处理 .return() 和 .throw()
	const iterator = innerGen[Symbol.asyncIterator]()

	// 使用对象字面量创建 AsyncGenerator，这样可以完全控制生命周期
	const asyncIterator: AsyncIterator<T> & {
		[Symbol.asyncIterator]: () => AsyncIterator<T>
	} = {
		async next(...args: [] | [T]): Promise<IteratorResult<T>> {
			// 每次 .next() 都在 ALS 上下文内执行，确保下游 getSessionId() 等可用
			return sessionContextStorage.run(ctx, () => iterator.next(...args))
		},

		async return(value?: T): Promise<IteratorResult<T>> {
			// 确保内部 iterator 的 cleanup 逻辑被执行
			return sessionContextStorage.run(ctx, () => {
				if (typeof iterator.return === 'function') {
					return iterator.return(value)
				}
				// 如果内部 iterator 没有 return 方法，返回完成状态
				return {done: true, value}
			})
		},

		async throw(e?: unknown): Promise<IteratorResult<T>> {
			// 确保内部 iterator 的 cleanup 逻辑被执行
			return sessionContextStorage.run(ctx, () => {
				if (typeof iterator.throw === 'function') {
					return iterator.throw(e)
				}
				// 如果内部 iterator 没有 throw 方法，抛出错误
				throw e
			})
		},

		[Symbol.asyncIterator]() {
			return this
		},
	}

	return asyncIterator as AsyncGenerator<T>
}

// ============================================================
// SessionContext 字段访问器
// ============================================================

/** 获取当前 sessionId */
export function getSessionId(): SessionId | undefined {
	return getSessionContext()?.sessionId
}

/** 获取当前 cwd */
export function getCwd(): string | undefined {
	return getSessionContext()?.cwd
}

/** 检查 session persistence 是否禁用 */
export function isSessionPersistenceDisabled(): boolean {
	return getSessionContext()?.sessionPersistenceDisabled ?? false
}

/** 获取 originalCwd */
export function getOriginalCwd(): string | undefined {
	return getSessionContext()?.originalCwd
}

/** 获取 projectRoot */
export function getProjectRoot(): string | undefined {
	return getSessionContext()?.projectRoot
}

/** 检查是否为远程模式 */
export function getIsRemoteMode(): boolean {
	return getSessionContext()?.isRemoteMode ?? false
}

/** 检查是否为非交互模式 */
export function getIsNonInteractiveSession(): boolean {
	const ctx = getSessionContext()
	if (!ctx) return true
	return !ctx.isInteractive
}

/** 检查是否为交互模式 */
export function getIsInteractive(): boolean {
	return getSessionContext()?.isInteractive ?? false
}

/** 获取当前记忆路径 */
export function getMemoryPath(): string | undefined {
	return getSessionContext()?.memoryPath
}

/** 更新 SessionContext 字段 */
export function updateSessionContext(
	updates: Partial<SessionContext>,
): SessionContext | undefined {
	const ctx = getSessionContext()
	if (!ctx) return undefined

	// 注意：AsyncLocalStorage 中的对象是可变的
	Object.assign(ctx, updates)
	return ctx
}

// ============================================================
// 向后兼容 API (deprecated)
// ============================================================

/**
 * @deprecated 使用 getSessionContext() 替代
 * 获取当前 sessionId（向后兼容）
 */
export function getCurrentSessionId(): SessionId | undefined {
	return getSessionId()
}

/**
 * @deprecated 使用 getSessionContext() 替代
 * 获取当前 cwd（向后兼容）
 */
export function getCurrentCwd(): string | undefined {
	return getCwd()
}

// ============================================================
// 重新导出 TokenBudgetState（保持向后兼容）
// ============================================================

export type {TokenBudgetState}
