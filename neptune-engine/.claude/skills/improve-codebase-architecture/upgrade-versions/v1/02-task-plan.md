# V1 任务计划

**版本**：v1
**创建时间**：2026-04-25
**输入产物**：`auto-upgrade/v1/01-optimizer-research.md`
**执行范围**：全部 10 个优化点

---

## 一、项目概述

基于 Phase 1 深度分析报告，对 `src/engine/` 进行系统性优化。共 10 个优化点，按依赖关系分为 4 个执行阶段。

**核心原则**：
- 架构对齐优先，先解决架构违规，再做深层重构
- "包装不替代"原则是最高判断标准
- 每个任务完成后必须通过验收才能进入下一任务

---

## 二、Agent Team 组成

| 角色 | 名称 | 职责 | 分配任务 |
|------|------|------|----------|
| **team-lead** | lead | 协调者：任务分配、进度管理、代码审核、质量门禁 | 协调所有任务 |
| **architect** | architect | 架构敏感任务：涉及 CC 原始代码交互、全局状态改造 | T2, T7, T8 |
| **dev-a** | dev-a | 通用开发任务：文件删除、清理、日志统一 | T1, T4, T6 |
| **dev-b** | dev-b | 核心开发任务：EventBus 桥接、错误重构、类型安全 | T3, T5, T9 |
| **tester** | tester | 测试体系：创建测试基础设施、编写核心模块测试 | T10 |

**协作方式**：
- team-lead 负责任务分配和进度跟踪
- 每个任务完成后 team-lead 进行代码审核
- architect 完成的任务由 team-lead 二次审核
- tester 在所有代码任务完成后集中构建测试

---

## 三、任务阶段划分

```
阶段 A（架构对齐）── 4 个任务并行，无依赖
  T1 Adapters 移出 ──── dev-a
  T2 canUseTool 权限 ── architect
  T3 错误分类重构 ────── dev-b
  T4 日志系统统一 ────── dev-a

阶段 B（核心能力）── T1 完成后启动
  T5 query→EventBus ─── dev-b（依赖 T1）
  T6 死代码清理 ──────── dev-a（依赖 T1）

阶段 C（深层重构）── T5 完成后启动
  T7 全局状态隔离 ────── architect（依赖 T5）
  T8 SessionContext ──── architect（依赖 T7）

阶段 D（质量提升）── T8 完成后启动
  T9 类型安全提升 ────── dev-b（依赖 T8）
  T10 测试体系建设 ───── tester（依赖 T9）
```

---

## 四、任务清单

### T1: Adapters 移出框架

| 字段 | 内容 |
|------|------|
| **编号** | T1 |
| **优化点** | #1 |
| **名称** | Adapters 移出框架 |
| **目标** | 删除 engine/adapters/ 目录，将 3 个 Adapter 移到框架外示例项目 |
| **执行角色** | dev-a |
| **输入** | engine/adapters/ 下 3 个文件；architecture-design.md 1.2 节"框架轻量"原则 |
| **预期产出** | 1. engine/adapters/ 目录删除<br>2. 所有对 adapters 的 import 引用清理<br>3. index.ts 导出中移除 adapters 相关导出 |
| **依赖** | 无 |
| **验收标准** | 1. `engine/adapters/` 目录不存在<br>2. `grep -r "adapters" engine/` 结果为空（除注释外）<br>3. TypeScript 编译无报错<br>4. 现有测试通过 |
| **优先级** | P0 |
| **预估复杂度** | 低（删除操作） |

### T2: canUseTool 权限恢复

