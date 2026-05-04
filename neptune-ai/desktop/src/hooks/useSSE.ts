import { useState, useCallback, useRef } from 'react';
import { SSEClient, type SSECallbacks } from '../api/sse';
import type { ChatMessage } from '../types';

/**
 * SSE 连接状态
 */
export type SSEStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * SSE 连接选项
 */
interface SSEOptions {
  maxRetries?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
}

/**
 * SSE Hook
 */
export function useSSE() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<SSEStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const sseClientRef = useRef<SSEClient>(new SSEClient());

  /**
   * 发送消息并连接 SSE
   */
  const send = useCallback(async (
    url: string,
    token: string,
    content: string,
    options?: SSEOptions
  ) => {
    setStatus('connecting');
    setError(null);
    setUsage(null);
    setMessages([]);

    const callbacks: SSECallbacks = {
      onConnected: () => {
        setStatus('connected');
      },
      onMessage: (message: ChatMessage) => {
        setMessages((prev) => [...prev, message]);
      },
      onDone: (usageData: Record<string, unknown>) => {
        setUsage(usageData);
        setStatus('idle');
      },
      onError: (errorMessage: string) => {
        setError(errorMessage);
        setStatus('error');
      },
    };

    await sseClientRef.current.connect({
      url,
      token,
      content,
      callbacks,
      ...options,
    });
  }, []);

  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    sseClientRef.current.disconnect();
    setStatus('idle');
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setUsage(null);
    setStatus('idle');
  }, []);

  return {
    messages,
    status,
    error,
    usage,
    send,
    disconnect,
    reset,
    isConnected: status === 'connected',
  };
}
