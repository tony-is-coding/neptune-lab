# Agent 工作流浏览器验收设计

日期：2026-05-20

## 目标

把 Collaborate 的高级 Agent 工作流提升到浏览器级验收：用户必须能看见并操作 `ask_user`，能在右侧面板检查 artifact，能理解 plan 执行进度，并且在 SSE 失败、刷新、切换 Thread 后不丢失关键会话数据。

## 第一性原则

Agent 产品的原子动作不是一段文本回复，而是一个可恢复的工作流：

```text
用户输入 -> Thread 状态 -> Engine 事件 -> UI 状态 -> 用户决策/产物/计划 -> 持久化历史 -> 刷新恢复
```

因此测试不应只断言事件曾经到达。浏览器验收必须断言用户可见事实：

- 系统在问什么，用户如何回答。
- 系统产出了什么，用户如何检查。
- 系统计划做什么，当前进度在哪里。
- 失败后用户能否恢复，不会误以为消息已经成功。
- 刷新和切换 Thread 后，用户消息、助手消息、产物和计划不会丢失。

## 设计

### Controlled Engine 场景

扩展 `ControlledEngineFactory`，根据输入内容输出确定性事件流：

- `advanced workflow`：输出 thinking、`ask_user`、Write artifact、TaskCreate/TaskUpdate plan、最终文本。
- `slow stream`：输出较慢文本流，用于 abort 测试。
- 默认输入继续保持当前 controlled-chat 行为，避免破坏既有门禁。

controlled engine 只负责可重复事件，不模拟真实 LLM 智能。真实 provider 仍由后续集成门禁覆盖。

### UI 行为

- `QuestionBlock` 保持内联决策控件，回答成功后显示已回答状态。
- artifact 不在消息流里占空间，统一进入右侧面板；面板可从列表进入详情。
- plan 使用右侧任务面板表达 pending/running/completed/failed。
- SSE 错误在当前 assistant 消息中显示可理解的错误文案，同时释放输入框。
- abort 后停止 streaming，不残留不可恢复的禁用状态。

### E2E 覆盖

新增三个浏览器验收文件：

- `advanced-chat.spec.ts`：覆盖 `ask_user`、artifact、plan。
- `sse-recovery.spec.ts`：覆盖 abort、401、409 running、404 thread。
- `thread-stability.spec.ts`：覆盖刷新、切换 Thread、历史恢复、不丢消息。

## 非目标

- 不重做真实 provider。
- 不引入新的 UI 框架或大型状态管理。
- 不把 controlled engine 伪装成生产模型质量验收。

## 验收标准

- 新增浏览器测试全部通过。
- 既有 `controlled-chat` 继续通过。
- `web` typecheck 通过。
- `server` 全量测试继续通过。
- 报告更新说明新增覆盖和仍缺真实 provider/Langfuse 后端查询验收。
