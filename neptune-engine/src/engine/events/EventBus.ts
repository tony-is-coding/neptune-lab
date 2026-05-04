/**
 * EventBus — 内部事件系统
 *
 * 纯内存实现的发布/订阅 + Hook 拦截管道，支持 Session 级事件过滤。
 *
 * 功能：
 * - 发布/订阅：监听特定类型的事件
 * - Hook 拦截：在事件分发前拦截或修改事件
 * - Session 过滤：只监听特定 Session 的事件
 *
 * @example
 * ```typescript
 * const bus = new EventBus()
 *
 * // 订阅事件
 * bus.subscribe('session:created', (data) => {
 *   console.log('New session:', data)
 * })
 *
 * // 发送事件
 * bus.emit('session:created', { sessionId: 'abc-123' })
 *
 * // 添加 Hook
 * bus.addHook('session:created', (data) => {
 *   console.log('Session created hook:', data)
 *   return true // 继续传播
 * })
 * ```
 */

import { SERIALIZATION_PROTOCOL_VERSION, type EventBusMessage } from '../types.js'
import { LogUtil } from '../log/index.js'

/** 事件处理函数 */
export type EventHandler = (payload: unknown) => void;

/** Hook 函数，返回 true 继续传播，返回 false 阻止传播 */
export type HookFn = (payload: unknown) => boolean;

/** subscribe 的可选参数 */
export interface SubscribeOptions {
  sessionId?: string;
}

/** 内部监听器记录 */
interface Listener {
  handler: EventHandler;
  sessionId?: string;
}

/**
 * EventBus 类
 * 提供事件发布/订阅和 Hook 拦截功能
 */
export class EventBus {
  /** 事件类型 -> 监听器列表 */
  private listeners = new Map<string, Listener[]>();
  /** 事件类型 -> Hook 列表（按注册顺序执行） */
  private hooks = new Map<string, HookFn[]>();
  /** TTL timer 引用列表，用于 clear 时清理 */
  private ttlTimers: ReturnType<typeof setTimeout>[] = [];
  /** 每个事件类型的最大监听器数量（默认 50） */
  private maxListeners = 50;

  /** 获取或设置 maxListeners */
  setMaxListeners(max: number): void {
    this.maxListeners = max
  }

  /** 注册监听器，可通过 options.sessionId 过滤特定 Session 的事件，返回取消函数 */
  subscribe(type: string, handler: EventHandler, options?: SubscribeOptions): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    const listenerList = this.listeners.get(type)!;

    // 检查监听器数量是否超过 maxListeners
    if (listenerList.length >= this.maxListeners) {
      LogUtil.warn(
        `EventBus: Possible memory leak detected. ${listenerList.length} ${type} listeners added. ` +
        `Use emitter.setMaxListeners() to increase limit (current: ${this.maxListeners})`
      );
    }

    const listener: Listener = {
      handler,
      sessionId: options?.sessionId,
    };
    listenerList.push(listener);

