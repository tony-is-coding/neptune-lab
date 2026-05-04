# V18 任务计划

> 版本：V18
> 日期：2026-04-28
> 输入：`01-optimizer-research.md` TOP 10 优化清单
> 范围：9 个优化点（#5 Provider 接入延后 V19）
> 团队：6 人（team-lead + architect + 3 developer + tester）

---

## 一、项目概述

将 OKR V6 研究发现的 10 个优化点中 9 个纳入 V18 执行。排除 #5（Provider 运行时接入，高风险延后 V19）。

**V18 交付目标**：SDK 实现状态外化 + 可观测性 Provider + 配置归一化 + 架构边界清理。

---

## 二、Agent Team 组成

### 角色清单

| 角色 | 数量 | 职责 | 能力要求 |
|------|------|------|---------|
| **team-lead** | 1 | 协调任务分配、进度管理、阶段门禁审核 | 全局视野、项目管理 |
| **architect** | 1 | 架构方案审核、高风险决策、代码 review | 深度理解 engine/ 架构 |
| **developer-1** | 1 | 状态外化 + 全局单例 + 存储补齐 + Session 修复 | 熟悉 AgentEngine/SessionManager/Storage |
| **developer-2** | 1 | 配置归一化 + 穿透依赖清理 | 熟悉 Bridge/Config/Types 体系 |
| **developer-3** | 1 | 可观测性 + 死代码清理 | 熟悉 LogUtil/EventBus/OTel |
| **tester** | 1 | 编写测试、验证门禁、回归测试 | TDD、engine/ 测试框架 |

### 协作方式

- **architect** 在每个任务开始前审核方案，完成后审核代码
- **tester** 在任务开始时同步编写测试用例（TDD），任务完成后跑回归
- **team-lead** 跟踪进度，协调依赖，处理阻塞

---

## 三、任务阶段规划

### 阶段定义

| 阶段 | 目标 | 包含任务 | 预期产出 |
|------|------|---------|---------|
| **Phase 1：基础设施** | 状态外化 + 配置统一 + 可观测性接口 + 依赖屏障 | T1-T9 | SDK 状态可外化、配置清晰、可观测性 Provider 就绪 |
| **Phase 2：核心重构** | 全局单例迁移 + 依赖注入改造 | T10-T12 | 多实例安全、穿透依赖大幅下降 |
| **Phase 3：存储补齐** | Memory/Content Store + Session 暂停恢复 | T13-T15 | 存储层完整、Session 生命周期修复 |

### 阶段门禁

| 门禁 | Phase 1 → Phase 2 | Phase 2 → Phase 3 |
|------|-------------------|-------------------|
| 测试 | 现有 800+ engine 测试全部通过 | 新增测试全部通过 |
| 结构 | SessionManager 以 store 为主存储 | engine/ 穿透 < 15 处 |
| 行为 | AgentEngine.query() 行为等价 | 多实例测试通过 |

---

## 四、任务清单

### Phase 1：基础设施

#### T1：Session 实体扩展 + Metadata 统一

| 字段 | 内容 |
|------|------|
| **任务编号** | T1 |
| **对应优化** | #1b + #10 |
| **任务目标** | Session 实体包含完整状态（metadata/prompts/providers），废弃 EngineFacade.sessionMetadata Map |
| **执行人** | developer-1 |
| **依赖关系** | 无 |
| **具体工作** | 1. Session.toSnapshot() 增加 metadata、systemPrompt、providerConfig 字段<br>2. Session.restore() 反序列化这些字段<br>3. 废弃 EngineFacade.sessionMetadata Map，将所有读写改为操作 Session._metadata<br>4. setMemoryPath 等修改 metadata 的路径统一到 Session 实例 |
| **验收标准** | 1. Session.toSnapshot() 包含 metadata/prompts/providers<br>2. EngineFacade 不再持有 sessionMetadata Map<br>3. 现有 session 元数据相关测试全部通过 |
| **风险评估** | 低，数据模型扩展不影响 CC 核心 |

