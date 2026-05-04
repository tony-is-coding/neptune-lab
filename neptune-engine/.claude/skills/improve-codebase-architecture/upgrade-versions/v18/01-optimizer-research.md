# V18 框架深度优化研究报告

> 版本：V18
> 日期：2026-04-28
> 范围：基于 OKR V6 路线图，对 Agent Engine SDK 进行系统性深度分析
> 方法：5 维度并行深度探索（状态管理 / 配置系统 / 穿透依赖 / 存储与可观测性 / Provider 与工具注册）
> 参考文档：`docs/okr-roadmap.md`、`claude-code/ARCHITECTURE.md`、`docs/architecture-design.md`

---

## 一、框架现状分析

### 1.1 已完成能力（V1-V5）

V1-V5 已完成 SDK 核心构建和交付验收，以下能力经代码分析确认成熟：

| 能力 | 位置 | 评价 |
|------|------|------|
| Session 管理 | engine/SessionManager + EngineFacade | 成熟，支持 CRUD + GC + 恢复 |
| EventBus 事件系统 | engine/events/ | 成熟，推+拉双路、Session 级过滤、Hook 拦截 |
| 日志系统 | engine/log/（13 文件） | 成熟，策略模式、MDC 上下文、JSON 输出、文件持久化 |
| Provider 适配器 | engine/provider/adapters/（7 个） | 接口完成，7 个 Provider 已实现 |
| 存储层 | engine/storage/（7 文件） | ISessionStore + IBackend + 5 种实现 |
| HookCore | engine/hooks/ | 成熟，零 UI 依赖 |
| SkillLoader | engine/skill/ | 成熟 |
| ToolAdapter | engine/tools/ | 已实现但未使用 |
| 权限委托 | engine/permissions/ | 接口清晰，ReadOnlyDelegate 可用 |
| EngineState | engine/EngineState.ts | 零 React 核心状态 |

### 1.2 新发现的结构性问题

通过本次 5 维度深度探索，发现以下 V6 OKR 路线图未充分覆盖的问题：

#### 问题 A：18 个 Map/Set 散布在 engine/ 目录

OKR V6 KR3 提到"7 个 Map"，实际探索发现 engine/ 下共有 **18 个 Map/Set** 实例：

| 模块 | Map/Set 数量 | 关键问题 |
|------|-------------|---------|
| AgentEngine.ts | 7 | per-session 状态，生命周期与 Session 绑定 |
| SessionManager.ts | 1 | Session 注册表，有 ISessionStore 但仅作备份 |
| EngineFacade.ts | 1 | sessionMetadata，与 Session._metadata 双重存储 |
| EngineState.ts | 4 | 内嵌 Map/Set 字段（agentNameRegistry、sessionHooks 等） |
| EventBus.ts | 2+1 | listeners/hooks/ttlTimers |
| TokenBudgetManager.ts | 2 | **实例 Map + 全局 Map 并存**，AgentEngine 使用全局版本 |
| cc-runtime/ | 2 | workspaceInitialized Set + 文件缓存 Map |
| storage/ | 2 | InMemory 内部 Map |

#### 问题 B：三套配置系统存在 5 个具体冲突点

| 冲突 | 影响范围 | 严重度 |
|------|---------|--------|
| 模型配置三方竞争（AgentEngineConfig.model vs EngineConfig.model vs SettingsJson.model） | SDK 用户指定的模型可能被 CC 内部逻辑覆盖 | 高 |
| 权限配置分裂（PermissionDelegate vs permissionMode vs SettingsJson.permissions） | delegate 的 'ask' 分支回退到 CC 原始规则 | 高 |
| 工具黑名单交叉影响（SDK 注册工具可能被 EngineConfig 黑名单过滤） | SDK 自定义工具被意外禁用 | 中 |
| systemPrompt 三重覆盖（engine 级 / session 级 / CC 自动加载 CLAUDE.md） | 用户设置的 systemPrompt 与 CC 自动内容混合 | 中 |
| Feature Flag 双轨系统（bun:bundle feature() vs FeatureOverride） | settings.json 无法控制 engine 层 feature flag | 低 |

