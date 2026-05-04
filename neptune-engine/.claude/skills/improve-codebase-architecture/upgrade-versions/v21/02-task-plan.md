# V21 任务计划

> 版本：V21
> 目标：V7 技术债收尾 + V7.5 全局状态解耦
> 生成时间：2026-04-29
> 输入：`01-optimizer-research.md`
> 决策记录：ProviderConfig 的 `defaultModel` 归入 BaseProviderConfig

---

## 一、项目概述

V21 将在一个迭代中完成 V7 剩余技术债清理（KR9/KR10/KR11）和 V7.5 全局状态解耦（KR1-KR5）。共 8 个优化项，分为 4 个执行阶段。

### 执行原则

1. 每个阶段有独立门禁，阶段内任务可并行
2. 高风险任务（V7.5 KR2）前置 POC 验证，POC 失败则该阶段暂停
3. 每个任务完成后必须 `bunx tsc --noEmit` 零错误 + `bun test` 通过

---

## 二、Agent Team 组成

| 角色 | 代号 | 职责 | 数量 |
|------|------|------|------|
| **team-lead** | lead | 任务分配、进度管理、阶段门禁决策 | 1 |
| **architect** | architect | SessionContextBridge 设计、代码审核、高风险方案评审 | 1 |
| **developer-1** | dev1 | KR9（initializeEngine 废弃）+ KR11（EngineFacade 消除）| 1 |
| **developer-2** | dev2 | KR10（ProviderConfig 统一）+ V7.5 KR1-KR3（状态迁移） | 1 |
| **tester** | tester | 测试迁移、回归验证、多 workspace 并发测试 | 1 |
| **doc-writer** | docs | 文档同步、OKR 状态更新 | 1 |

**总计 6 个 agent**

### 协作方式

- dev1 和 dev2 在 Phase 1 可并行工作（不同文件范围）
- architect 在每个 Phase 结束时进行代码审核
- tester 在每个任务完成后验证，不等到 Phase 结束
- docs 在每个 Phase 结束后更新文档

---

## 三、任务阶段规划

### Phase 1：V7 技术债清理（门禁：tsc + test 通过）

**目标**：消除 deprecated 启动路径、统一 ProviderConfig 类型、消除 EngineFacade 中间层

**预计任务**：T1-T3
**预计文件改动**：15-20 个生产代码文件 + 3 个测试文件
**风险级别**：低-中

### Phase 2：V7.5 基础设施准备（门禁：POC 通过 + 审计确认）

**目标**：确认写入收敛状态，建立 SessionContextBridge 桥接层

**预计任务**：T4-T5
**风险级别**：中（SessionContextBridge 是新引入的架构组件）

### Phase 3：V7.5 核心迁移（门禁：多 workspace 并发验证通过）

**目标**：bootstrap/state 核心字段 setter 双写 + getter ALS 优先 + 成本 ALS 化 + 序列化增强

**预计任务**：T6-T9
**风险级别**：高（121+ 文件间接影响）

### Phase 4：V7.5 收尾（门禁：审计确认 per-session 字段归零）

**目标**：bootstrap/state 降级审计 + 文档同步

**预计任务**：T10-T11
**风险级别**：低（审计确认性质）

---

## 四、任务清单

### Phase 1：V7 技术债清理