---

#### T2：SessionManager write-through 重构

| 字段 | 内容 |
|------|------|
| **任务编号** | T2 |
| **对应优化** | #1a |
| **任务目标** | SessionManager 以 ISessionStore 为主存储，启动时自动恢复，状态变更即时写入 |
| **执行人** | developer-1 |
| **依赖关系** | T1（Session 实体包含完整字段） |
| **具体工作** | 1. SessionManager.createSession 写入 store 后再写入内存 Map（write-through）<br>2. SessionManager 构造函数调用 restoreFromStore() 恢复已有 session<br>3. destroySession 同步删除 store 和内存 Map<br>4. AgentEngine.createSession 中 sessionPrompts/sessionProviders/sessionMetadata 写入 Session 实体而非独立 Map |
| **验收标准** | 1. 创建 session 后 store.list() 可查询到<br>2. 模拟重启（新建 SessionManager + 同一 store）可恢复全部 session<br>3. 现有 250+ session 管理测试通过 |
| **风险评估** | 中，需确保 store 写入失败时的降级策略 |

---

#### T3：统一 cleanupSession() 方法

| 字段 | 内容 |
|------|------|
| **任务编号** | T3 |
| **对应优化** | #1d |
| **任务目标** | 提供统一的 per-session 状态清理入口，destroy 时所有状态确定性地清理 |
| **执行人** | developer-1 |
| **依赖关系** | T2（write-through 完成后，清理路径明确） |
| **具体工作** | 1. AgentEngine 新增 cleanupSession(sessionId) 私有方法<br>2. 清理：queryEngines.delete + sessionMessages.delete + sessionPrompts.delete + sessionProviders.delete + sessionContexts.delete + activeAbortControllers.delete + activeQueries.delete<br>3. destroySession 和 pauseSession 统一调用 cleanupSession<br>4. 清理顺序：先 activeAbortControllers（取消查询），再 queryEngines，最后其余 |
| **验收标准** | 1. destroySession 后所有 per-session Map 不再持有该 sessionId<br>2. 即使 query 执行中 destroy 也不泄漏（AbortController 取消 + finally 块）<br>3. 新增 cleanupSession 单元测试 |
| **风险评估** | 低，纯重构不改变行为 |

---

#### T4：IConfigProvider 接口 + NoOp 实现

| 字段 | 内容 |
|------|------|
| **任务编号** | T4 |
| **对应优化** | #2a |
| **任务目标** | 定义统一配置接口，提供零开销默认实现 |
| **执行人** | developer-2 |
| **依赖关系** | 无 |
| **具体工作** | 1. 在 engine/config/ 目录新建 IConfigProvider.ts<br>2. 接口方法：get(key), getRequired(key), getWithDefault(key, default), getSource(key), getAll() → 返回优先级链<br>3. 优先级枚举：CODE > ENV > FILE > DEFAULT<br>4. NoOpConfigProvider：所有 get 返回 undefined，零开销<br>5. 在 engine/config/index.ts 导出 |
| **验收标准** | 1. IConfigProvider 接口定义完成<br>2. NoOpConfigProvider 所有方法零开销（无 IO）<br>3. tsc 零错误 |
| **风险评估** | 低，纯新增接口 |

---

#### T5：UnifiedConfig 构建 + Bridge 重构

| 字段 | 内容 |
|------|------|
| **任务编号** | T5 |
| **对应优化** | #2b |
| **任务目标** | 消除 buildQueryEngineConfig 中的 `as any`，配置转换类型安全 |
| **执行人** | developer-2 |
| **依赖关系** | T4（IConfigProvider 接口） |
| **具体工作** | 1. 新建 UnifiedConfig 类型，合并 AgentEngineConfig 和 EngineConfig 的字段<br>2. normalizeConfig(AgentEngineConfig, SettingsJson?) → UnifiedConfig，集中处理优先级<br>3. buildQueryEngineConfig 改为从 UnifiedConfig 转换，消除 as any<br>4. EngineConfig 正式标记 @deprecated V19，运行时打印 warning |
| **验收标准** | 1. buildQueryEngineConfig 无 `as any`（当前有 3 处）<br>2. tsc 零错误<br>3. AgentEngine.create() 行为等价 |
| **风险评估** | 低-中，改动集中在 Bridge 层，需确保类型兼容 |

