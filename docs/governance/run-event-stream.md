# Run 实时事件流（SSE）规范

**版本**：v1.0
**最后更新**：2026-05-23
**适用范围**：`neptune-ai/server` `GET /api/v1/runs/:runId/events/stream` 端点；`neptune-ai/web` 治理台运行详情；任何消费 Neptune 实时运行事件的客户端。

## 1. 结论

Run 是 Neptune 平台的事实中心。本端点把"运行进度"暴露为独立的实时一等通道，与 Thread / 聊天通道解耦：

- 治理台运行详情消费这个流，而不是消费 chat SSE
- Solution Pack 业务页面需要看实时进度时，直接订阅 Run 的事件流
- 第三方观察方（CI、外部审计）通过本端点订阅事实，不需要触达聊天通道

## 2. 端点

```
GET /api/v1/runs/:runId/events/stream
Accept: text/event-stream
Authorization: Bearer <token>
Last-Event-ID: <sequence>     可选，用于断线续传
```

**响应**：

```
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
X-Request-Id: <uuid>
```

**preflight 错误**（鉴权失败、租户隔离、Run 不存在）走标准 HTTP 4xx + `ApiErrorEnvelope`，参见 [api-error-envelope.md](api-error-envelope.md)。

## 3. 协议帧

每条 SSE 帧形如：

```
id: <sequence>
data: <RunStreamEnvelope JSON>

```

`RunStreamEnvelope` 是 4 种 discriminated union，定义在 [`shared/types/neptune-ai/api/run-events.ts`](../../shared/types/neptune-ai/api/run-events.ts)：

| type | 说明 |
| --- | --- |
| `event` | 一条 `RunRuntimeEvent`，与 `run_events` 表 1:1 对应，sequence 严格单调 |
| `heartbeat` | 心跳，每 15s 一帧；客户端可据此判断连接活性 |
| `end` | 终态信号；reason ∈ `completed` / `failed` / `cancelled`；服务器随后关闭流 |
| `error` | 流内错误，使用 `ApiErrorEnvelope` 形状；不必然终止流 |

只有 `type=event` 帧带 `id:` SSE 字段。客户端必须保留这个 sequence 作为续传游标。

## 4. 已知事件类型

权威定义在 `RUN_RUNTIME_EVENT_TYPES`：

| eventType | 含义 |
| --- | --- |
| `run.started` | Run 进入 running 状态 |
| `run.completed` | Run 成功结束（终态信号）|
| `run.failed` | Run 失败结束（终态信号）|
| `run.cancelled` | Run 被取消（终态信号）|
| `run.output.delta` | 模型输出增量，payload 含 text 片段 |
| `run.output.completed` | 模型输出结束 |
| `tool.invocation.started` | 工具调用启动 |
| `tool.invocation.completed` | 工具调用成功 |
| `tool.invocation.failed` | 工具调用失败 |
| `policy.decision.recorded` | 策略决策事实写入 |
| `human_review.requested` | 复核请求创建 |
| `human_review.decided` | 复核结论写入 |
| `artifact.created` | 成果文件元数据写入 |
| `cost.recorded` | 用量/成本事实写入 |

**新增事件类型必须先扩展 `RUN_RUNTIME_EVENT_TYPES`，再在 server 写入。**

客户端解析 `eventType` 时应允许未识别值，使用 default 分支兜底，保持向前兼容。

## 5. 续传协议

### 5.1 客户端续传规则

- 客户端记录最大 `sequence` 作为 `lastEventId`
- 重连时通过 `Last-Event-ID: <lastEventId>` 头携带
- 服务器返回 `sequence > lastEventId` 的全部历史事件，再续接 live tail
- `Last-Event-ID` 缺失或非数字时视为 0，从头回放

### 5.2 服务器实现要求

- 历史回放与 live tail 之间的 sequence 必须连续
- 同一 sequence 不允许重复发送（去重靠服务器)
- 重连不重写 `requestId`：每次连接产生新 requestId，但事件本体的 requestId 保留首次创建时的值

## 6. 终态行为

服务器接收到任意 `run.completed` / `run.failed` / `run.cancelled` 事件后必须：

1. 推送该事件本体（`type=event`）
2. 推送 `type=end` 帧，携带对应 `reason`
3. 关闭 raw socket（`reply.raw.end()`）

客户端收到 `type=end` 后必须停止重连，避免对终态运行无意义地维持连接。

## 7. 心跳与超时

- 服务器每 15 秒推送一次 `type=heartbeat`，避免反向代理（nginx）/ 负载均衡器空闲超时切断连接
- 客户端可使用 `lastHeartbeatAt` + 当前时间 > 30s 来判断连接是否真的失活

## 8. 实现约束（server）

`runEventBus`（[`neptune-ai/server/src/services/run-event-bus.ts`](../../neptune-ai/server/src/services/run-event-bus.ts)）是单进程内存广播总线。

- 持久化与广播分离：`RunFactService.recordEvent` 在 `INSERT INTO run_events` 后调用 `runEventBus.publish`
- 多订阅者并发：同一 runId 可被多个 SSE 客户端订阅
- 多实例环境替换：MVP 是单进程实现；上集群后应替换为 Postgres LISTEN/NOTIFY 或 Redis pub/sub。`RunEventBus` 接口形状不依赖实现细节
- 关闭/超时清理：客户端 `request.raw.on('close')` 事件触发 `unsubscribe()` 与 `clearInterval(heartbeat)`，避免内存泄漏

## 9. 实现约束（web）

`useRunEventStream`（[`neptune-ai/web/src/hooks/useRunEventStream.ts`](../../neptune-ai/web/src/hooks/useRunEventStream.ts)）是浏览器侧消费者。

设计要点：

- **不使用 EventSource**：浏览器原生 EventSource 不支持 `Authorization` 头。改用 `fetch + ReadableStream` 手动解析 SSE
- **自动重连退避**：base × 2^attempt（封顶 30s），max 5 次后置为 `failed`
- **去重**：基于 `sequence`，跨重连保留 `seenSequencesRef`
- **运行状态门控**：调用方应仅在 `selectedRun.status === 'running'` 时启用，避免对终态运行维持空闲连接

## 10. 与 `/runs/:runId/events`（JSON 分页）的关系

| 维度 | `/events` (JSON) | `/events/stream` (SSE) |
| --- | --- | --- |
| 用途 | 历史回放、审计离线分析 | 实时运行进度、断线续传 |
| 协议 | REST + JSON | SSE |
| 分页 | limit/offset | 不适用（流式） |
| 返回形态 | `RunEventListResponse` | `RunStreamEnvelope` 序列 |
| 是否长连接 | 否 | 是 |

两者数据源同一张 `run_events` 表，事实一致。

## 11. 变更流程

修改本协议是跨层 API 变更，必须：

1. 同步更新 `shared/types/neptune-ai/api/run-events.ts`
2. 同步更新 `neptune-ai/server/src/services/run-event-bus.ts` 与 `routes/runs.ts`
3. 同步更新 `neptune-ai/web/src/hooks/useRunEventStream.ts`
4. 更新 `test/run-events-stream.test.ts` 合同测试
5. 更新本文档版本号与变更点

## 12. 反模式

- **不要**用 chat SSE 通道传递运行事实事件：聊天与运行是独立的关注点
- **不要**在事件 payload 中放 prompt / credential / MCP auth：用 `payloadSummary` 元数据代替
- **不要**对终态 Run 维持空闲长连接：服务器和客户端都应主动断开
- **不要**忽略 `Last-Event-ID`：丢事件会导致前端事实链不完整
