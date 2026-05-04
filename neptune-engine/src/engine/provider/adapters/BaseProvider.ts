/**
 * BaseProvider — Provider 适配器的抽象基类
 *
 * 设计原则：
 * - 提取共同模式，消除代码重复
 * - 抽象类而非接口，可包含具体实现
 * - 子类只需实现 query() 方法的 API 调用差异
 *
 * 共同功能：
 * - buildOptions(): 构建查询选项（所有 Provider 共同）
 * - convertToProviderMessage(): 转换流式事件（所有 Provider 共同）
 * - createErrorResponse(): 创建错误响应（所有 Provider 共同）
 */

import type { ProviderAdapter, ProviderQueryParams, ProviderMessage } from '../ProviderAdapter.js'
import type { Options } from '../../../services/api/claude.js'
import { getEmptyToolPermissionContext } from '../../../Tool.js'
import { EngineErrorCode, type EngineErrorCodeType } from '../../errors.js'
import { APIConnectionError, APIConnectionTimeoutError, APIError } from '@anthropic-ai/sdk'
import { LogUtil } from '../../log/LogUtil.js'
import { CircuitBreaker, type CircuitBreakerStateChangedEvent } from '../CircuitBreaker.js'
import { EventBus } from '../../events/EventBus.js'

// ============================================================
// 类型定义
// ============================================================

/**
 * Base Provider 的配置项基础类型
 *
 * 所有 Provider Config 都应至少包含 defaultModel。
 */
export interface BaseProviderConfig {
  /** 默认模型（可选） */
  defaultModel?: string
  /** 重试配置（可选） */
  retryConfig?: RetryConfig
  /** 其他配置 */
  [key: string]: unknown
}

/**
 * 重试配置
 *
 * 控制 Provider 在遇到可重试错误时的重试行为。
 */
export interface RetryConfig {
  /** 最大重试次数（默认 3） */
  maxRetries: number
  /** 指数退避基数，单位毫秒（默认 1000） */
  backoffMs: number
  /** 可重试的错误码列表（默认包含 RATE_LIMIT 和 NETWORK_ERROR） */
  retryableErrors: EngineErrorCodeType[]
}

// ============================================================
// BaseProvider 抽象类
// ============================================================

/**
 * Provider 适配器的抽象基类
 *
 * 提供所有 Provider 的共同实现，子类只需实现 query() 方法。
 *
 * @template TConfig Provider 配置类型
 */