---

#### T6：配置覆盖规则诊断日志

| 字段 | 内容 |
|------|------|
| **任务编号** | T6 |
| **对应优化** | #2c |
| **任务目标** | 配置决策链可追踪，SDK 用户可诊断配置冲突 |
| **执行人** | developer-2 |
| **依赖关系** | T5（UnifiedConfig 构建完成） |
| **具体工作** | 1. normalizeConfig 中每个字段决策点添加 LogUtil.debug 日志<br>2. 日志格式：`config resolved: model = claude-3.5-sonnet (source: agentConfig, overrides: envModel=none, settingsModel=none)`<br>3. AgentEngine.create() 完成时打印配置摘要（info 级别） |
| **验收标准** | 1. 设置 LogUtil 为 debug 级别可看到每个配置字段的决策来源<br>2. info 级别可看到配置摘要<br>3. 新增配置诊断测试 |
| **风险评估** | 低，纯增量日志 |

---

#### T7：ITracingProvider + IMetricsProvider 接口 + 默认实现

| 字段 | 内容 |
|------|------|
| **任务编号** | T7 |
| **对应优化** | #4a + #4b |
| **任务目标** | 定义可观测性 Provider 接口，提供零开销/测试用默认实现 |
| **执行人** | developer-3 |
| **依赖关系** | 无 |
| **具体工作** | 1. 新建 engine/observability/ 目录<br>2. ITracingProvider：startSpan(name, opts) → Span、Span.end()、Span.addEvent()、Span.setStatus()<br>3. IMetricsProvider：counter(name).increment()、gauge(name).set()、histogram(name).record()、timer(name).start() → Timer<br>4. NoOpTracingProvider：所有方法空实现，V8 内联优化后零开销<br>5. InMemoryMetricsProvider：存储在 Map 中，提供 getMetrics() 用于测试断言<br>6. 参考 utils/telemetry/sessionTracing.ts 的 span 生命周期设计 |
| **验收标准** | 1. 接口定义完成，与 LogProvider 设计风格一致<br>2. NoOpTracingProvider 基准测试：100 万次 startSpan < 10ms<br>3. InMemoryMetricsProvider 测试：increment/set/record/timer 验证通过 |
| **风险评估** | 低，纯新增接口 |

---

#### T8：AgentEngine 关键路径打点

| 字段 | 内容 |
|------|------|
| **任务编号** | T8 |
| **对应优化** | #4c + #4d |
| **任务目标** | 在 AgentEngine 关键路径插入 Tracing/Metrics 埋点 |
| **执行人** | developer-3 |
| **依赖关系** | T7（接口定义完成） |
| **具体工作** | 1. AgentEngineConfig 增加 tracingProvider/metricsProvider 可选字段<br>2. AgentEngine.create() 注入 Provider，默认 NoOp<br>3. 打点位置：<br>   - createSession/destroySession：span("session.create"/"session.destroy") + counter("session.active")<br>   - query()：span("query", {sessionId}) + timer("query.duration") + histogram("query.tokens")<br>   - 工具执行：通过 EventBus Hook 自动创建 span("tool.{name}")<br>4. MDC 自动携带 sessionId 到 tracing span |
| **验收标准** | 1. 使用 InMemoryMetricsProvider 可读取 session/query/tool 的指标<br>2. NoOpProvider 下 query 延迟不增加（基准对比）<br>3. 现有测试全部通过 |
| **风险评估** | 低，增量埋点不改变业务逻辑 |

---

#### T9：engine/types/ 屏障文件补齐

