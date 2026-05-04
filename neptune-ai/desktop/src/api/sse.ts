import type { ChatMessage } from '../types';

/**
 * SSE 事件回调
 */
export interface SSECallbacks {
  onMessage?: (message: ChatMessage) => void;
  onDone?: (usage: Record<string, unknown>) => void;
  onError?: (error: string) => void;
  onConnected?: () => void;
}

/**
 * SSE 连接配置
 */
export interface SSEConnectionOptions {
  url: string;
  token: string;
  content: string;
  callbacks: SSECallbacks;
  maxRetries?: number;     // 最大重试次数，默认 5
  retryDelay?: number;     // 初始重试延迟（毫秒），默认 1000ms
  maxRetryDelay?: number;  // 最大重试延迟（毫秒），默认 30000ms
}

/**
 * SSE 连接管理
 */
export class SSEClient {
  private controller: AbortController | null = null;
  private connected = false;
  private manuallyDisconnected = false;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 连接 SSE（带指数退避重连）
   */
  async connect(options: SSEConnectionOptions): Promise<void> {
    const {
      url,
      token,
      content,
      callbacks,
      maxRetries = 5,
      retryDelay = 1000,
      maxRetryDelay = 30000,
    } = options;

    // 取消之前的连接和重试
    this.disconnect();

    // 重置状态
    this.manuallyDisconnected = false;
    this.retryCount = 0;

    await this.attemptConnection({
      url,
      token,
      content,
      callbacks,
      maxRetries,
      retryDelay,
      maxRetryDelay,
    });
  }

  /**
   * 尝试建立连接（内部方法，支持重试）
   */
  private async attemptConnection(options: SSEConnectionOptions & {
    maxRetries: number;
    retryDelay: number;
    maxRetryDelay: number;
  }): Promise<void> {
    const {
      url,
      token,
      content,
      callbacks,
      maxRetries,
      retryDelay,
      maxRetryDelay,
    } = options;

    // 如果已手动断开，不重连
    if (this.manuallyDisconnected) {
      return;
    }

    // 取消之前的连接
    if (this.controller) {
      this.controller.abort();
    }

    this.controller = new AbortController();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
        signal: this.controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 连接成功，重置重试计数
      this.retryCount = 0;
      this.connected = true;
      callbacks.onConnected?.();

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let buffer = '';

      // 读取流，同时检查 manuallyDisconnected 标志
      while (this.connected && !this.manuallyDisconnected) {
        const { done, value } = await reader.read();

        if (done) {
          // 正常结束
          this.connected = false;
          break;
        }

        // 解码并追加到缓冲区
        buffer += decoder.decode(value, { stream: true });

        // 处理完整的 SSE 消息
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6).trim();

            // 当我们有一个完整的事件时
            if (eventType && eventData) {
              try {
                const data = JSON.parse(eventData);

                if (eventType === 'connected') {
                  // 连接确认事件
                  callbacks.onConnected?.();
                } else if (eventType === 'message') {
                  callbacks.onMessage?.(data as ChatMessage);
                } else if (eventType === 'done') {
                  callbacks.onDone?.(data.usage as Record<string, unknown>);
                  this.connected = false;
                } else if (eventType === 'error') {
                  callbacks.onError?.((data as { error: string }).error);
                  this.connected = false;
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }

              // 重置
              eventType = '';
              eventData = '';
            }
          }
        }
      }

      // 如果不是手动断开且未超过最大重试次数，则重连
      if (!this.manuallyDisconnected && this.retryCount < maxRetries) {
        this.scheduleRetry({ url, token, content, callbacks, maxRetries, retryDelay, maxRetryDelay });
      } else if (this.retryCount >= maxRetries) {
        callbacks.onError?.('连接失败，已达到最大重试次数');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // 手动中止，不重连
          return;
        }

        // 其他错误，尝试重连
        if (!this.manuallyDisconnected && this.retryCount < maxRetries) {
          callbacks.onError?.(error.message);
          this.scheduleRetry({ url, token, content, callbacks, maxRetries, retryDelay, maxRetryDelay });
        } else if (this.retryCount >= maxRetries) {
          callbacks.onError?.(`连接失败: ${error.message}，已达到最大重试次数`);
        }
      }
    }
  }

  /**
   * 安排重连（指数退避）
   */
  private scheduleRetry(options: SSEConnectionOptions & {
    maxRetries: number;
    retryDelay: number;
    maxRetryDelay: number;
  }): void {
    this.retryCount++;

    // 计算延迟时间：retryDelay * 2^attempt，但不超过 maxRetryDelay
    const delay = Math.min(
      options.retryDelay * Math.pow(2, this.retryCount - 1),
      options.maxRetryDelay
    );

    console.log(`SSE 连接断开，${delay}ms 后进行第 ${this.retryCount} 次重试...`);

    this.retryTimer = setTimeout(() => {
      this.attemptConnection(options);
    }, delay);
  }

  /**
   * 断开连接（手动断开，不触发重连）
   */
  disconnect(): void {
    this.manuallyDisconnected = true;
    this.connected = false;

    // 清除重试定时器
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // 中止当前请求
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  /**
   * 是否已连接
   */
  isActive(): boolean {
    return this.connected;
  }
}