| 字段 | 内容 |
|------|------|
| **编号** | T2 |
| **优化点** | #4 |
| **名称** | canUseTool 权限恢复 |
| **目标** | Bridge 中 canUseTool 调用 CC 原始权限检查，支持 Extension 配置覆盖策略 |
| **执行角色** | architect |
| **输入** | bridge/OriginalQueryEngineBridge.ts:140；CC 原始 canUseTool 实现（hooks/useCanUseTool.js） |
| **预期产出** | 1. canUseTool 默认调用 CC 原始权限检查函数<br>2. Extension 配置新增可选 permissions 字段<br>3. headless 模式下的权限交互处理方案 |
| **依赖** | 无 |
| **验收标准** | 1. Bridge 创建 QueryEngine 时 canUseTool 不再硬编码 allow<br>2. 无 permissions 配置时行为与 CC CLI 一致<br>3. 有 permissions bypass 配置时允许自动授权<br>4. TypeScript 编译无报错 |
| **优先级** | P0 |
| **预估复杂度** | 中（需要理解 CC 权限系统在 headless 模式的行为） |

### T3: 错误分类机制重构

| 字段 | 内容 |
|------|------|
| **编号** | T3 |
| **优化点** | #6 |
| **名称** | 错误分类机制重构 |
| **目标** | 定义 SessionError 类型，消除 EngineFacade 中的字符串匹配 |
| **执行角色** | dev-b |
| **输入** | SessionManager.ts（throw 位置）；EngineFacade.ts:77-79（字符串匹配位置） |
| **预期产出** | 1. 新建 SessionError 类（code + message）<br>2. SessionManager 所有 throw 改为 SessionError<br>3. EngineFacade 错误处理改为基于 error.code |
| **依赖** | 无 |
| **验收标准** | 1. SessionError 定义在 engine/types.ts 或独立文件<br>2. SessionManager 不再有裸 throw new Error(...)<br>3. EngineFacade 不再有 .includes('字符串') 逻辑<br>4. TypeScript 编译无报错 |
| **优先级** | P1 |
| **预估复杂度** | 低 |

### T4: 日志系统统一

| 字段 | 内容 |
|------|------|
| **编号** | T4 |
| **优化点** | #9 |
| **名称** | 日志系统统一 |
| **目标** | 合并 observability/ 和 log/ 双系统，消除冗余 |
| **执行角色** | dev-a |
| **输入** | engine/observability/（3 文件）；engine/log/（10 文件） |
| **预期产出** | 1. 删除 ObservabilityContext.ts（无外部使用者）<br>2. 保留 EngineLogger 接口作为 log/ 的对外接口<br>3. ConsoleLogger 功能合并到 ConsoleLogProvider |
| **依赖** | 无 |
| **验收标准** | 1. engine/observability/ 目录删除或仅保留 EngineLogger 接口文件<br>2. LogUtil 继续实现 EngineLogger 接口<br>3. bridge/OriginalQueryEngineBridge.ts 日志功能不受影响<br>4. TypeScript 编译无报错 |
| **优先级** | P2 |
| **预估复杂度** | 低 |

### T5: query→EventBus 自动桥接

| 字段 | 内容 |
|------|------|
| **编号** | T5 |
| **优化点** | #2 |
| **名称** | query→EventBus 自动桥接 |
| **目标** | 在 AgentEngine.query() 中集成 EventBus.emit()，实现同一 Message 同时推+拉 |
| **执行角色** | dev-b |
| **输入** | AgentEngine.ts:224-276（query 方法）；EventBus.ts（emit 方法） |
| **预期产出** | 1. query() 中每次 yield 前调用 eventBus.emit()<br>2. emit 的 type 基于 CC Message 类型映射<br>3. 现有 yield 行为不受影响 |
| **依赖** | T1（adapters 移除后，避免改动即将删除的代码） |
| **验收标准** | 1. query() 方法内部有 eventBus.emit() 调用<br>2. on('message') 监听器能收到与 yield 相同的 Message<br>3. 无监听器时 yield 行为不受影响（emit 不抛异常）<br>4. TypeScript 编译无报错 |
| **优先级** | P0 |
| **预估复杂度** | 中（需要确定 CC Message 类型到事件类型的映射） |

### T6: 死代码清理