| 字段 | 内容 |
|------|------|
| **任务编号** | T9 |
| **对应优化** | #6a |
| **任务目标** | 补齐 engine/types/ 类型屏障，消除 22 条 type import 穿透 |
| **执行人** | developer-3（T8 完成后）或 developer-2（T6 完成后） |
| **依赖关系** | 无硬依赖（可随时启动，建议 T6 或 T8 后启动以避免合并冲突） |
| **具体工作** | 1. 新建 6 个屏障文件：<br>   - engine/types/tool.ts ← re-export from src/Tool.ts<br>   - engine/types/fileHistory.ts ← re-export from src/utils/fileHistory.ts<br>   - engine/types/attribution.ts ← re-export from src/utils/commitAttribution.ts<br>   - engine/types/model.ts ← re-export from src/utils/model/model.ts<br>   - engine/types/mcp.ts ← re-export from src/services/mcp/types.ts<br>   - engine/types/sessionHooks.ts ← re-export from src/utils/hooks/sessionHooks.ts<br>2. 更新 engine/types/index.ts 统一导出<br>3. 替换 engine/ 内部文件的穿透 import 为 engine/types/ 路径 |
| **验收标准** | 1. 6 个屏障文件创建完成<br>2. engine/ 内 type import 穿透从 88 条减少到 ~66 条<br>3. tsc 零错误 |
| **风险评估** | 极低，机械性 re-export + import 路径替换 |

---

### Phase 2：核心重构

#### T10：全局单例迁移到 AgentEngine 实例

| 字段 | 内容 |
|------|------|
| **任务编号** | T10 |
| **对应优化** | #3 |
| **任务目标** | 消除 4 个全局/模块级单例，使多 AgentEngine 实例状态互不污染 |
| **执行人** | developer-1 |
| **依赖关系** | T3（cleanupSession 完成后，Session 管理路径清晰） |
| **具体工作** | 1. tokenBudgetStates 全局 Map → AgentEngine.tokenBudgetStates 实例属性<br>2. SessionContextStorage 的全局 AsyncLocalStorage → AgentEngine.sessionContextStorage 实例<br>3. getGlobalCCRuntime() → 新增 createCCRuntime() 实例级方法，保留 getGlobalCCRuntime() 作为 fallback<br>4. getGlobalProviderRegistry() → 新增 createProviderRegistry() 实例级方法<br>5. AgentEngine 构造时创建独立的 CCRuntime + ProviderRegistry + TokenBudgetManager |
| **验收标准** | 1. 两个 AgentEngine 实例的 tokenBudget 独立（测试验证）<br>2. Session 上下文按引擎隔离<br>3. 现有 800+ engine 测试全部通过<br>4. 全局单例 fallback 不影响单实例使用 |
| **风险评估** | 中，CC 内部某些模块可能直接引用全局 bootstrap/state.ts，需通过 CCRuntime 间接访问 |

---

#### T11：value import 改依赖注入

| 字段 | 内容 |
|------|------|
| **任务编号** | T11 |
| **对应优化** | #6b + #6c |
| **任务目标** | 消除 30 条 value import 穿透，改为依赖注入或参数传入 |
| **执行人** | developer-2 |
| **依赖关系** | T5（配置归一化完成）+ T9（类型屏障完成） |
| **具体工作** | 1. getEmptyToolPermissionContext → CoreAppStateFactory 参数注入<br>2. createEmptyAttributionState → CoreAppStateFactory 参数注入<br>3. getTools → initializeEngine 的 config.toolRegistry 注入<br>4. getDefaultMainLoopModel → config.defaultModelProvider 注入<br>5. getSettingsWithErrors → IConfigProvider 替代<br>6. createAppStateStore → initializeEngine 参数注入<br>7. initializeEngine.ts 的 12 条动态 import 改为通过 config 注入 |
| **验收标准** | 1. EngineState.ts 穿透从 10 条降到 0<br>2. engine/ value import 穿透总计 < 10 条<br>3. tsc 零错误，所有测试通过 |
| **风险评估** | 低-中，机械性改动但需确保注入点正确 |

---

#### T12：死代码清理