#### 问题 C：Provider 层是"接口壳"，运行时未真正使用

七个 Provider 适配器已实现，但 AgentEngine 的实际调用链是：

```
AgentEngine.query() → buildQueryEngineConfig() → CCRuntime.createQueryEngine() → CC 内部 Provider 选择
```

ProviderAdapter.query() **从未被调用**。真正的 Provider 选择走 CC 的 `utils/model/providers.ts` + 环境变量机制。

#### 问题 D：大量已完成能力完全闲置

| 能力 | 代码量 | 调用次数 |
|------|--------|---------|
| CircuitBreaker 熔断器 | 200 行 | 0 |
| BaseProvider.executeWithRetry() | 重试+指数退避 | 0（子类直接 try/catch） |
| BaseProvider.classifyError() | 精细错误分类 | 0 |
| LLMRuntime 接口 | 强类型 LLM 抽象 | 0（无实现） |
| ToolAdapter 四个函数 | CoreTool/Tool 互转 | 0 |
| ToolRegistry 动态注册 | 注册+过滤+查找 | 0 |

#### 问题 E：全局单例阻碍多实例部署

以下全局/模块级单例会导致多个 AgentEngine 实例互相污染：

| 单例 | 位置 | 影响 |
|------|------|------|
| `tokenBudgetStates` | session/TokenBudgetManager.ts | 全局 Map，被 SessionContextStorage 直接引用 |
| `sessionContextStorage` | session/SessionContextStorage.ts | 全局 AsyncLocalStorage |
| `getGlobalCCRuntime()` | cc-runtime/DefaultCCRuntime.ts | 全局 CCRuntime 单例 |
| `getGlobalProviderRegistry()` | provider/ProviderRegistry.ts | 全局 Provider 注册表 |

---

## 二、框架目标对齐分析

将发现的问题与 `docs/project-purpose.md` 和 `claude-code/ARCHITECTURE.md` 中的目标对齐：

| 框架目标 | 当前状态 | 差距 | 对应优化点 |
|---------|---------|------|-----------|
| **可嵌入任意应用** | ✅ AgentEngine.create() 可用 | 配置来源混乱，嵌入时不知该用哪套 | #2 配置归一化 |
| **多 Session 并发 ≥10** | ✅ SessionManager 支持 | 全局单例导致多实例状态污染 | #3 全局单例冲突 |
| **零 UI 依赖** | ✅ engine/ 零 React | — | 已满足 |
| **独立发布** | ✅ tsc 通过、API 文档完备 | Provider 层未真正接入，运行时走 CC 旧路径 | #5 Provider 接入 |
| **多实例/分布式部署** | ❌ 所有状态进程内 | 18 个 Map 无法跨进程共享 | #1 状态外化 |
| **生产可观测** | ❌ 无 Tracing/Metrics | 日志完备但无链路追踪和指标采集 | #4 可观测性 |
| **水平扩展** | ❌ 全局单例冲突 | 多实例 tokenBudget/sessionContext 互相污染 | #3 全局单例冲突 |
| **SDK 包 < 2MB** | ⚠️ 55+ 工具静态全量加载 | 工具按需加载机制已定义但未启用 | #6 工具注册 |
| **架构边界清晰** | ⚠️ 88 处穿透依赖 | engine/types/ 屏障仅覆盖 5/12+ 类型域 | #7 穿透依赖 |
| **存储完整性** | ⚠️ IMemoryStore/ISessionContentStore 未定义 | 记忆无独立存储、会话内容无追加写入接口 | #8 存储补齐 |
| **数据一致性** | ⚠️ Metadata 双重存储 | Session._metadata 始终为 {}，真实数据在 EngineFacade Map | #9 Metadata 统一 |

---

## 三、优化清单（按优先级排序，TOP 10）

### 优先级定义

- **P0**：阻塞框架终极目标，不解决就无法进入下一阶段
- **P1**：高价值且可执行，应在本版本完成
- **P2**：有价值但可延后，不阻塞核心路径