    // 返回取消函数
    return () => {
      const idx = listenerList.indexOf(listener);
      if (idx !== -1) {
        listenerList.splice(idx, 1);
      }
    };
  }

  /** 注册监听器并返回取消函数，支持可选的 TTL 自动取消和 options */
  on(type: string, handler: EventHandler, ttlMs?: number, options?: SubscribeOptions): () => void {
    const unsubscribe = this.subscribe(type, handler, options);

    if (ttlMs !== undefined) {
      const timer = setTimeout(() => {
        unsubscribe();
        const idx = this.ttlTimers.indexOf(timer);
        if (idx !== -1) {
          this.ttlTimers.splice(idx, 1);
        }
      }, ttlMs);
      this.ttlTimers.push(timer);

      // 返回一个同时清理 TTL timer 的取消函数
      return () => {
        unsubscribe();
        const idx = this.ttlTimers.indexOf(timer);
        if (idx !== -1) {
          this.ttlTimers.splice(idx, 1);
        }
        clearTimeout(timer);
      };
    }

    return unsubscribe;
  }

  /** 触发事件，先经过 Hook 管道，再分发给监听器 */
  emit(type: string, payload: unknown, sessionId?: string): void {
    // 执行 Hook 管道
    const hookList = this.hooks.get(type);
    if (hookList) {
      for (const hookFn of hookList) {
        try {
          const result = hookFn(payload);
          if (result === false) {
            // Hook 阻止传播，不再执行后续 Hook 和监听器
            return;
          }
        } catch (e) {
          // Hook 出错时记录警告，发出 error 事件，但继续执行后续 Hook
          const error = e instanceof Error ? e : new Error(String(e));
          LogUtil.warn(`EventBus Hook for "${type}" threw error`, { error: String(e) });
          // 发出 error 事件，不静默吞没
          this.emitError(error, { source: 'hook', eventType: type, sessionId });
        }
      }
    }

    // 分发给匹配的监听器
    const listenerList = this.listeners.get(type);
    if (!listenerList) return;

    for (const listener of listenerList) {
      // 监听器未指定 sessionId -> 全局监听，收到所有事件
      // 监听器指定了 sessionId -> 只收到 emit 时 sessionId 匹配的事件
      if (listener.sessionId === undefined || listener.sessionId === sessionId) {
        try {
          listener.handler(payload);
        } catch (e) {
          // 监听器出错时记录警告，发出 error 事件，但继续执行后续监听器
          const error = e instanceof Error ? e : new Error(String(e));
          LogUtil.warn(`EventBus Listener for "${type}" threw error`, { error: String(e) });
          // 发出 error 事件，不静默吞没
          this.emitError(error, { source: 'listener', eventType: type, sessionId });
        }
      }
    }
  }

  /**
   * 发出 error 事件
   *
   * 当 Hook 或监听器抛出错误时调用，确保错误不被静默吞没。
   *
   * @param error 错误对象
   * @param context 错误上下文信息
   */
  private emitError(error: Error, context: {
    source: 'hook' | 'listener'
    eventType: string
    sessionId?: string
  }): void {
    // 尝试发送 error 事件，但不陷入无限递归
    try {
      const errorPayload = {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        context,
      };
      // 直接调用监听器，避免再次触发 Hook 管道
      const errorListeners = this.listeners.get('error');
      if (errorListeners) {
        for (const listener of errorListeners) {
          if (listener.sessionId === undefined || listener.sessionId === context.sessionId) {
            try {
              listener.handler(errorPayload);
            } catch {
              // error 事件监听器本身出错，忽略以避免无限递归
            }
          }
        }
      }
    } catch {
      // 发送 error 事件本身出错，忽略以避免无限递归
    }
  }

  /** 取消监听 */
  unsubscribe(type: string, handler: EventHandler): void {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((l) => l.handler !== handler),
    );
  }

  /** 注册 Hook，可拦截/修改/阻止事件传播 */
  hook(type: string, hookFn: HookFn): void {
    if (!this.hooks.has(type)) {
      this.hooks.set(type, []);
    }
    this.hooks.get(type)!.push(hookFn);
  }

  /** 清除所有监听器和 Hook */
  clear(): void {
    this.listeners.clear();
    this.hooks.clear();

    // 清理所有活跃的 TTL timer
    for (const timer of this.ttlTimers) {
      clearTimeout(timer);
    }
    this.ttlTimers = [];
  }

  /**
   * 将 emit 参数序列化为可跨进程传输的 EventBusMessage
   *
   * @param type 事件类型
   * @param payload 事件负载（必须是 JSON 可序列化的）
   * @param sessionId 关联的 Session ID
   * @returns 可 JSON.stringify 的消息对象
   */
  static toMessage(type: string, payload: unknown, sessionId?: string): EventBusMessage {
    return {
      version: SERIALIZATION_PROTOCOL_VERSION,
      type,
      payload,
      sessionId,
      timestamp: Date.now(),
    }
  }
}