| 编号 | 任务名称 | 任务目标 | 依赖 | 执行人 | 验收标准 |
|------|---------|---------|------|--------|---------|
| T1 | ProviderConfig 类型统一 | 消除双重定义，统一到 AgentEngine.ts；defaultModel 归入 BaseProviderConfig；types.ts 删除重复定义 | 无 | dev2 | 1. `engine/types.ts` 中 ProviderConfig/VALID_PROVIDER_TYPES/ProviderType 定义已删除<br>2. `engine/provider/types/ProviderConfigs.ts` 的 BaseProviderConfig 包含 defaultModel 字段<br>3. Session.ts/EngineFacade.ts import 路径已更新<br>4. types.ts 可选保留 re-export<br>5. `bunx tsc --noEmit` 零错误 |
| T2 | 废弃 initializeEngine + 启动路径统一 | 消除 726 行废弃代码，SDK 只有一个初始化入口 | 无 | dev1 | 1. `validateEngineConfig()` 迁移到 `engine/config/ConfigValidation.ts`<br>2. `AgentEngine.create()` 内联 validateEngineConfig 调用<br>3. `src/index.ts` 删除 initializeEngine/createDefaultEngineConfig/validateEngineConfig 及相关类型导出<br>4. `UnifiedConfig.ts` 移除 EngineConfig 类型引用<br>5. 删除 `engine/bootstrap/initializeEngine.ts` 和 `engine/bootstrap/engineHelpers.ts`<br>6. 更新 `engine/bootstrap/index.ts`<br>7. `bunx tsc --noEmit` 零错误 + `bun test` 通过 |
| T3 | 消除 EngineFacade 中间层 | AgentEngine 直接持有 SessionManager，消除 1:1 透传层 | T1 | dev1 | 1. `SessionInfo` interface 迁移到 `engine/types.ts`<br>2. `src/index.ts` 和 `engine/index.ts` 导出路径更新<br>3. AgentEngine 新增 `sessionManager` 字段，替换 `facade`<br>4. `toSessionInfo()` 转换逻辑迁入 AgentEngine 作为私有方法<br>5. 修复 setMemoryPath metadata 赋值 bug（改为 session.setMetadata）<br>6. 删除 EngineFacade.ts<br>7. EngineFacade 测试迁移到 SessionManager/AgentEngine 测试<br>8. 清理 deprecated sessionMetadata Map<br>9. `bunx tsc --noEmit` 零错误 + `bun test` 通过 |

**Phase 1 门禁**：T1+T2+T3 全部完成 + tsc 零错误 + bun test 全通过 + architect 审核通过

---

### Phase 2：V7.5 基础设施准备

| 编号 | 任务名称 | 任务目标 | 依赖 | 执行人 | 验收标准 |
|------|---------|---------|------|--------|---------|
| T4 | bootstrap/state 写入收敛审计 | 确认 engine/ 对 bootstrap/state 的写入已收敛到 CCRuntime 单一入口 | Phase 1 | architect | 1. grep engine/ 目录确认无 `bootstrap/state.js` 的静态 import<br>2. 确认 DefaultCCRuntime.setupBootstrap() 是唯一写入点（仅 3 个 setter）<br>3. 输出审计报告到 multi-phase-execute-record.md |
| T5 | SessionContextBridge 桥接层设计与 POC | 设计并实现独立于 engine/ 层的 ALS 桥接层，解决 bootstrap/state ↔ SessionContext 的循环依赖 | T4 | architect + dev2 | 1. 新建 `src/shared/SessionContextBridge.ts`（或在 bootstrap/ 下），提供 set/get ALS 上下文的独立接口<br>2. 不依赖 engine/ 层的任何模块（避免循环依赖）<br>3. POC：修改 `bootstrap/state.ts` 的 `getSessionId()` 为"先查 ALS bridge，fallback 全局 STATE"<br>4. POC：修改 `switchSession()` 同时写入 ALS bridge<br>5. 运行全量测试验证 POC 无回归<br>6. `bunx tsc --noEmit` 零错误 |

**Phase 2 门禁**：T4 审计确认 + T5 POC 通过（ALS bridge 可读写，无循环依赖）

---

### Phase 3：V7.5 核心迁移