| # | 优化点 | 优先级 | 对应 OKR KR |
|---|--------|--------|------------|
| 1 | AgentEngine 状态外化 | P0 | KR3 |
| 2 | 配置归一化 | P0 | KR2 |
| 3 | 全局单例多实例冲突解决 | P0 | KR3 扩展 |
| 4 | TracingProvider + MetricsProvider | P1 | KR1 |
| 5 | Provider 层运行时真正接入 | P1 | V5 遗留 |
| 6 | engine/ 穿透依赖清理 | P1 | KR5 |
| 7 | 死代码清理 | P1 | — |
| 8 | IMemoryStore + ISessionContentStore | P2 | KR4 |
| 9 | Session 暂停恢复上下文修复 | P2 | — |
| 10 | Metadata 双重存储统一 | P2 | — |

---

## 四、每个优化点的详细 OKR 描述

---

### 优化 #1：AgentEngine 状态外化

**优化重点**：将 AgentEngine 的 7 个 per-session Map 迁移到可插拔 StorageProvider，使 SDK 可无状态运行

**优化目标**：SDK 不持有跨 query 的进程内状态，支持多实例部署和状态恢复

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR1a | sessions Map → 通过 SessionManager 的 ISessionStore 为主存储（write-through 模式） | 进程重启后可通过 store.list() 恢复全部 session |
| KR1b | sessionMetadata/sessionPrompts/sessionProviders → 合并到 Session 实体的扩展字段 | Session.toSnapshot() 包含这三个字段 |
| KR1c | sessionMessages → 迁移到 ISessionContentStore（追加写入） | 消息不再存内存 Map |
| KR1d | activeAbortControllers/activeQueries → 保留进程内（不可外化），但提供统一 cleanupSession() | destroy 时所有状态确定性地清理 |

**预期收益**：
- SDK 可无状态运行，宿主选择存储引擎（InMemory/SQLite/PG/Redis）
- 多实例部署可行，进程重启可恢复
- 内存使用可控，不再有无界 Map

**对框架的影响**：
- 是否破坏"包装不替代"：否，只改 engine/ 包装层，CC 核心不变
- 正向影响：AgentEngine.query() 路径需要改为从 store 读取，但逻辑不变
- 负面影响：首次 query 增加一次 store 读取延迟（~1ms 级别）
- 实施风险：中等，需要仔细处理 SessionContext 的不可序列化字段

**符合框架目标**：终极目标 — "可嵌入、分布式、多实例"

**依赖关系**：无前置依赖（可最先启动）

---

### 优化 #2：配置归一化

**优化重点**：统一 AgentEngineConfig / EngineConfig / SettingsJson 三套配置来源，建立清晰的优先级链

**优化目标**：SDK 用户只需关心 AgentEngineConfig，内部配置冲突自动解决

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR2a | 定义 IConfigProvider 接口：统一配置读取，优先级：代码 > 环境变量 > 配置文件 > 默认值 | 接口定义完成，NoOpConfigProvider 实现 |
| KR2b | AgentEngine.create() 内部构建 UnifiedConfig，消除 buildQueryEngineConfig 中的 `as any` | tsc 零错误且无 `as any` |
| KR2c | 文档化 per-session 配置覆盖规则（systemPrompt/provider 的 session > engine > default 链） | 配置决策链有诊断日志可追踪 |

**预期收益**：
- SDK 用户不再困惑于 3 套 Config
- 配置冲突有明确的优先级规则，不再有隐式覆盖
- buildQueryEngineConfig 消除 `as any`，类型安全

**对框架的影响**：
- 是否破坏"包装不替代"：否，只改配置读取层
- 正向影响：配置逻辑集中化，易于理解和维护
- 负面影响：EngineConfig 需要正式标记 deprecated 并提供迁移路径
- 实施风险：低，改动集中在 Bridge 层

**符合框架目标**：技术目标 — "SDK 可独立发布，开发者可快速理解和使用"

**依赖关系**：无前置依赖（可与 #1 并行）

---

### 优化 #3：全局单例多实例冲突解决

