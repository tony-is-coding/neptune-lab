import {useEffect, useRef, useState} from 'react';
import type {
  RunRuntimeEvent,
  RunStreamEnvelope,
  RunStreamEndEnvelope,
  RunStreamErrorEnvelope,
} from '@shared/neptune-ai';
import {API_BASE, getStoredToken} from '../api/client';

/**
 * Run 实时事件流消费者。
 *
 * 使用 fetch + ReadableStream 解析 SSE，因为浏览器 EventSource 不支持自定义
 * Authorization 头。
 *
 * 行为：
 * - 自动用 token 进行鉴权
 * - 维护已收到事件的最大 sequence；断线自动重连并通过 Last-Event-ID 续传
 * - 收到 type=end 后停止重连
 * - 收到 type=error 通过 onError 回传，但不停止重连（可能只是临时故障）
 * - 心跳（type=heartbeat）刷新最后活跃时间戳，前端可据此显示连接状态
 *
 * 不做的事情：
 * - 不持久化事件到 localStorage：刷新后从 server 拉历史更可靠
 * - 不做事件去重：依赖 Last-Event-ID + sequence 单调
 */
export type RunStreamConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closed'
  | 'failed';

export interface UseRunEventStreamOptions {
  /** 是否启用流；false 时不发起任何请求 */
  enabled?: boolean;
  /** 重连最大尝试次数；超过后置为 failed 状态 */
  maxReconnects?: number;
  /** 重连退避基数（毫秒），实际延迟 = base * 2^attempt（封顶 30s） */
  reconnectBaseMs?: number;
}

export interface UseRunEventStreamResult {
  events: RunRuntimeEvent[];
  status: RunStreamConnectionStatus;
  endReason: RunStreamEndEnvelope['reason'] | null;
  lastError: RunStreamErrorEnvelope | null;
  lastHeartbeatAt: string | null;
}

const DEFAULT_MAX_RECONNECTS = 5;
const DEFAULT_RECONNECT_BASE_MS = 1000;

export function useRunEventStream(
  runId: string | null,
  options: UseRunEventStreamOptions = {},
): UseRunEventStreamResult {
  const enabled = options.enabled !== false && Boolean(runId);
  const maxReconnects = options.maxReconnects ?? DEFAULT_MAX_RECONNECTS;
  const baseMs = options.reconnectBaseMs ?? DEFAULT_RECONNECT_BASE_MS;

  const [events, setEvents] = useState<RunRuntimeEvent[]>([]);
  const [status, setStatus] = useState<RunStreamConnectionStatus>('connecting');
  const [endReason, setEndReason] = useState<RunStreamEndEnvelope['reason'] | null>(null);
  const [lastError, setLastError] = useState<RunStreamErrorEnvelope | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);

  const lastSequenceRef = useRef<number>(0);
  const reconnectAttemptRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef<boolean>(false);
  // 跨重连保留事件序列；每次 runId 变更时清空。
  const seenSequencesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled || !runId) {
      setStatus('closed');
      return;
    }

    // 重新订阅时重置状态
    stoppedRef.current = false;
    reconnectAttemptRef.current = 0;
    lastSequenceRef.current = 0;
    seenSequencesRef.current = new Set();
    setEvents([]);
    setEndReason(null);
    setLastError(null);
    setLastHeartbeatAt(null);
    setStatus('connecting');

    const connect = async () => {
      if (stoppedRef.current) return;

      const controller = new AbortController();
      abortRef.current = controller;

      const token = getStoredToken();
      if (!token) {
        setStatus('failed');
        setLastError({
          type: 'error',
          error: 'UNAUTHORIZED',
          message: '登录已过期，请重新登录后再查看运行流。',
          requestId: '',
        });
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/runs/${runId}/events/stream`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
            ...(lastSequenceRef.current > 0
              ? {'Last-Event-ID': String(lastSequenceRef.current)}
              : {}),
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          // 4xx/5xx 走标准错误信封；不重连这些错误
          let parsed: Partial<RunStreamErrorEnvelope> = {};
          try {
            parsed = (await res.json()) as Partial<RunStreamErrorEnvelope>;
          } catch {
            parsed = {};
          }
          setStatus('failed');
          setLastError({
            type: 'error',
            error: (parsed.error as RunStreamErrorEnvelope['error']) ?? 'INTERNAL_ERROR',
            message: parsed.message ?? `运行流连接失败：${res.status}`,
            requestId: parsed.requestId ?? res.headers.get('x-request-id') ?? '',
            details: parsed.details ?? {},
          });
          return;
        }

        if (!res.body) {
          throw new Error('SSE 响应没有可读流');
        }

        setStatus('connected');
        reconnectAttemptRef.current = 0;

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (!stoppedRef.current) {
          const {value, done} = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, {stream: true});

          // 按 \n\n 切分 SSE 帧
          let separatorIndex = buffer.indexOf('\n\n');
          while (separatorIndex !== -1) {
            const frame = buffer.slice(0, separatorIndex);
            buffer = buffer.slice(separatorIndex + 2);
            handleFrame(frame);
            separatorIndex = buffer.indexOf('\n\n');
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        scheduleReconnect();
      }
    };

    const handleFrame = (frame: string) => {
      let id: string | null = null;
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('id: ')) id = line.slice(4);
        else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
      }
      if (dataLines.length === 0) return;

      let envelope: RunStreamEnvelope;
      try {
        envelope = JSON.parse(dataLines.join('\n')) as RunStreamEnvelope;
      } catch {
        return;
      }

      if (envelope.type === 'event') {
        const seq = envelope.event.sequence;
        if (seenSequencesRef.current.has(seq)) return;
        seenSequencesRef.current.add(seq);
        if (seq > lastSequenceRef.current) lastSequenceRef.current = seq;
        setEvents(prev => [...prev, envelope.event]);
      } else if (envelope.type === 'end') {
        stoppedRef.current = true;
        setEndReason(envelope.reason);
        setStatus('closed');
      } else if (envelope.type === 'error') {
        setLastError(envelope);
      } else if (envelope.type === 'heartbeat') {
        setLastHeartbeatAt(envelope.occurredAt);
      }

      if (id) {
        const parsed = Number.parseInt(id, 10);
        if (Number.isFinite(parsed) && parsed > lastSequenceRef.current) {
          lastSequenceRef.current = parsed;
        }
      }
    };

    const scheduleReconnect = () => {
      if (stoppedRef.current) return;
      reconnectAttemptRef.current += 1;
      if (reconnectAttemptRef.current > maxReconnects) {
        setStatus('failed');
        return;
      }
      setStatus('reconnecting');
      const delay = Math.min(baseMs * 2 ** (reconnectAttemptRef.current - 1), 30_000);
      reconnectTimerRef.current = setTimeout(() => {
        if (!stoppedRef.current) connect();
      }, delay);
    };

    connect();

    return () => {
      stoppedRef.current = true;
      abortRef.current?.abort();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [runId, enabled, maxReconnects, baseMs]);

  return {events, status, endReason, lastError, lastHeartbeatAt};
}
