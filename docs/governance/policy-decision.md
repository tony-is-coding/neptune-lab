  # PolicyDecision 治理决策事实

**版本**：v1.0
**最后更新**：2026-05-26
**适用范围**：`neptune-ai/server` 所有"治理性决策"写入；`neptune-ai/web` 治理台展示。

## 1. 结论

PolicyDecision 是 AgentOps 平台的**治理事实表**，记录"为什么某个 Agent 行为被拒绝或被升级到人工复核"。它必须满足：

1. **只记录治理决策**：只写 `deny` 与 `review_required`，**不写 `allow`**。
2. **封闭枚举**：`policyType` / `subjectType` / `decision` 三个字段都是封闭枚举，定义在 `shared/types/neptune-ai/api/policy.ts`。
3. **关联实体可解释**：每条记录必须能被治理团队按 `runId` / `requestId` / `subjectId` 检索。
4. **SSE 桥**：当决策关联到具体 `runId` 时，必须同步写一条 `run_events`（`eventType='policy.decision.recorded'`），让治理台前端 SSE 流实时看到。

## 2. 为什么不记录 `allow`

第一性原理：如果"允许"被记录，**事实表会被噪声爆炸**——每次工具调用、每次模型调用都会写一条 allow 占位，几百条/分钟级别的写入。这样的表不再是"治理事实"，而是"调用日志"，应该走 observability 通道而不是 governance 通道。

PolicyDecision 表的 SQL 查询语义是：**"过去一段时间，平台拦截了哪些 Agent 行为？"**。如果未来需要"豁免"语义（例如 customer 主动要求开放某个工具），用 `decision='review_required'` 表达，不要新增 `allow` 类型。

## 3. 封闭枚举

权威定义：`shared/types/neptune-ai/api/policy.ts`。

### 3.1 `PolicyType`（决策类别）

| 类型 | 含义 | 当前写入方 |
| --- | --- | --- |
| `tool` | 工具调用是否允许 | `permission-delegate.ts` deny 分支 |
| `mcp_server` | MCP server 注册校验 | `permission-delegate.ts` MCP allowlist 分支 |
| `file_path` | 工作区路径越界拦截 | `permission-delegate.ts` workspace boundary 分支 |
| `quota` | 租户/项目配额拦截 | `run-admission.ts` |
| `model` | 模型 allowlist | （保留，暂未启用）|
| `role` | 角色 RBAC | （保留，暂未启用） |
| `rate_limit` | 速率限制 | （保留，暂未启用） |

### 3.2 `PolicySubjectType`（决策对象）

`tool` / `mcp_server` / `file_path` / `model` / `role` / `tenant` / `thread` / `run`。

### 3.3 `decision`（结果）

`deny` / `review_required`。**不允许 `allow`**。

## 4. 写入路径

唯一入口：`policyDecisionService` 提供两个方法。

```ts
policyDecisionService.recordDeny({
  tenantId, runId?, requestId,
  policyType, subjectType, subjectId,
  reason, details,
})
policyDecisionService.recordReviewRequired({...})
```

副作用：当 `runId` 不为 null 时，同步写一条 `run_events` 让 SSE 流可见。失败只 warn，不阻塞决策返回。

## 5. PermissionDelegate 的 fire-and-forget 约定

`permission-delegate.ts` 的 4 个 deny 分支调用 `recorder.recordDeny(...).catch(warn)`：

- **不阻塞决策返回**：决策结果由 in-memory 计算得出，PolicyDecision 写入只是事实记录。
- **失败只 warn**：写库失败不能让 deny 变 allow，反之亦然。
- **无 recorder 时静默 noop**：让单元测试可以不带 recorder 注入。

## 6. 治理台展示

治理台只读 API：`GET /api/v1/platform-facts/policy-decisions`。

支持过滤：`runId` / `decision` / `policyType` / `subjectType` / `limit` / `offset`。

DTO 通过 `redactSummary` 自动脱敏 `token` / `secret` / `credential` / `password` / `api_key` / `auth` 这类字段名。

## 7. 与 AuditEvent 的关系

PolicyDecision 与 AuditEvent **不是同一张表的两面**。两者并存：

- **PolicyDecision**：回答"为什么这个调用被拦截？"，关注**规则执行**。
- **AuditEvent**：回答"谁在什么时候做了什么操作？"，关注**actor 行为追溯**。

quota 类拦截会同时写两张表（PolicyDecision 记规则结果，AuditEvent 记 quota.blocked 行为），但例如 `tool` deny 只写 PolicyDecision——因为它是模型代理在 dispatch 前的内部决策，不是用户操作。

## 8. 测试约定

- 单元层：`test/permission-delegate.test.ts` 覆盖 4 个 deny 分支 + recorder 错误兜底
- 端到端：`test/platform-facts.test.ts` 覆盖 `recordDeny → run_events 桥 → 治理台 API` 完整链路
- 反向：`test/run-control.test.ts` 与 `test/controlled-engine-chat.test.ts` 断言成功的 controlled run **不写任何 allow 占位**

## 9. 演进规则

- **新增 PolicyType** 必须先更新 `shared/types/neptune-ai/api/policy.ts` 封闭枚举，再加写入方
- **删除已使用的 PolicyType** 视作 contract 破坏，需要走治理评审
- **`allow` 决策永远不进入这张表**——如果未来确实需要"显式允许"语义（豁免、白名单审批），用 `review_required` 表达 Approval 流程，或者新建独立的 `Waiver` 表