| 字段 | 内容 |
|------|------|
| **任务编号** | T12 |
| **对应优化** | #7 |
| **任务目标** | 清理/标记零调用代码，减少维护负担 |
| **执行人** | developer-3 |
| **依赖关系** | T8（可观测性完成后，避免并行改动同区域代码） |
| **具体工作** | 1. CircuitBreaker.ts：添加 @planned 注释 + DESIGN.md 说明接入计划（V19 随 Provider 接入）<br>2. LLMRuntime.ts：同上，V19 合并到 ProviderAdapter<br>3. ToolAdapter.ts：添加文档注释说明保留理由（外部用户可能引用）<br>4. ToolRegistry 动态注册：添加 @planned 注释 + 启用计划<br>5. BaseProvider.executeWithRetry/classifyError：添加 @planned 注释 |
| **验收标准** | 1. 所有零调用公共 API 有 @planned 或 @internal 文档注释<br>2. 无代码删除（全部标记保留）<br>3. tsc 零错误 |
| **风险评估** | 极低，纯注释和文档 |

---

### Phase 3：存储补齐

#### T13：IMemoryStore 接口 + InMemory 实现

| 字段 | 内容 |
|------|------|
| **任务编号** | T13 |
| **对应优化** | #8a + #8c |
| **任务目标** | 定义按用户隔离的记忆存储接口，提供内存默认实现 |
| **执行人** | developer-1 |
| **依赖关系** | T10（全局单例迁移后，存储层独立于全局状态） |
| **具体工作** | 1. 在 engine/storage/ 新建 IMemoryStore.ts<br>2. 接口方法：save(userId, key, value)、load(userId, key)、delete(userId, key)、list(userId, prefix?)、dispose()<br>3. InMemoryMemoryStore：基于 Map<userId, Map<key, value>>，支持 prefix 过滤<br>4. 单元测试 |
| **验收标准** | 1. IMemoryStore 接口定义完成<br>2. InMemoryMemoryStore CRUD 测试通过<br>3. 不同 userId 的数据完全隔离 |
| **风险评估** | 低，纯新增 |

---

#### T14：ISessionContentStore 接口 + InMemory 实现

| 字段 | 内容 |
|------|------|
| **任务编号** | T14 |
| **对应优化** | #8b + #8c + #8d |
| **任务目标** | 定义按 session 的追加写入存储接口，与 CompositeBackend 集成 |
| **执行人** | developer-1 |
| **依赖关系** | T13（存储接口设计模式一致） |
| **具体工作** | 1. 在 engine/storage/ 新建 ISessionContentStore.ts<br>2. 接口方法：append(sessionId, content)、read(sessionId, opts?)、truncate(sessionId, keepLastN)、dispose()<br>3. InMemorySessionContentStore：基于 Map<sessionId, content[]>，append 追加<br>4. 与 CompositeBackend 集成测试：按 "content:" 前缀路由到 SessionContentStore |
| **验收标准** | 1. ISessionContentStore 接口定义完成<br>2. append 多次后 read 返回完整内容<br>3. CompositeBackend 路由验证通过 |
| **风险评估** | 低，纯新增 |

---

#### T15：Session 暂停恢复上下文修复

| 字段 | 内容 |
|------|------|
| **任务编号** | T15 |
| **对应优化** | #9 |
| **任务目标** | 修复 pauseSession 后恢复时对话上下文丢失的问题 |
| **执行人** | developer-1 |
| **依赖关系** | T14（ISessionContentStore 用于保存消息历史） |
| **具体工作** | 1. pauseSession 时：从 QueryEngine 获取当前消息历史，调用 ISessionContentStore.append 保存<br>2. resumeSession/query 首次调用时：从 ISessionContentStore.read 获取历史消息，作为 initialMessages 传入新建 QueryEngine<br>3. pauseSession 不再删除 sessionMessages Map，改由 ISessionContentStore 管理<br>4. 新增 pause/resume 生命周期测试 |
| **验收标准** | 1. 创建 session → query 3 轮 → pauseSession → resumeSession → query 1 轮，上下文连续<br>2. 历史消息完整（3 轮 + 新 1 轮）<br>3. 新增 pause/resume 测试通过 |
| **风险评估** | 低，修改 pauseSession/resumeSession 路径，不影响正常 query 流程 |