| 编号 | 任务名称 | 任务目标 | 依赖 | 执行人 | 验收标准 |
|------|---------|---------|------|--------|---------|
| T6 | 核心字段 setter 双写 | setCwdState/setSessionId/setProjectRoot/setOriginalCwd 同时写入全局 STATE 和 ALS bridge | T5 | dev2 | 1. `bootstrap/state.ts` 中 4 个核心 setter（setCwdState, setOriginalCwd, setProjectRoot, switchSession 内部调用的 regenerateSessionId 等）改为双写（STATE + ALS bridge）<br>2. 全量测试通过（双写不影响现有行为）<br>3. `bunx tsc --noEmit` 零错误 |
| T7 | 核心字段 getter ALS 优先 | getCwdState/getSessionId/getProjectRoot/getOriginalCwd 优先从 ALS bridge 读取 | T6 | dev2 | 1. 4 个核心 getter 改为"先查 ALS bridge，fallback 全局 STATE"<br>2. AgentEngine query 流程验证通过（ALS 上下文内读取正确）<br>3. CLI REPL 流程验证通过（无 ALS 上下文时 fallback 正确）<br>4. **多 workspace 并发测试**：两个 session 各自读写 cwd/projectRoot 互不干扰<br>5. `bunx tsc --noEmit` 零错误 + `bun test` 通过 |
| T8 | 成本/Token 状态 ALS 化 | totalCostUSD/modelUsage 等 8 个累积指标写入 SessionContext | T7 | dev2 | 1. `cost-tracker.ts` 的 `addToTotalCostState()` 和 `setCostStateForRestore()` 同时写入 ALS bridge<br>2. `services/api/logging.ts` 的 `addToTotalDurationState()` 同时写入 ALS bridge<br>3. query 结束后 SessionContext 中的成本字段与 STATE 一致<br>4. 全量测试通过<br>5. `bunx tsc --noEmit` 零错误 |
| T9 | SessionContext 序列化增强 | SessionContextSnapshot 从 5 个字段扩展到 27+ 个 per-session 字段 | T8 | dev2 | 1. `sessionContextToSnapshot()` 覆盖所有 per-session 字段（路径、成本、模型、行为标志、Session 级资源）<br>2. `restoreSessionContextFromSnapshot()` 完整还原所有字段<br>3. 序列化/反序列化往返测试通过<br>4. 现有恢复路径（setCostStateForRestore、sessionRestore.ts）的零散逻辑统一到 Snapshot 协议<br>5. `bunx tsc --noEmit` 零错误 |

**Phase 3 门禁**：T6+T7+T8+T9 全部完成 + 多 workspace 并发验证通过 + 全量测试通过

---

### Phase 4：V7.5 收尾

| 编号 | 任务名称 | 任务目标 | 依赖 | 执行人 | 验收标准 |
|------|---------|---------|------|--------|---------|
| T10 | bootstrap/state 降级审计 | 确认 per-session 字段归零，bootstrap/state 只保留进程级配置 | T9 | architect | 1. grep 审计确认 per-session getter/setter 仅通过 ALS bridge 间接使用<br>2. bootstrap/state.ts 保留的字段仅为 OTel/日志/ClientType/SdkBetas/StatsStore 等 ~12 项<br>3. 输出审计报告 |
| T11 | 文档同步 + OKR 状态更新 | 所有文档反映 V21 最终状态 | T10 | docs | 1. `docs/okr-roadmap.md` V7 和 V7.5 的 KR 状态更新为 ✅<br>2. `docs/architecture-design.md` 反映 EngineFacade 已消除、initializeEngine 已废弃、bootstrap/state 已降级<br>3. `auto-upgrade/v21/` 执行记录更新为最终状态 |

**Phase 4 门禁**：T10 审计通过 + T11 文档同步完成

---

## 五、执行时间线

```
Phase 1（T1-T3）: dev1 和 dev2 并行开发，tester 跟随验证
  T1 (dev2): ProviderConfig 统一 ────┐
  T2 (dev1): initializeEngine 废弃 ──┤── 可并行
  T3 (dev1): EngineFacade 消除 ──────┘  依赖 T1

Phase 2（T4-T5）: architect 主导
  T4: 写入收敛审计（快速确认）
  T5: SessionContextBridge POC（核心风险验证点）

Phase 3（T6-T9）: dev2 串行执行（每步依赖前一步验证）
  T6 → T7 → T8 → T9  严格串行，每步全量测试

Phase 4（T10-T11）: architect + docs 收尾
  T10: 降级审计
  T11: 文档同步
```

## 六、风险应对

| 风险 | 触发条件 | 应对措施 |
|------|---------|---------|
| SessionContextBridge 循环依赖 | T5 POC 中发现 import 循环 | 将 bridge 实现为独立的 async_hooks（AsyncLocalStorage），不依赖任何 engine/ 或 services/ 模块 |
| ALS 上下文在 CC query 中不可用 | T7 中 CC 原始代码读不到 ALS 值 | 保留 fallback 到全局 STATE，确保现有行为不变；ALS 覆盖率提升作为渐进目标 |
| 多 workspace 并发测试失败 | T7 验证时发现状态互相覆盖 | 回退到 fallback 模式，只做双写不做 ALS 优先读取 |
| EngineFacade 消除导致公共 API 变化 | T3 后发现 SessionInfo 导出路径变化影响外部用户 | 保留 re-export 兼容层 |