| 字段 | 内容 |
|------|------|
| **编号** | T6 |
| **优化点** | #7 |
| **名称** | 死代码清理 |
| **目标** | 清理 conversationLog、死配置、空函数、未使用 import |
| **执行角色** | dev-a |
| **输入** | Session.ts（conversationLog）；SessionManagerConfig（死字段）；SessionContext.ts:218-221（空函数）；LogRecord.ts:9-11（未使用 import）；types.ts:28-30（废弃接口） |
| **预期产出** | 1. 移除 Session._conversationLog、appendConversationLog()、getConversationLog()<br>2. 移除 SessionManagerConfig 中 5 个未使用字段<br>3. 移除 SessionContext.setSessionContext() 空函数<br>4. 清理 LogRecord.ts 未使用 import<br>5. 清理 types.ts EngineFacadeConfig 废弃接口 |
| **依赖** | T1（adapters 移除后一起清理更干净） |
| **验收标准** | 1. grep "conversationLog" engine/ 结果为空<br>2. SessionManagerConfig 只保留实际使用的字段<br>3. grep "setSessionContext" engine/ 结果为空<br>4. grep "EngineFacadeConfig" engine/ 结果为空<br>5. TypeScript 编译无报错 |
| **优先级** | P1 |
| **预估复杂度** | 低（全部是删除操作） |

### T7: 全局状态隔离

| 字段 | 内容 |
|------|------|
| **编号** | T7 |
| **优化点** | #3 |
| **名称** | 全局状态隔离——消除 process.env 和进程级单例 |
| **目标** | setMemoryPath() 迁移到 AsyncLocalStorage，initializeRuntime() 支持多 cwd 或文档化为单 session 限制 |
| **执行角色** | architect |
| **输入** | AgentEngine.ts:304-320（setMemoryPath）；bridge/OriginalQueryEngineBridge.ts:57-86（initializeRuntime）；CC bootstrap/state.js |
| **预期产出** | 1. setMemoryPath() 不再写入 process.env<br>2. 记忆路径通过 AsyncLocalStorage 或 SessionContext 传递<br>3. initializeRuntime() 改造方案（per-session 或明确单 session 限制） |
| **依赖** | T5（EventBus 桥接完成后，全局状态改造更清晰） |
| **验收标准** | 1. grep "process.env" engine/ 中不再有 CLAUDE_COWORK_MEMORY_PATH_OVERRIDE 写入<br>2. setMemoryPath/getMemoryPath 通过 AsyncLocalStorage 工作<br>3. 如果选择单 session 限制，需在文档和类型中明确标注<br>4. TypeScript 编译无报错 |
| **优先级** | P0 |
| **预估复杂度** | 高（涉及 CC bootstrap 全局状态理解） |

### T8: SessionContext 职责拆分

| 字段 | 内容 |
|------|------|
| **编号** | T8 |
| **优化点** | #5 |
| **名称** | SessionContext 职责拆分 |
| **目标** | 将 306 行的 SessionContext.ts 拆分为类型定义、AsyncLocalStorage 管理、TokenBudget 管理三个模块 |
| **执行角色** | architect |
| **输入** | session/SessionContext.ts（306 行） |
| **预期产出** | 1. SessionContext.ts（类型定义 + 默认值）≤ 100 行<br>2. SessionContextStorage.ts（AsyncLocalStorage 管理）独立文件<br>3. TokenBudgetManager.ts（预算管理）独立文件<br>4. 所有外部 import 路径更新 |
| **依赖** | T7（全局状态隔离完成后，SessionContext 结构更确定） |
| **验收标准** | 1. SessionContext.ts ≤ 100 行<br>2. 三个新文件各自职责单一<br>3. 所有引用 SessionContext 的外部代码不需改动或只需改 import 路径<br>4. TypeScript 编译无报错 |
| **优先级** | P1 |
| **预估复杂度** | 中（纯文件拆分，无行为变更） |

### T9: 类型安全提升