---

## 五、任务总览

| 编号 | 任务名称 | 执行人 | 依赖 | 阶段 | 对应优化 |
|------|---------|--------|------|------|---------|
| T1 | Session 实体扩展 + Metadata 统一 | dev-1 | — | P1 | #1b + #10 |
| T2 | SessionManager write-through 重构 | dev-1 | T1 | P1 | #1a |
| T3 | 统一 cleanupSession() 方法 | dev-1 | T2 | P1 | #1d |
| T4 | IConfigProvider 接口 + NoOp 实现 | dev-2 | — | P1 | #2a |
| T5 | UnifiedConfig 构建 + Bridge 重构 | dev-2 | T4 | P1 | #2b |
| T6 | 配置覆盖规则诊断日志 | dev-2 | T5 | P1 | #2c |
| T7 | ITracing/IMetrics 接口 + 默认实现 | dev-3 | — | P1 | #4a + #4b |
| T8 | AgentEngine 关键路径打点 | dev-3 | T7 | P1 | #4c + #4d |
| T9 | engine/types/ 屏障文件补齐 | dev-2 | T6 | P1 | #6a |
| T10 | 全局单例迁移到 AgentEngine 实例 | dev-1 | T3 | P2 | #3 |
| T11 | value import 改依赖注入 | dev-2 | T5, T9 | P2 | #6b + #6c |
| T12 | 死代码清理 | dev-3 | T8 | P2 | #7 |
| T13 | IMemoryStore 接口 + InMemory 实现 | dev-1 | T10 | P3 | #8a + #8c |
| T14 | ISessionContentStore 接口 + InMemory 实现 | dev-1 | T13 | P3 | #8b + #8c + #8d |
| T15 | Session 暂停恢复上下文修复 | dev-1 | T14 | P3 | #9 |

### 依赖关系图

```
Phase 1（并行）:
  dev-1: T1 → T2 → T3
  dev-2: T4 → T5 → T6 → T9
  dev-3: T7 → T8 → T12

Phase 2（依赖 P1）:
  dev-1: T10 ← T3
  dev-2: T11 ← T5 + T9

Phase 3（依赖 P2）:
  dev-1: T13 → T14 → T15 ← T10
```

### 每位开发者工作量

| 开发者 | 任务数 | 阶段覆盖 | 优化点覆盖 |
|--------|--------|---------|-----------|
| developer-1 | 8（T1-T3, T10, T13-T15） | P1 + P2 + P3 | #1, #3, #8, #9, #10 |
| developer-2 | 5（T4-T6, T9, T11） | P1 + P2 | #2, #6 |
| developer-3 | 3（T7-T8, T12） | P1 + P2 | #4, #7 |

---

## 六、V19 预告（不纳入 V18）

| 优化点 | 描述 | 延后原因 |
|--------|------|---------|
| #5 Provider 运行时接入 | AgentEngine 走 ProviderAdapter → CircuitBreaker → executeWithRetry | 高风险，涉及核心 LLM 调用路径变更 |
| #7 完整死代码清理 | CircuitBreaker 启用、LLMRuntime 合并、ToolRegistry 动态注册启用 | 依赖 #5 完成 |

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| T10 全局单例迁移影响 CC 内部 | CC 模块直接引用 bootstrap/state.ts 可能失效 | 保留全局 fallback，新代码用实例级，渐进迁移 |
| T5 Bridge 重构引入类型不兼容 | buildQueryEngineConfig 行为变化 | TDD 先写测试，确保等价 |
| T10-T15 developer-1 任务链长 | 如果 T1-T3 延期，后续全部延期 | T10 后可由 developer-2/3 支援 |
| Phase 1 三人并行合并冲突 | 同区域文件可能冲突 | architect 审核合并，分分支开发 |
