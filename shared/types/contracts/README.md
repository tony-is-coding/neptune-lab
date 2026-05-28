# shared/types/contracts — 跨层稳定协议

> Stage 2.1（Harness Completion）落地的 7 个跨层稳定契约。

## 是什么

跨 `neptune-engine` / `neptune-ai/server` / `neptune-ai/web` 三层共享的稳定数据契约。
一次定义、三处共享，避免类型在三层之间漂移。

## 7 个契约

| 契约 | 用途 |
|---|---|
| `Run` | Agent 执行的核心事实对象（id / projectId / agentTemplateVersion / status / startedAt / endedAt） |
| `ToolInvocation` | 单次工具调用记录（runId / toolName / inputSnapshot / outputSnapshot / status / artifactIds） |
| `Artifact` | 通用产物（id / kind / mime / createdAt） |
| `EvidenceArtifact` | Artifact 的受审计子类型（额外含 hash + source { toolName, agentTemplateVersion } + signedAt? + signedBy?） |
| `AuditEvent` | Append-only 审计事件（id / timestamp / actor / action / target — 无 update 字段） |
| `HumanReview` | 人工复核记录（runId / findingId / severity / decision: pending\|approved\|rejected） |
| `PolicyDecision` | 策略引擎决策记录（behavior: allow\|deny\|require_review / rule / reason） |

## 设计原则

1. **稳定协议层，不承载业务行为**：finance / 财务关账 / 凭证 / 科目余额表等业务语义不在此层。
2. **zod schema + z.infer 类型**：每个文件 export `XxxSchema` 和 `Xxx` 两个符号。
3. **`.passthrough()` 向前兼容**：所有 schema 接受未知字段（不剥离），便于 schema 演进时不立即 break 老调用方。
4. **append-only 设计**：AuditEvent 没有 update 字段，事件不可篡改。

## 破坏性变更策略

契约一旦发布到 server / engine / web 三方，**breaking change 成本高**。设计原则：

- **新增字段**：永远 `.optional()`（不破坏老调用方）
- **删除字段**：必须经过 deprecated 周期（先 mark optional + 文档警告，N 个版本后再删）
- **改字段类型**：禁止；如果必须改，新增字段而非替换
- **改 enum 值**：扩展枚举（加新值）OK；删除/重命名禁止
- **重命名字段**：用 alias schema 桥接 N 个版本

## 使用方式

```ts
import {RunSchema, type Run} from '@neptune-lab/shared/types/contracts'

// 验证
const run = RunSchema.parse(payload)

// 仅类型
const myRun: Run = {...}
```

## 参考

- Stage 2.1 spec: `.kiro/specs/harness-completion-stage-1-2/`
- 战略文档: `docs/strategy/neptune-engine-decoupling-handover.md` Task #29
