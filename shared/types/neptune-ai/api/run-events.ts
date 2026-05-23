/**
 * Run 实时运行事件流契约
 *
 * 用于 GET /api/v1/runs/:runId/events (SSE)
 *
 * 设计原则：
 * - 事件以 sequence 严格单调递增（来自 run_events 表）
 * - 客户端通过 Last-Event-ID 头携带上次接收的 sequence 实现断线续传
 * - 客户端只接收已经持久化的事实，不接收 in-flight 临时状态
 * - prompt / credential / 凭证 / MCP auth 等敏感字段不进入 payload
 *
 * 事件类型集合是开放的：客户端必须容忍未识别 eventType，使用 'unknown' 分支兜底。
 */
import type {IsoDateString} from './common';
import type {ApiErrorEnvelope} from './common';

/**
 * 已知的 Run 运行事件类型。
 *
 * 任何新增事件类型在这里登记后再在 server 写入。
 * 客户端 switch 时建议留 default 兜底，保持向前兼容。
 */
export const RUN_RUNTIME_EVENT_TYPES = [
  'run.started',
  'run.completed',
  'run.failed',
  'run.cancelled',
  'run.output.delta',
  'run.output.completed',
  'tool.invocation.started',
  'tool.invocation.completed',
  'tool.invocation.failed',
  'policy.decision.recorded',
  'human_review.requested',
  'human_review.decided',
  'artifact.created',
  'cost.recorded',
] as const;

export type RunRuntimeEventType = typeof RUN_RUNTIME_EVENT_TYPES[number];

/**
 * 单条 Run 运行事件（与 run_events 表 1:1 对应）。
 */
export interface RunRuntimeEvent {
  /** 事件主键，来自 run_events.id */
  id: number;
  /** 序号，按 (tenantId, runId) 单调递增，用于断线续传 */
  sequence: number;
  /** Run id */
  runId: string;
  /** 事件类型；客户端应允许未识别值 */
  eventType: RunRuntimeEventType | string;
  /** 触发该事件的请求 id（cancel/retry/dispatch 等） */
  requestId: string | null;
  /** 已脱敏的事件摘要，结构因 eventType 而异 */
  payloadSummary: Record<string, unknown>;
  /** 事件发生时间 */
  occurredAt: IsoDateString;
}

/**
 * Run 流式事件信封（发送到 SSE event 数据的 JSON 形式）。
 * 与 ChatErrorEvent 风格保持一致，使用 type 作为 discriminator。
 */
export type RunStreamEnvelope =
  | RunStreamEventEnvelope
  | RunStreamHeartbeatEnvelope
  | RunStreamEndEnvelope
  | RunStreamErrorEnvelope;

export interface RunStreamEventEnvelope {
  type: 'event';
  event: RunRuntimeEvent;
}

/** 心跳事件，避免代理层因长时间无数据切断连接 */
export interface RunStreamHeartbeatEnvelope {
  type: 'heartbeat';
  occurredAt: IsoDateString;
}

/** Run 进入终态后服务器主动关闭流的标记 */
export interface RunStreamEndEnvelope {
  type: 'end';
  reason: 'completed' | 'failed' | 'cancelled';
}

/** 流内错误，使用统一错误信封形状 */
export interface RunStreamErrorEnvelope extends ApiErrorEnvelope {
  type: 'error';
}

/**
 * 客户端续传参数（HTTP 头 Last-Event-ID 的程序化表达）。
 * 这是 SSE 协议字段，类型仅作文档用。
 */
export interface RunStreamResumeRequest {
  /** 上次接收到的事件 sequence，server 将从下一条开始回放 */
  lastEventId: number;
}
