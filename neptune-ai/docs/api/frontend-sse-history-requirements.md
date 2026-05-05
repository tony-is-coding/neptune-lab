# 前端对后端 SSE 事件及 History API 的诉求

> 日期: 2026-05-05
> 来源: neptune-ai/web 前端对接分析

---

## 1. SSE 事件类型诉求

前端 `useChatMessages` 通过 SSE 接收 Agent 回复，需要以下事件类型来驱动 UI 渲染：

### 必需事件（核心聊天流程）

| 事件类型 | data 结构 | 说明 |
|----------|----------|------|
| `thinking` | `{ content: string, duration?: number }` | Agent 思考过程，显示可折叠的思考块 |
| `text` | `{ content: string }` | 流式文字输出，支持多次追加（前端会合并连续 text 事件） |
| `done` | `{ usage?: { inputTokens: number, outputTokens: number } }` | 对话完成 |
| `error` | `{ message: string }` | 执行出错 |

### 重要事件（工具调用展示）

| 事件类型 | data 结构 | 说明 |
|----------|----------|------|
| `tool_use` | `{ id: string, name: string, input?: object, _summary?: string }` | 工具调用开始，显示可展开的工具卡片 |
| `tool_status` | `{ id: string, status: 'completed' \| 'error' }` | 工具调用状态更新 |
| `tool_result` | `{ toolUseId: string, output?: object, _summary?: string }` | 工具调用结果 |

### 增强事件（高级 UI 功能）

| 事件类型 | data 结构 | 说明 |
|----------|----------|------|
| `artifact` | `{ id: string, title: string, fileType: string, content: string }` | Agent 生成的文档/文件产出 |
| `plan_task` | `{ id: string, subject: string, description: string, status: string, blocks: string[], blockedBy: string[] }` | 执行计划任务创建 |
| `plan_task_update` | `{ id: string, status: string, activeForm?: string }` | 任务状态更新 |
| `bg_task` | `{ id: string, type: string, description: string, status: string }` | 后台任务启动 |
| `bg_task_update` | `{ id: string, status: string, summary?: string }` | 后台任务状态更新 |

### SSE 事件传输格式

当前后端文档描述的格式：

```
event: message
data: {"type":"assistant","content":"..."}
```

**前端需要的格式**（二选一）：

**方案 A（推荐）：用 `data.type` 区分**
```
event: message
data: {"type":"thinking","content":"分析中...","duration":3}

event: message
data: {"type":"text","content":"我找到了..."}

event: message
data: {"type":"tool_use","id":"tool-1","name":"search","input":{...}}

event: done
data: {"usage":{"inputTokens":150,"outputTokens":500}}
```
前端 SSE 解析器已支持此格式（`event: message` 时读取 `data.type`）。

**方案 B：用 `event` 字段直接区分**
```
event: thinking
data: {"content":"分析中...","duration":3}

event: text
data: {"content":"我找到了..."}

event: tool_use
data: {"id":"tool-1","name":"search","input":{...}}

event: done
data: {"usage":{"inputTokens":150,"outputTokens":500}}
```
前端 SSE 解析器也支持此格式（fallback 分支）。

---

## 2. History API 数据结构诉求

当前 `GET /agents/:agentId/threads/:threadId/history` 返回：

```json
{
  "data": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ]
}
```

**问题**：只有纯文本 `content`，无法还原富消息（thinking blocks、tool calls、artifacts）。

### 前端需要的格式

```json
{
  "data": [
    {
      "id": "msg-uuid-1",
      "role": "user",
      "blocks": [
        { "type": "text", "content": "帮我分析销售数据" }
      ],
      "status": "complete",
      "timestamp": "2026-05-05T10:30:00.000Z"
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "blocks": [
        { "type": "thinking", "content": "需要先加载数据...", "duration": 3 },
        { "type": "text", "content": "我正在分析..." },
        { "type": "tool_use", "id": "tool-1", "name": "read_file", "input": {"path": "sales.csv"}, "status": "completed" },
        { "type": "tool_result", "toolUseId": "tool-1", "output": {"rows": 1000} },
        { "type": "text", "content": "分析完成，发现以下趋势..." }
      ],
      "status": "complete",
      "timestamp": "2026-05-05T10:30:05.000Z"
    }
  ],
  "meta": {
    "threadId": "...",
    "agentId": "...",
    "count": 2
  }
}
```

**关键变化**：
- `content` → `blocks: MessageBlock[]`（与 SSE 事件结构一致）
- 新增 `id`（消息唯一标识）
- 新增 `status`（消息状态）

### 过渡方案

如果后端短期内无法返回 `blocks` 结构，前端可兼容处理：
- 有 `blocks` 字段 → 使用 blocks 渲染
- 只有 `content` 字段 → 包装为 `[{ type: 'text', content }]`

前端 `loadHistory` 已实现此兼容逻辑。

---

## 3. Agent 模板字段诉求

### 当前缺失

| 字段 | 类型 | 说明 |
|------|------|------|
| `icon` | string (nullable) | Material Symbols 图标名，如 `receipt_long`、`monitoring`、`smart_toy` |

**前端过渡方案**：如果后端未返回 `icon` 字段，前端默认使用 `smart_toy`。

### 建议新增

在 `agent_templates` 表新增 `icon text DEFAULT 'smart_toy'`，`GET /agents` 和 `GET /agents/:id` 响应中包含此字段。

---

## 4. 总结

| 诉求 | 优先级 | 前端过渡方案 |
|------|--------|-------------|
| SSE 事件类型对齐 | P0 | 已支持两种格式（data.type / event name） |
| History 返回 blocks 结构 | P1 | 兼容纯 content 格式 |
| Agent icon 字段 | P2 | 默认 `smart_toy` |