| 字段 | 内容 |
|------|------|
| **编号** | T9 |
| **优化点** | #8 |
| **名称** | 类型安全提升——消除 any |
| **目标** | 为 QueryEngine 实例、EventBus、SQLiteSessionStore 添加具体类型，将 any 从 30+ 减少到 ≤ 10 |
| **执行角色** | dev-b |
| **输入** | AgentEngine.ts:65（queryEngines Map）；EventBus.ts:8/11/42（全链路 any）；SQLiteSessionStore.ts:44-66（查询结果） |
| **预期产出** | 1. 定义 QueryEngineWrapper 接口替代 `Map<string, any>`<br>2. EventBus 添加泛型支持<br>3. SQLiteSessionStore 定义 SessionRow 类型 |
| **依赖** | T8（SessionContext 拆分后类型更清晰） |
| **验收标准** | 1. grep "any" engine/ 中 any 出现次数 ≤ 10（仅 catch 子句等合理场景）<br>2. AgentEngine.queryEngines 有具体类型<br>3. EventBus EventHandler/emit 有泛型约束<br>4. TypeScript 编译无报错 |
| **优先级** | P2 |
| **预估复杂度** | 中（需要处理 CC 上游类型引用） |

### T10: 测试体系建设

| 字段 | 内容 |
|------|------|
| **编号** | T10 |
| **优化点** | #10 |
| **名称** | 测试体系建设 |
| **目标** | 创建测试基础设施，覆盖所有核心模块的核心路径 |
| **执行角色** | tester |
| **输入** | 所有优化完成后的 engine/ 代码；CLAUDE.md TDD 规范；claude-code-framework-test/ 规范 |
| **预期产出** | 1. 创建 claude-code-framework-test/ 目录结构<br>2. 为以下模块编写核心路径测试：AgentEngine、EngineFacade、SessionManager、Session、EventBus<br>3. 测试 CLI 工具可正常运行 |
| **依赖** | T9（所有代码变更完成后才开始写测试） |
| **验收标准** | 1. claude-code-framework-test/ 目录存在且结构符合 CLAUDE.md 规范<br>2. 每个模块至少 3 个核心路径测试用例<br>3. 所有测试通过<br>4. 测试覆盖率 ≥ 50%（核心模块） |
| **优先级** | P2 |
| **预估复杂度** | 中（需要搭建测试基础设施 + 编写测试用例） |

---

## 五、关键路径分析

```
关键路径（最长链）：
T1(2h) → T5(3h) → T7(5h) → T8(3h) → T9(4h) → T10(6h) ≈ 23h

并行优化后：
阶段A: T1(2h) + T2(3h) + T3(1h) + T4(2h) = 3h（并行取最长）
阶段B: T5(3h) + T6(1h) = 3h（并行取最长）
阶段C: T7(5h) + T8(3h) = 8h（串行）
阶段D: T9(4h) + T10(6h) = 10h（T10 可在 T9 完成后立即开始）

总耗时 ≈ 3h + 3h + 8h + 10h = 24h（含并行优化）
```

**关键路径瓶颈**：T7（全局状态隔离）是复杂度最高的任务，是整体进度的最大瓶颈。

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| T7 全局状态隔离改造范围超出预期 | 中 | 高 | 先调研 CC bootstrap/state 的完整依赖范围，必要时拆为多轮 |
| T2 canUseTool 权限恢复在 headless 模式下行为不符预期 | 中 | 中 | 先实现 bypass 模式，原始权限作为可选项 |
| T9 类型安全提升中 CC 上游类型路径变更 | 低 | 低 | 使用 type import + 动态 require 双轨策略 |
| 并行任务间的文件冲突（多人编辑同一文件） | 低 | 中 | team-lead 在任务分配时确保文件无交叉 |
| T10 测试体系搭建时间超出预期 | 低 | 中 | 优先覆盖核心路径，非核心路径在后续迭代补充 |
