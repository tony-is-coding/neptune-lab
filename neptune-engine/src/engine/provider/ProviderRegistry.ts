/**
 * ProviderRegistry — Provider 注册表
 *
 * 管理多个 ProviderAdapter 实例，支持：
 * - 注册 Provider（register）
 * - 获取 Provider（get）
 * - 列出所有已注册 Provider（list）
 * - 默认注册 Anthropic Provider
 *
 * 设计原则：
 * - 单例模式：全局唯一的注册表实例
 * - 类型安全：注册和获取都带类型检查
 * - 向后兼容：默认包含 Anthropic Provider，确保现有代码不受影响
 * - 优雅降级：可选依赖不可用时跳过注册
 */

import type {ProviderAdapter} from './ProviderAdapter.js'
import {OpenAIProvider} from './adapters/OpenAIProvider.js'
import {GeminiProvider} from './adapters/GeminiProvider.js'
import {GrokProvider} from './adapters/GrokProvider.js'
import {EngineError, EngineErrorCode} from '../errors.js'
import {LogUtil} from '../log/index.js'

/**
 * 安全导入可选 Provider
 * 如果依赖不可用，返回 null
 */
async function safeImportProvider<T>(
	importer: () => Promise<T>,
	providerName: string,
): Promise<T | null> {
	try {
		return await importer()
	} catch (error) {
		LogUtil.debug(`Provider '${providerName}' is not available (optional dependency)`)
		return null
	}
}

// ============================================================
// ProviderRegistry 实现
// ============================================================

/**
 * Provider 注册表
 *
 * 管理 ProviderAdapter 实例的注册、查询和列举。
 * 默认包含 'anthropic' Provider。
 */
export class ProviderRegistry {
	private providers = new Map<string, ProviderAdapter>()

	/**
	 * 注册一个 Provider
	 *
	 * @param type Provider 类型标识
	 * @param adapter ProviderAdapter 实例
	 * @throws 如果 type 已被注册（防止意外覆盖）
	 */
	register(type: string, adapter: ProviderAdapter): void {
		if (this.providers.has(type)) {
			throw new EngineError(
				EngineErrorCode.CONFIGURATION_ERROR,
				`Provider '${type}' is already registered. Use unregister() first if you want to replace it.`,
			)
		}
		this.providers.set(type, adapter)
	}

	/**
	 * 注销一个 Provider
	 *
	 * @param type Provider 类型标识
	 * @returns 是否成功注销
	 */
	unregister(type: string): boolean {
		return this.providers.delete(type)
	}

	/**
	 * 获取指定类型的 Provider
	 *
	 * @param type Provider 类型标识
	 * @returns ProviderAdapter 实例，未找到返回 undefined
	 */
	get(type: string): ProviderAdapter | undefined {
		return this.providers.get(type)
	}

	/**
	 * 检查指定类型的 Provider 是否已注册
	 *
	 * @param type Provider 类型标识
	 */
	has(type: string): boolean {
		return this.providers.has(type)
	}

	/**
	 * 列出所有已注册的 Provider 类型
	 *
	 * @returns Provider 类型标识数组
	 */
	list(): string[] {
		return Array.from(this.providers.keys())
	}

	/**
	 * 获取所有已注册的 Provider
	 *
	 * @returns Provider 类型到实例的映射
	 */
	getAll(): ReadonlyMap<string, ProviderAdapter> {
		return this.providers
	}

	/**
	 * 清空所有已注册的 Provider（仅用于测试）
	 */
	clear(): void {
		this.providers.clear()
	}
}

// ============================================================
// 全局单例与工厂
// ============================================================

/** 全局注册表单例 */
let globalRegistry: ProviderRegistry | null = null

/**
 * 获取全局 ProviderRegistry 单例
 *
 * 首次调用时自动注册默认的 Anthropic Provider 和其他可用 Provider。
 * 可选依赖不可用时优雅降级。
 */
export async function getGlobalProviderRegistry(): Promise<ProviderRegistry> {
	if (!globalRegistry) {
		globalRegistry = new ProviderRegistry()

		// 注册核心 Provider。Anthropic 的实现会加载 CC API 调用链，保持懒加载
		// 避免仅导入 engine 公共 API 时把 CLI UI 模块带入后端进程。
		const {AnthropicProvider} = await import('./adapters/AnthropicProvider.js')
		globalRegistry.register('anthropic', new AnthropicProvider())
		globalRegistry.register('openai', new OpenAIProvider())
		globalRegistry.register('gemini', new GeminiProvider())
		globalRegistry.register('grok', new GrokProvider())

		// 尝试注册可选 Provider
		try {
			const {BedrockProvider} = await import('./adapters/BedrockProvider.js')
			globalRegistry.register('bedrock', new BedrockProvider())
		} catch {
			LogUtil.debug('Bedrock Provider not available (optional dependency)')
		}

		try {
			const {VertexProvider} = await import('./adapters/VertexProvider.js')
			globalRegistry.register('vertex', new VertexProvider())
		} catch {
			LogUtil.debug('Vertex Provider not available (optional dependency)')
		}

		try {
			const {FoundryProvider} = await import('./adapters/FoundryProvider.js')
			globalRegistry.register('foundry', new FoundryProvider())
		} catch {
			LogUtil.debug('Foundry Provider not available (optional dependency)')
		}
	}
	return globalRegistry
}

/**
 * 重置全局注册表（仅用于测试）
 */
export function resetGlobalProviderRegistryForTesting(): void {
	if (globalRegistry) {
		globalRegistry.clear()
	}
	globalRegistry = null
}