**优化重点**：消除 engine/ 中的全局/模块级单例，使多个 AgentEngine 实例可安全共存

**优化目标**：支持同一进程内创建多个独立 AgentEngine 实例，状态互不污染

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR3a | tokenBudgetStates 全局 Map → 迁移到 AgentEngine 实例属性 | 两个 AgentEngine 实例的 token budget 独立 |
| KR3b | sessionContextStorage 全局 AsyncLocalStorage → 迁移到 AgentEngine 实例 | Session 上下文按引擎隔离 |
| KR3c | getGlobalCCRuntime() / getGlobalProviderRegistry() → 提供实例级创建方法 | 可创建独立的 CCRuntime/ProviderRegistry |

**预期收益**：
- 多实例部署可行（同一进程多个引擎）
- 测试隔离简化（不再需要全局 reset）
- 为多租户场景奠定基础

**对框架的影响**：
- 是否破坏"包装不替代"：否，只改 engine/ 状态管理
- 正向影响：CCRuntime 从全局单例改为实例级，更符合 SDK 设计
- 负面影响：CC 原始代码中有些模块直接使用全局 bootstrap/state.ts 单例，需要通过 CCRuntime 间接访问
- 实施风险：中等，需要验证 CC 内部对全局单例的依赖范围

**符合框架目标**：终极目标 — "多实例部署"

**依赖关系**：建议在 #1（状态外化）之后执行，因为实例属性设计依赖外化方案

---

### 优化 #4：TracingProvider + MetricsProvider

**优化重点**：为 engine/ 层添加链路追踪和指标采集能力，采用 Provider 模式（框架定义埋点，用户决定导出到哪）

**优化目标**：SDK 具备生产级可观测性，可与 OTLP/Prometheus/Console 等后端对接

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR4a | 定义 ITracingProvider 接口：startSpan/endSpan/addEvent/setStatus | NoOpTracingProvider 零开销默认实现 |
| KR4b | 定义 IMetricsProvider 接口：counter/gauge/histogram/timer | InMemoryMetricsProvider 用于测试验证 |
| KR4c | 在 AgentEngine.query() 关键路径打点：session 创建/销毁、query 开始/结束、LLM 调用、工具执行 | 每个关键节点都有 span/metrics 记录 |
| KR4d | 利用 EventBus Hook 机制，在事件分发时自动创建 span | 无侵入式追踪，不需要改业务代码 |

**预期收益**：
- 生产问题可追踪（query 生命周期、LLM 延迟、工具耗时）
- Token 使用量和费用可实时监控
- 与 OTel 生态对接，宿主已有的 Prometheus/OTLP 可直接消费

**对框架的影响**：
- 是否破坏"包装不替代"：否，纯增量能力
- 正向影响：Provider 模式与现有 LogProvider/LogStore 设计一致
- 负面影响：query 热路径增加 1-2 次函数调用（NoOp 下几乎零开销）
- 实施风险：低，可参照 `utils/telemetry/sessionTracing.ts` 的成熟实现

**符合框架目标**：技术目标 — "生产可用"；架构纲领 A6 — "Provider 模式"

**依赖关系**：无前置依赖（可与 #1/#2 并行）

---

### 优化 #5：Provider 层运行时真正接入

**优化重点**：让 AgentEngine 的 Provider 选择真正走 ProviderAdapter 接口，而非绕过它直接走 CC 内部路径

**优化目标**：ProviderAdapter 从"接口壳"变为"运行时主路径"，CircuitBreaker/BaseProvider 重试逻辑真正生效

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR5a | AgentEngine.query() 中 Provider 调用链改为：选择 ProviderAdapter → CircuitBreaker 包装 → executeWithRetry → 实际 API 调用 | CircuitBreaker 在连续失败时触发熔断 |
| KR5b | BaseProvider.executeWithRetry() 被所有子类使用，指数退避生效 | 模拟 429 错误时自动重试 |
| KR5c | BaseProvider.classifyError() 的错误分类传递到 EngineError | 上层可区分 AUTH_ERROR/RATE_LIMIT/NETWORK_ERROR |
| KR5d | LLMRuntime 接口与 ProviderAdapter 统一（消除两套并行抽象） | 只有一套 Provider 接口 |

