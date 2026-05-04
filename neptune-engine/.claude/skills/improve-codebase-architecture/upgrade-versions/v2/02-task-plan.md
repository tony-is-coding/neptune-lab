# V2 任务计划书

**版本**：v2
**创建时间**：2026-04-26
**输入**：`auto-upgrade/v2/01-optimizer-research.md`（15 个优化点）

---

## 一、项目概述

基于 Phase 1 深度分析报告，将 15 个优化点转化为可执行的任务计划。核心策略：

- **深度治理优先**：先解决设计合理性和耦合问题，为分布式支持打基础
- **并行最大化**：无依赖任务并行执行，缩短总工期
- **风险递进**：低风险快速任务先行，高风险核心任务在有回归保护后执行

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 负责任务 |
|------|------|------|----------|
| **team-lead** | 1 | 协调者：任务分配、进度管理、代码审核 | 全局协调 + 审核所有 PR |
| **architect** | 1 | 架构师：CC 依赖抽象、多 workspace、类型瘦身 | T7, T11, T13, T15 |
| **dev-a** | 1 | 开发者：质量提升 + 事件能力 | T1-T5, T9 |
| **dev-b** | 1 | 开发者：资源管理 + tsc + 集成测试 | T6, T10, T14 |
| **doc-writer** | 1 | 文档：文档真实性治理 + 架构文档更新 | T8, T12 |

**总计：5 个 agent**

### 协作规则

- team-lead 负责任务分配和进度管理
- architect 负责架构设计和代码审核，所有代码改动需 architect 审核
- dev-a / dev-b 负责代码编写和测试
- doc-writer 负责文档更新
- 所有成员通过 TaskList 查找可用任务，通过 SendMessage 协调

---

## 三、任务阶段划分

```
Stage 1（并行启动）────────────────────────────────────────┐
  dev-a:     T1(#5) T2(#6) T3(#7) T4(#11) T5(#13)        │
  dev-b:     T6(#10)                                       │
  architect: T7(#3)                                        │
  doc-writer:T8(#4)                                        │
Stage 2（Stage 1 完成后）──────────────────────────────────┤
  dev-a:     T9(#2)                                        │
  dev-b:     T10(#9)                                       │
  architect: T11(#1) ← 依赖 T7                             │
  doc-writer:T12(#14)                                      │
Stage 3（T11 完成后）──────────────────────────────────────┤
  architect: T13(#12) ← 依赖 T7                             │
  dev-b:     T14(#8)  ← 依赖 T7 + T11                      │
Stage 4（T13 + T14 完成后）────────────────────────────────┤
  architect: T15(#15) ← 依赖 T11                            │
└──────────────────────────────────────────────────────────┘
```

---

## 四、任务清单

### T1：清理 types.ts 死类型和 ToolAdapter 孤立代码

| 维度 | 内容 |
|------|------|
| **编号** | T1 |
| **优化点** | #5 |
| **任务目标** | 移除 types.ts 中未使用的 EngineEvent/TextEvent/ResultEvent/SystemEvent 类型；评估 ToolAdapter 是否应保留 |
| **执行角色** | dev-a |
| **输入** | types.ts、tools/ToolAdapter.ts |
| **预期产出** | types.ts 精简后仅保留实际使用的类型；ToolAdapter 移除或标注为通用工具 |
| **依赖关系** | 无 |
| **验收标准** | 1. types.ts 中无未导出/未使用的类型 2. engine/ 内 `grep -r "EngineEvent\|TextEvent\|ResultEvent\|SystemEvent"` 无引用 3. engine/ tsc 0 错误 4. 现有测试通过 |
| **优先级** | P2 |

### T2：Session 错误类型统一

| 维度 | 内容 |
|------|------|
| **编号** | T2 |
| **优化点** | #6 |
| **任务目标** | Session 类内部 throw 使用 EngineError 替代原生 Error |
| **执行角色** | dev-a |
| **输入** | Session.ts、errors.ts |
| **预期产出** | Session 所有 throw 使用 EngineError；新增 SESSION_INVALID_OPERATION 错误码 |
| **依赖关系** | 无 |
| **验收标准** | 1. Session.ts 中无 `throw new Error(` 调用 2. 新增 SESSION_INVALID_OPERATION 错误码 3. SessionManager 无需 try-catch 再包装 Session 内部错误 4. Session.test.ts 更新并全部通过 |
| **优先级** | P2 |

