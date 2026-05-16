import {randomUUID} from 'crypto'
import {EngineError, EngineErrorCode} from './errors.js'
import type {SessionStatus, SessionConfig, EngineSnapshot, SessionContextSnapshot, ProviderConfig} from './types'
import {SERIALIZATION_PROTOCOL_VERSION} from './types'

/** Session 快照数据，用于持久化往返 */
export interface SessionSnapshot {
	sessionId: string
	workspace: string
	createdAt: number
	status: SessionStatus
	metadata: Record<string, unknown>
	/** per-session 系统提示词（可选） */
	systemPrompt?: string | (() => Promise<string>)
	/** per-session Provider 配置（可选） */
	providerConfig?: ProviderConfig
}

/**
 * Session 纯数据实体
 * 管理 sessionId、workspace、status、metadata、systemPrompt、providerConfig
 * 不依赖任何 LLM 或外部服务
 */
export class Session {
	readonly sessionId: string
	readonly workspace: string
	readonly createdAt: number

	private _status: SessionStatus
	private _metadata: Record<string, unknown>
	/** per-session 系统提示词（可选） */
	private _systemPrompt?: string | (() => Promise<string>)
	/** per-session Provider 配置（可选） */
	private _providerConfig?: ProviderConfig

	constructor(config: SessionConfig & {
		systemPrompt?: string | (() => Promise<string>);
		providerConfig?: ProviderConfig
	}, sessionId?: string) {
		this.sessionId = sessionId ?? randomUUID()
		this.workspace = config.workspace
		this.createdAt = Date.now()
		this._status = 'active'
		this._metadata = config.metadata ?? {}
		this._systemPrompt = config.systemPrompt
		this._providerConfig = config.providerConfig
	}

	/** 从快照恢复 Session 实例（用于持久化加载） */
	static restore(snapshot: SessionSnapshot): Session {
		const session = Object.create(Session.prototype) as Session
		;(session as any).sessionId = snapshot.sessionId
		;(session as any).workspace = snapshot.workspace
		;(session as any).createdAt = snapshot.createdAt
		session._status = snapshot.status
		session._metadata = {...snapshot.metadata}
		session._systemPrompt = snapshot.systemPrompt
		session._providerConfig = snapshot.providerConfig
		return session
	}

	/** 导出快照数据（用于持久化保存） */
	toSnapshot(): SessionSnapshot {
		return {
			sessionId: this.sessionId,
			workspace: this.workspace,
			createdAt: this.createdAt,
			status: this._status,
			metadata: {...this._metadata},
			systemPrompt: this._systemPrompt,
			providerConfig: this._providerConfig,
		}
	}

	/**
	 * 导出包含 SessionContext 的完整引擎快照（用于跨进程传输）
	 *
	 * @param contextSnapshot SessionContext 核心字段的快照
	 * @returns 可 JSON 序列化的 EngineSnapshot
	 */
	toEngineSnapshot(contextSnapshot: SessionContextSnapshot): EngineSnapshot {
		return {
			version: SERIALIZATION_PROTOCOL_VERSION,
			session: this.toSnapshot(),
			context: contextSnapshot,
		}
	}

	get status(): SessionStatus {
		return this._status
	}

	// 暂停 Session，已暂停则无副作用
	pause(): void {
		if (this._status === 'destroyed') {
			throw new EngineError(EngineErrorCode.SESSION_INVALID_OPERATION, 'Cannot operate on a destroyed session')
		}
		this._status = 'paused'
	}

	// 恢复 Session，已激活则无副作用
	resume(): void {
		if (this._status === 'destroyed') {
			throw new EngineError(EngineErrorCode.SESSION_INVALID_OPERATION, 'Cannot operate on a destroyed session')
		}
		this._status = 'active'
	}

	// 销毁 Session，不可逆
	destroy(): void {
		if (this._status === 'destroyed') {
			throw new EngineError(EngineErrorCode.SESSION_ALREADY_DESTROYED, 'Session is already destroyed')
		}
		this._status = 'destroyed'
	}

	// 设置 metadata 键值对
	setMetadata(key: string, value: unknown): void {
		if (this._status === 'destroyed') {
			throw new EngineError(EngineErrorCode.SESSION_INVALID_OPERATION, 'Cannot operate on a destroyed session')
		}
		this._metadata[key] = value
	}

	// 获取 metadata，无参数返回全部，有参数返回指定 key
	getMetadata(): Record<string, unknown>
	getMetadata(key: string): unknown
	getMetadata(key?: string): unknown {
		if (key !== undefined) {
			return this._metadata[key]
		}
		return {...this._metadata}
	}

	// 获取 systemPrompt
	getSystemPrompt(): string | (() => Promise<string>) | undefined {
		return this._systemPrompt
	}

	// 设置 systemPrompt
	setSystemPrompt(systemPrompt: string | (() => Promise<string>)): void {
		if (this._status === 'destroyed') {
			throw new EngineError(EngineErrorCode.SESSION_INVALID_OPERATION, 'Cannot operate on a destroyed session')
		}
		this._systemPrompt = systemPrompt
	}

	// 获取 providerConfig
	getProviderConfig(): ProviderConfig | undefined {
		return this._providerConfig
	}

	// 设置 providerConfig
	setProviderConfig(providerConfig: ProviderConfig): void {
		if (this._status === 'destroyed') {
			throw new EngineError(EngineErrorCode.SESSION_INVALID_OPERATION, 'Cannot operate on a destroyed session')
		}
		this._providerConfig = providerConfig
	}
}
