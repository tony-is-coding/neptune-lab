/**
 * EnginePool — Engine 实例池管理
 *
 * 管理内存中的 AgentEngine 实例，每个 Thread 对应一个 Engine。
 * 核心职责：
 * - 注册和检索 engine（按 threadId）
 * - LRU 策略的容量管理（超出并发限制时淘汰最久未使用的 engine）
 * - Engine 的安全释放和销毁
 */

export interface EnginePoolConfig {
  maxConcurrent: number;
}

/**
 * Engine 最小接口约束
 *
 * EnginePool 只需要调用 engine.destroy()，
 * 不依赖完整的 AgentEngine 类型以避免耦合。
 */
export interface DestroyableEngine {
  destroy(): Promise<void>;
}

export class EnginePool {
  private engines: Map<string, DestroyableEngine> = new Map();
  private lastActivity: Map<string, number> = new Map();
  private config: EnginePoolConfig;

  constructor(config: EnginePoolConfig) {
    this.config = config;
  }

  /**
   * 注册 engine 到池中
   */
  register(threadId: string, engine: DestroyableEngine): void {
    this.engines.set(threadId, engine);
    this.touch(threadId);
  }

  /**
   * 获取 engine，同时更新活动时间（LRU touch）
   */
  get(threadId: string): DestroyableEngine | undefined {
    const engine = this.engines.get(threadId);
    if (engine) this.touch(threadId);
    return engine;
  }

  /**
   * 检查 thread 是否有活跃的 engine
   */
  has(threadId: string): boolean {
    return this.engines.has(threadId);
  }

  /**
   * 释放 engine — 调用 destroy() 并从池中移除
   *
   * 即使 destroy 失败也会清理池状态，避免泄漏。
   */
  async release(threadId: string): Promise<void> {
    const engine = this.engines.get(threadId);
    if (engine) {
      try {
        await engine.destroy();
      } catch (error) {
        console.warn(`Engine 销毁失败 (thread=${threadId}):`, error);
      }
      this.engines.delete(threadId);
      this.lastActivity.delete(threadId);
    }
  }

  /**
   * 获取当前活跃 engine 数量
   */
  getActiveCount(): number {
    return this.engines.size;
  }

  /**
   * 判断池是否已满
   */
  isAtCapacity(): boolean {
    return this.engines.size >= this.config.maxConcurrent;
  }

  /**
   * 获取最久未使用的 threadId（LRU 淘汰候选）
   *
   * 返回 lastActivity 最早（最久没被 touch）的 threadId。
   * 如果池为空返回 null。
   */
  getEvictable(): string | null {
    if (this.engines.size === 0) return null;
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [threadId, time] of this.lastActivity) {
      if (time < oldestTime) {
        oldestTime = time;
        oldest = threadId;
      }
    }
    return oldest;
  }

  /**
   * 获取所有活跃的 threadId 列表
   */
  getActiveThreadIds(): string[] {
    return Array.from(this.engines.keys());
  }

  private touch(threadId: string): void {
    this.lastActivity.set(threadId, Date.now());
  }
}