**预期收益**：
- Provider 切换真正可控（配置切换即可换后端）
- 熔断器生效，连续失败不再持续重试
- 重试逻辑统一（指数退避 + 可重试错误分类）
- 两套 Provider 抽象合并为一套，减少混乱

**对框架的影响**：
- 是否破坏"包装不替代"：⚠️ 需谨慎，改变 LLM 调用路径
- 正向影响：Provider 层从壳变为真实能力
- 负面影响：LLM 调用路径变更，需要全面回归测试
- 实施风险：**高**，涉及核心 query 路径变更，必须保证与现有行为等价

**符合框架目标**：技术目标 — "SDK 暴露 Claude Code 的全部核心能力"

**依赖关系**：建议在 #2（配置归一化）之后执行，因为 Provider 选择逻辑依赖统一配置

---

### 优化 #6：engine/ 穿透依赖清理

**优化重点**：将 engine/ 目录 88 处穿透依赖降到 10 以下，补齐 engine/types/ 类型屏障

**优化目标**：engine/ 的 import 边界清晰，不直接依赖 src/ 根文件

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR6a | 新建 engine/types/ 屏障文件：tool.ts、fileHistory.ts、attribution.ts、model.ts、mcp.ts、sessionHooks.ts | 22 条 type import 穿透消除 |
| KR6b | value import 改为依赖注入：getEmptyToolPermissionContext、createEmptyAttributionState、getTools、getDefaultMainLoopModel | 18 条 value import 穿透消除 |
| KR6c | initializeEngine.ts 的 12 条动态 import 改为通过 config 注入 | bootstrap 层无直接 import src/ |
| KR6d | EngineState.ts 穿透从 10 条降到 0 | "零依赖"声明与实际一致 |

**预期收益**：
- engine/ 可独立编译和测试（不依赖 src/ 根文件）
- 新开发者容易理解 engine/ 边界
- 为未来 engine/ 独立 npm 包奠定基础

**对框架的影响**：
- 是否破坏"包装不替代"：否，只改 import 路径
- 正向影响：架构边界清晰
- 负面影响：增加 engine/types/ 维护成本（re-export 需同步更新）
- 实施风险：低，机械性改动

**符合框架目标**：技术目标 — "物理分离"；架构原则 F2 — "单向分层依赖"

**依赖关系**：可与 #1/#2 并行

---

### 优化 #7：死代码清理

**优化重点**：清理已实现但完全无调用的代码，减少维护负担和包大小

**优化目标**：消除零调用的"接口壳"代码，或将其标记为 planned 并文档化

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR7a | CircuitBreaker：接入 Provider 层（#5）或标记 @planned | 有调用者或有明确规划文档 |
| KR7b | ToolAdapter：文档化使用场景或删除 | 有消费者或有文档说明保留理由 |
| KR7c | ToolRegistry 动态注册：启用或标记 @planned | getTools() 不再硬编码数组 |
| KR7d | LLMRuntime：与 ProviderAdapter 合并（#5 的一部分）或删除 | 只有一套 Provider 抽象 |

**预期收益**：
- 减少代码维护负担（当前有 ~500 行零调用代码）
- 新开发者不会困惑于"两套 Provider 抽象"
- 包大小微减

**对框架的影响**：
- 是否破坏"包装不替代"：否
- 正向影响：代码更清晰
- 负面影响：如果删除过多，后续需要重新实现
- 实施风险：极低

**符合框架目标**：技术目标 — "轻量化框架"

**依赖关系**：#5（Provider 接入）决定 CircuitBreaker/LLMRuntime 的去留

---

### 优化 #8：IMemoryStore + ISessionContentStore

**优化重点**：补齐存储层缺失的两个接口，实现记忆按用户隔离、会话内容追加写入