### T3：MACRO 版本同步机制

| 维度 | 内容 |
|------|------|
| **编号** | T3 |
| **优化点** | #7 |
| **任务目标** | 消除 Bridge 中 MACRO 版本号 '2.1.888' 硬编码风险 |
| **执行角色** | dev-a |
| **输入** | OriginalQueryEngineBridge.ts、scripts/defines.ts |
| **预期产出** | injectMacroDefines() 从 defines.ts 导入或运行时读取 package.json |
| **依赖关系** | 无 |
| **验收标准** | 1. OriginalQueryEngineBridge.ts 中无硬编码版本号 '2.1.888' 2. 版本号来源有注释说明 3. engine/ tsc 0 错误 |
| **优先级** | P2 |

### T4：EventBus 错误处理增强

| 维度 | 内容 |
|------|------|
| **编号** | T4 |
| **优化点** | #11 |
| **任务目标** | EventBus handler 异常不中断事件链；Hook 抛异常不中断后续处理 |
| **执行角色** | dev-a |
| **输入** | EventBus.ts |
| **预期产出** | emit() 中每个 handler 用 try-catch 包裹；Hook 异常记录日志但不传播 |
| **依赖关系** | 无 |
| **验收标准** | 1. 单个 handler 抛异常不影响其他 handler 2. Hook 抛异常不中断后续 Hook 和监听器 3. event-bus.test.ts 新增错误场景测试用例 |
| **优先级** | P2 |

### T5：loadSession 和 require('fs') 一致性

| 维度 | 内容 |
|------|------|
| **编号** | T5 |
| **优化点** | #13 |
| **任务目标** | AgentEngine 中 require('fs').readdirSync 改为已导入的 fs 方法；getMemoryPath 的 require 改为静态导入 |
| **执行角色** | dev-a |
| **输入** | AgentEngine.ts |
| **预期产出** | loadSession 使用 `import { readdirSync } from 'fs'`；getMemoryPath 使用已导入的 session 模块函数 |
| **依赖关系** | 无 |
| **验收标准** | 1. AgentEngine.ts 中无 `require('fs')` 调用 2. 无 `require('./session/SessionContext.js')` 调用 3. engine/ tsc 0 错误 |
| **优先级** | P2 |

### T6：query() 暂停/恢复与 QueryEngine 资源管理

| 维度 | 内容 |
|------|------|
| **编号** | T6 |
| **优化点** | #10 |
| **任务目标** | Session pause 后释放 QueryEngine 资源；暂停中的 Session 调用 query() 抛明确错误 |
| **执行角色** | dev-b |
| **输入** | AgentEngine.ts、EngineFacade.ts |
| **预期产出** | pauseSession 时从 queryEngines Map 移除 QueryEngine；paused 状态 query() 抛 SESSION_PAUSED 错误 |
| **依赖关系** | 无 |
| **验收标准** | 1. pauseSession 后 queryEngines Map 中无对应 entry 2. paused 状态调用 query() 抛 EngineError(SESSION_PAUSED) 3. 新增 SESSION_PAUSED 错误码 4. session-manager.test.ts / engine-facade.test.ts 更新 |
| **优先级** | P1 |

### T7：CC 依赖抽象层——require() 统一入口

| 维度 | 内容 |
|------|------|
| **编号** | T7 |
| **优化点** | #3 |
| **任务目标** | 将 engine/ 对 CC 原始模块的 require() 统一到 CCRuntime 接口，支持 mock 注入 |
| **执行角色** | architect |
| **输入** | OriginalQueryEngineBridge.ts、AgentEngine.ts、所有 CC require 调用点 |
| **预期产出** | 新增 CCRuntime 接口定义 CC 模块访问；Bridge 和 AgentEngine 通过 CCRuntime 访问 CC 能力；提供默认实现和 mock 实现 |
| **依赖关系** | 无 |
| **验收标准** | 1. AgentEngine.ts 中无直接 require CC 模块（通过 CCRuntime 间接访问） 2. Bridge 中的 require 可通过 CCRuntime 接口替换 3. 提供 MockCCRuntime 用于测试 4. 现有功能回归测试通过 5. engine/ tsc 0 错误 |
| **优先级** | P0 |