export abstract class BaseProvider<TConfig extends BaseProviderConfig = BaseProviderConfig>
  implements ProviderAdapter {
  /** Provider 类型标识（由子类定义） */
  abstract readonly type: string

  protected readonly config: TConfig

  /** 每个 Provider 独立的熔断器实例（延迟初始化） */
  protected _circuitBreaker?: CircuitBreaker

  /** 全局 EventBus 实例（可选） */
  protected eventBus?: EventBus

  /** 获取 CircuitBreaker 实例（public 供 bridge 层访问） */
  public get circuitBreaker(): CircuitBreaker {
    if (!this._circuitBreaker) {
      this._circuitBreaker = new CircuitBreaker(
        `provider-${this.type}`,
        {
          failureThreshold: 5,
          resetTimeoutMs: 30000,
          halfOpenMaxCalls: 3,
          // 状态变化时发布事件到 EventBus
          onStateChanged: (event: CircuitBreakerStateChangedEvent) => {
            this.onCircuitBreakerStateChanged(event)
          },
        }
      )
    }
    return this._circuitBreaker
  }

  /**
   * 设置 EventBus（用于发布熔断状态事件）
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus
  }

  /**
   * 熔断器状态变化回调
   */
  protected onCircuitBreakerStateChanged(event: CircuitBreakerStateChangedEvent): void {
    if (!this.eventBus) return

    // 映射状态到事件类型
    const eventType = `circuit_${event.newState}`
    this.eventBus.emit(eventType, {
      provider: this.type,
      circuitBreaker: event.name,
      oldState: event.oldState,
      newState: event.newState,
      timestamp: event.timestamp,
    })

    LogUtil.debug(`CircuitBreaker state changed: ${event.oldState} -> ${event.newState}`, {
      provider: this.type,
      circuitBreaker: event.name,
    })
  }

  /** 默认重试配置 */
  protected static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    backoffMs: 1000,
    retryableErrors: [EngineErrorCode.RATE_LIMIT, EngineErrorCode.NETWORK_ERROR],
  }

  constructor(config?: TConfig) {
    this.config = config ?? ({} as TConfig)
  }

  /**
   * 获取 Provider 配置
   */
  getConfig(): Readonly<TConfig> {
    return this.config
  }

  /**
   * 流式查询方法（由子类实现）
   *
   * @param params 查询参数
   * @returns 异步生成器，产出 ProviderMessage
   */
  abstract query(params: ProviderQueryParams): AsyncGenerator<ProviderMessage>

  /**
   * 构建查询选项
   *
   * 所有 Provider 共同的选项构建逻辑。
   *
   * @param params 查询参数
   * @returns Options 对象（非 any）
   */
  protected buildOptions(params: ProviderQueryParams): Options {
    return {
      model: params.model || this.config.defaultModel || '',
      getToolPermissionContext: async () => getEmptyToolPermissionContext(),
      toolChoice: undefined,
      isNonInteractiveSession: true,
      extraToolSchemas: [],
      maxOutputTokensOverride: params.maxTokens,
      querySource: 'sdk',
      agents: [],
      hasAppendSystemPrompt: false,
      enablePromptCaching: false,
      mcpTools: [],
    }
  }

  /**
   * 将 CC 的事件转换为 ProviderMessage
   *
   * 所有 Provider 共同的事件转换逻辑。
   *
   * @param event CC 原始事件
   * @returns 标准化的 ProviderMessage
   */
  protected convertToProviderMessage(event: any): ProviderMessage {
    if (event.type === 'text_delta' || event.type === 'text') {
      return {
        type: 'text',
        content: event.text || event.delta?.text || '',
      }
    }
    if (event.type === 'tool_use') {
      return {
        type: 'tool_use',
        content: event,
      }
    }
    if (event.type === 'tool_result') {
      return {
        type: 'tool_result',
        content: event,
      }
    }
    return {
      type: 'message',
      content: event,
    }
  }

  /**
   * 创建错误响应
   *
   * 将错误转换为标准 ProviderMessage 格式，并根据 API 错误类型映射到对应的 EngineErrorCode。
   *
   * @param error 错误对象
   * @returns 错误类型的 ProviderMessage
   */
  protected createErrorResponse(error: unknown): ProviderMessage {
    const errorCode = this.classifyError(error)
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      type: 'message',
      content: {
        type: 'error',
        error: errorMessage,
        errorCode,
      },
    }
  }

  /**
   * 分类错误类型
   *
   * @planned V19 接入计划
   *
   * 根据 API 错误的具体类型映射到对应的 EngineErrorCode。
   *
   * @param error 错误对象
   * @returns 错误码
   *
   * **V19 接入计划**：
   * 1. 与 CircuitBreaker 配合，根据错误类型决定是否触发熔断
   * 2. 添加更细粒度的错误分类（如区分不同类型的网络错误）
   * 3. 支持自定义错误分类器
   */
  protected classifyError(error: unknown): EngineErrorCodeType {
    // 类型守卫：检查是否为带有 status 属性的 APIError
    const hasStatus = (err: unknown): err is APIError & { status: number } => {
      return err instanceof APIError || (err instanceof Error && 'status' in err && typeof (err as any).status === 'number')
    }

    // 认证错误（401, 403）
    if (hasStatus(error) && (error.status === 401 || error.status === 403)) {
      return EngineErrorCode.AUTH_ERROR
    }

    // 速率限制错误（429, 529）
    if (hasStatus(error) && (error.status === 429 || error.status === 529)) {
      return EngineErrorCode.RATE_LIMIT
    }

    // Provider/模型未找到（404）
    if (hasStatus(error) && error.status === 404) {
      return EngineErrorCode.PROVIDER_NOT_FOUND
    }

    // 网络连接错误（包括超时、502、503）
    if (
      error instanceof APIConnectionError ||
      error instanceof APIConnectionTimeoutError ||
      (hasStatus(error) && (error.status === 502 || error.status === 503)) ||
      (error instanceof Error && error.message.toLowerCase().includes('timeout')) ||
      (error instanceof Error && error.message.toLowerCase().includes('econnrefused')) ||
      (error instanceof Error && error.message.toLowerCase().includes('enotfound'))
    ) {
      return EngineErrorCode.NETWORK_ERROR
    }

    // 默认执行错误
    return EngineErrorCode.EXECUTION_ERROR
  }

  /**
   * 获取有效的重试配置
   *
   * 合并默认配置和用户自定义配置。
   */
  protected getRetryConfig(): RetryConfig {
    return {
      ...BaseProvider.DEFAULT_RETRY_CONFIG,
      ...this.config.retryConfig,
    }
  }

  /**
   * 检查错误是否可重试
   *
   * @param error 错误对象
   * @returns 是否可重试
   */
  protected isRetryableError(error: unknown): boolean {
    const errorCode = this.classifyError(error)
    const retryConfig = this.getRetryConfig()
    return retryConfig.retryableErrors.includes(errorCode)
  }

  /**
   * 执行带重试的异步操作
   *
   * @planned V19 接入计划
   *
   * @param fn 要执行的异步函数
   * @returns 函数执行结果
   *
   * **V19 接入计划**：
   * 1. 集成 CircuitBreaker 到重试逻辑中
   * 2. 在重试前检查熔断器状态
   * 3. 熔断器打开时直接拒绝请求
   * 4. 添加重试和熔断的 Metrics 埋点
   */
  protected async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    const retryConfig = this.getRetryConfig()
    let lastError: unknown

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error

        // 最后一次尝试失败，不再重试
        if (attempt === retryConfig.maxRetries) {
          break
        }

        // 检查是否可重试
        if (!this.isRetryableError(error)) {
          // 不可重试的错误直接抛出
          throw error
        }

        // 计算退避时间（指数退避）
        const backoffTime = retryConfig.backoffMs * Math.pow(2, attempt)
        LogUtil.debug(`Provider 重试 ${attempt + 1}/${retryConfig.maxRetries}`, {
          providerType: this.type,
          errorCode: this.classifyError(error),
          backoffTime,
        })

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, backoffTime))
      }
    }

    // 所有重试都失败，抛出最后一个错误
    throw lastError
  }
}