**优化目标**：SDK 具备完整的存储抽象，覆盖所有核心数据实体

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR8a | 定义 IMemoryStore 接口：按 userId 隔离、CRUD + 前缀查询 + 可选 TTL | 接口定义完成 |
| KR8b | 定义 ISessionContentStore 接口：按 sessionId 追加写入 + 读取 + 截断 | 接口定义完成 |
| KR8c | InMemoryMemoryStore + InMemorySessionContentStore 默认实现 | 单元测试通过 |
| KR8d | 与 CompositeBackend 集成：按 key 前缀路由到不同后端 | 路由配置验证通过 |

**预期收益**：
- 记忆存储不再依赖文件系统 MEMORY.md，可存入数据库
- 会话内容可存入专用存储（而非内存 Map）
- 为多租户场景（按用户隔离记忆）奠定基础

**对框架的影响**：
- 是否破坏"包装不替代"：否，纯增量
- 正向影响：存储实体与驱动分离的完整实现
- 负面影响：需要修改 memdir/ 模块使用新接口（可选，渐进式）
- 实施风险：低

**符合框架目标**：架构纲领 G3/G4 — "会话是一等公民"、"实体与驱动分离"

**依赖关系**：建议在 #1（状态外化）之后执行，可复用 StorageProvider 基础设施

---

### 优化 #9：Session 暂停恢复上下文修复

**优化重点**：修复 pauseSession 后恢复时对话上下文丢失的问题

**优化目标**：Session 暂停/恢复不丢失任何对话上下文

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR9a | pauseSession 时保存 queryEngine 的消息历史到 store | 恢复后历史消息完整 |
| KR9b | resumeSession 时从 store 读取历史消息，作为 initialMessages 传入新建的 QueryEngine | 多轮对话上下文连续 |
| KR9c | 新增 pause/resume 生命周期测试 | 测试验证上下文不丢失 |

**预期收益**：
- Session 暂停/恢复功能真正可用
- 长时间运行场景（CI/CD、后台任务）受益

**对框架的影响**：
- 是否破坏"包装不替代"：否
- 正向影响：Session 生命周期更完整
- 负面影响：pauseSession 增加一次 store 写入
- 实施风险：低

**符合框架目标**：技术目标 — "支持暂停/恢复/重启能力"

**依赖关系**：#8（ISessionContentStore）完成后再做，利用追加写入存储

---

### 优化 #10：Metadata 双重存储统一

**优化重点**：消除 EngineFacade.sessionMetadata Map 与 Session._metadata 的双重存储

**优化目标**：Session 元数据只有一个权威来源

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR10a | 废弃 EngineFacade.sessionMetadata Map，将真实数据迁移到 Session._metadata | EngineFacade 不再有自己的 metadata Map |
| KR10b | Session.toSnapshot() 包含完整 metadata | 序列化后可恢复完整元数据 |
| KR10c | setMemoryPath 等修改 metadata 的操作直接修改 Session 实例 | 所有 metadata 修改路径统一 |

**预期收益**：
- 消除数据一致性风险
- Session 序列化包含完整信息
- 代码更简洁

**对框架的影响**：
- 是否破坏"包装不替代"：否
- 正向影响：数据模型统一
- 负面影响：EngineFacade API 轻微调整
- 实施风险：极低

**符合框架目标**：架构纲领 A5 — "状态外化"的前置清理

**依赖关系**：#1（状态外化）的一部分，可同步执行

---

## 五、优化点依赖关系

```
#1 状态外化 (P0) ←── #8 IMemoryStore (P2)
     │                      │
     ├── #3 全局单例 (P0)    └── #9 Session 暂停恢复 (P2)
     │
     ├── #10 Metadata 统一 (P2)
     │
#2 配置归一化 (P0) ←── #5 Provider 接入 (P1)
     │                      │
     │                      └── #7 死代码清理 (P1)
     │
#4 Tracing/Metrics (P1) ←── 独立，可与 #1/#2 并行
     │
#6 穿透依赖清理 (P1) ←── 独立，可与 #1/#2 并行
```

**建议执行顺序**：