### T8：文档真实性治理——EventBus 和 SessionManager 设计文档

| 维度 | 内容 |
|------|------|
| **编号** | T8 |
| **优化点** | #4 |
| **任务目标** | 将 EventBus 和 SessionManager 设计文档与实际实现对齐；标注"已实现"和"规划中" |
| **执行角色** | doc-writer |
| **输入** | event-bus-design.md、session-manager-design.md、实际代码 |
| **预期产出** | EventBus 文档移除未实现的 EventPersistence/异步分发/EngineEventType 等；SessionManager 文档移除等待队列/优先级调度等；所有未实现能力标注为"规划中" |
| **依赖关系** | 无（可与代码任务并行） |
| **验收标准** | 1. EventBus 文档 API 与代码 EventBus 类完全匹配 2. SessionManager 文档 API 与代码 SessionManager 类完全匹配 3. 所有"规划中"能力用明确标签标注 4. 无虚假的已实现描述 |
| **优先级** | P1 |

### T9：框架生命周期事件完善

| 维度 | 内容 |
|------|------|
| **编号** | T9 |
| **优化点** | #2 |
| **任务目标** | 在 Session 状态变更时 emit 生命周期事件到 EventBus |
| **执行角色** | dev-a |
| **输入** | AgentEngine.ts、EngineFacade.ts、EventBus.ts |
| **预期产出** | createSession 时 emit('session:created', ...)；pause/resume/destroy 时 emit 对应事件；Engine 销毁时 emit('engine:stopped') |
| **依赖关系** | 无（但建议 T4 完成后，利用增强的错误处理） |
| **验收标准** | 1. 4 个生命周期事件正确 emit：session:created、session:paused、session:resumed、session:destroyed 2. engine:stopped 在 destroy() 时 emit 3. 事件 payload 包含 { sessionId, workspace } 4. 新增 lifecycle-event.test.ts 验证事件触发 |
| **优先级** | P1 |

### T10：22 个预存 tsc 错误修复

| 维度 | 内容 |
|------|------|
| **编号** | T10 |
| **优化点** | #9 |
| **任务目标** | 修复 22 个非 engine/ 的 SessionId | undefined 类型收紧错误 |
| **执行角色** | dev-b |
| **输入** | 16 个受影响文件、错误详情 |
| **预期产出** | 所有受影响文件添加空值守卫或非空断言；tsc --noEmit 0 错误 |
| **依赖关系** | 无 |
| **验收标准** | 1. `bunx tsc --noEmit` 输出 0 错误 2. 修复模式统一：优先空值守卫，确信非空处用 `!` 断言 3. 每个修复添加注释说明原因 |
| **优先级** | P1 |

### T11：initializeRuntime 多 workspace 支持

| 维度 | 内容 |
|------|------|
| **编号** | T11 |
| **优化点** | #1 |
| **任务目标** | 解除进程级单例限制，支持多 workspace 并发初始化 |
| **执行角色** | architect |
| **输入** | OriginalQueryEngineBridge.ts、bootstrap/state.ts、CC cwd 机制 |
| **预期产出** | runtimeInitialized 从模块级改为 per-workspace Map；query() 执行时通过 AsyncLocalStorage 或 cwdOverride 隔离 workspace 上下文 |
| **依赖关系** | T7（CC 依赖抽象层） |
| **验收标准** | 1. 两个不同 workspace 的 Session 可并发 query() 2. query() 执行期间 CC 内部读取的 cwd 是正确的 session workspace 3. 多 Session 并发测试通过 4. 现有单 Session 功能回归通过 |
| **优先级** | P0 |

### T12：架构设计文档更新——反映 V1+V2 改动

| 维度 | 内容 |
|------|------|
| **编号** | T12 |
| **优化点** | #14 |
| **任务目标** | architecture-design.md 与代码完全一致 |
| **执行角色** | doc-writer |
| **输入** | architecture-design.md、engine/ 实际代码、T8 的文档治理成果 |
| **预期产出** | setMemoryPath 签名修正；ToolAdapter 职责描述修正；PermissionConfig 补充；模块列表与实际文件一致 |
| **依赖关系** | T8（参考文档治理标准） |
| **验收标准** | 1. API 签名与代码完全匹配 2. 模块列表与 engine/ 目录文件完全匹配 3. 无过时描述 |
| **优先级** | P1 |

### T13：SessionContext 字段瘦身

| 维度 | 内容 |
|------|------|
| **编号** | T13 |
| **优化点** | #12 |
| **任务目标** | 精简 SessionContext 到 engine/ 实际需要的字段，减少与 bootstrap/state 的重复 |
| **执行角色** | architect |
| **输入** | SessionContext.ts、bootstrap/state.ts、CC 原始代码中对 SessionContext 的访问 |
| **预期产出** | SessionContext 接口精简到 engine/ 实际使用的字段；CC 原始代码仍能通过 SessionContextStorage 获取全部状态 |
| **依赖关系** | T7（CC 依赖抽象层） |
| **验收标准** | 1. SessionContext 字段数 ≤ 20（当前 30+） 2. CC 原始代码（QueryEngine 等）功能不受影响 3. engine/ tsc 0 错误 |
| **优先级** | P1 |

### T14：AgentEngine 集成测试体系

| 维度 | 内容 |
|------|------|
| **编号** | T14 |
| **优化点** | #8 |
| **任务目标** | 建立 AgentEngine 核心链路的集成测试 |
| **执行角色** | dev-b |
| **输入** | AgentEngine.ts、MockCCRuntime（T7 产出）、EventBus |
| **预期产出** | claude-code-framework-test/integration/ 目录；query() 集成测试；loadSession() 集成测试；多 Session 并发测试 |
| **依赖关系** | T7（需要 MockCCRuntime）+ T11（多 workspace 测试需要此能力） |
| **验收标准** | 1. 新增 ≥ 3 个集成测试文件 2. query() 测试覆盖：创建→query→yield+EventBus emit→销毁 3. loadSession() 测试覆盖：JSONL 解析→Session 创建→历史消息恢复 4. 多 Session 测试覆盖：不同 workspace 并发不冲突 |
| **优先级** | P1 |

### T15：分布式基础——状态序列化协议设计

| 维度 | 内容 |
|------|------|
| **编号** | T15 |
| **优化点** | #15 |
| **任务目标** | 为 Session、EventBus 事件定义跨进程序列化协议 |
| **执行角色** | architect |
| **输入** | Session.ts、EventBus.ts、T11 和 T13 的产出 |
| **预期产出** | 序列化协议设计文档；Session.transport() / Session.fromTransport() 方法（或验证 toSnapshot/restore 满足需求）；EventBusMessage 序列化格式 |
| **依赖关系** | T11（多 workspace）+ T13（SessionContext 瘦身） |
| **验收标准** | 1. 设计文档描述 Session、EventBus event、SessionContext 的序列化格式 2. Session toSnapshot→restore 往返测试通过 3. 新增 EventBusMessage 类型定义 |
| **优先级** | P2 |

---

## 五、关键路径分析

```
关键路径（最长依赖链）：
T7(CC 抽象) → T11(多 workspace) → T14(集成测试)    ← 决定总工期
            → T13(SessionContext) → T15(分布式)

可并行的任务：
Stage 1: T1 + T2 + T3 + T4 + T5 + T6 + T7 + T8  ← 8 个任务并行
Stage 2: T9 + T10 + T11 + T12                    ← 4 个任务并行
Stage 3: T13 + T14                               ← 2 个任务并行
Stage 4: T15                                      ← 1 个任务
```

**预计关键路径**：T7 → T11 → T14（3 个串行任务，均为 architect/dev-b 高复杂度任务）

---

## 六、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| T7(CC 抽象) 设计不当，过度抽象 | 增加复杂度，降低可读性 | 保持最小抽象——只抽象 require 调用点，不重构 CC 内部代码 |
| T11(多 workspace) 改动面大 | 可能引入回归 | 利用 T14 的集成测试作为门禁；分步实施，先支持双 workspace |
| T10(tsc 修复) 涉及 16 个 CC 文件 | 可能影响 CC 原始功能 | 统一修复模式，每个修复加注释说明原因 |
| T13(SessionContext 瘦身) CC 反向依赖 | CC 原始代码可能依赖被移除的字段 | 先审计 CC 原始代码的实际依赖，只移除确认无引用的字段 |
| 并行开发冲突 | 多人同时改同一文件 | team-lead 协调文件锁定；Stage 内任务按文件分工 |