| 波次 | 优化点 | 理由 |
|------|--------|------|
| 第一波（并行） | #1 状态外化 + #2 配置归一化 + #4 Tracing/Metrics + #6 穿透依赖 | 互不依赖，可并行推进 |
| 第二波 | #3 全局单例 + #10 Metadata 统一 | 依赖 #1 的外化方案确定 |
| 第三波 | #5 Provider 接入 + #7 死代码清理 | 依赖 #2 的配置归一化 |
| 第四波 | #8 IMemoryStore + #9 Session 暂停恢复 | 依赖 #1 的存储基础设施 |

---

## 六、后续行动建议

### 6.1 与 OKR V6 的映射

| OKR V6 KR | 本报告覆盖 | 额外发现 |
|-----------|-----------|---------|
| KR1 TracingProvider + MetricsProvider | 优化 #4 | — |
| KR2 IConfigProvider | 优化 #2 | 发现 5 个具体冲突点 |
| KR3 AgentEngine Map → StorageProvider | 优化 #1 + #10 | 实际有 18 个 Map（非 7 个），部分不可外化 |
| KR4 IMemoryStore + ISessionContentStore | 优化 #8 | — |
| KR5 engine/ 穿透依赖 < 10 | 优化 #6 | 实际 88 条穿透（非 25+），52 条可消除 |
| — | 优化 #3 全局单例 | **OKR 未覆盖**，但阻塞多实例部署 |
| — | 优化 #5 Provider 接入 | **OKR 未覆盖**，但 Provider 层当前是空壳 |
| — | 优化 #7 死代码清理 | **OKR 未覆盖**，500+ 行零调用代码 |
| — | 优化 #9 Session 暂停恢复 | **OKR 未覆盖**，功能缺陷 |

### 6.2 建议更新 OKR V6

基于本次分析，建议 OKR V6 增加以下 KR：

| 新 KR | 描述 | 优先级 |
|-------|------|--------|
| KR6 | 全局单例多实例冲突解决 | P0 |
| KR7 | Provider 层运行时真正接入 | P1 |
| KR8 | 死代码清理（CircuitBreaker/ToolAdapter/ToolRegistry/LLMRuntime） | P1 |

### 6.3 风险提示

1. **#5 Provider 接入风险最高**：涉及核心 LLM 调用路径变更，必须保证行为等价
2. **#3 全局单例改造影响面广**：需要验证 CC 内部对 bootstrap/state.ts 的所有引用点
3. **#1 状态外化的不可外化部分**：activeAbortControllers/activeQueries 必须保留进程内，设计时需明确

---

## 七、关键文件索引

### 状态管理核心
- `engine/AgentEngine.ts` — 7 个 per-session Map 的定义和使用
- `engine/EngineFacade.ts` — sessionMetadata Map（双重存储问题）
- `engine/SessionManager.ts` — sessions 注册表 Map
- `engine/EngineState.ts` — 核心运行时状态（声明零依赖但实际穿透 10 条）
- `engine/session/TokenBudgetManager.ts` — 实例 Map + 全局 Map（双重问题）

### 配置系统核心
- `engine/AgentEngine.ts` — AgentEngineConfig 定义
- `engine/bootstrap/initializeEngine.ts` — EngineConfig 定义（deprecated）
- `engine/bridge/OriginalQueryEngineBridge.ts` — 配置转换层（含 `as any`）
- `utils/settings/types.ts` — SettingsJson Zod schema（1000+ 行）

### Provider 层核心
- `engine/provider/ProviderAdapter.ts` — ProviderAdapter 接口
- `engine/provider/ProviderRegistry.ts` — 注册表 + 全局单例
- `engine/provider/CircuitBreaker.ts` — 熔断器（零调用）
- `engine/provider/adapters/BaseProvider.ts` — 抽象基类

### 存储层核心
- `engine/storage/ISessionStore.ts` — Session 存储接口
- `engine/storage/IBackend.ts` — 通用后端接口
- `engine/storage/CompositeBackend.ts` — 组合路由后端

### 可观测性核心
- `engine/log/LogUtil.ts` — 全局日志单例
- `engine/log/MDC.ts` — 异步上下文传播
- `engine/events/EventBus.ts` — 事件系统
