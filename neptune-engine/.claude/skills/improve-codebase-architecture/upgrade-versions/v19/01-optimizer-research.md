# V19 框架深度优化研究报告

> 版本：V19
> 日期：2026-04-28
> 范围：基于 OKR V7+ 路线图 + V18 遗留问题，对 Agent Engine SDK 进行系统性深度分析
> 方法：4 维度并行深度探索（Provider 运行时路径 / 穿透依赖审计 / 死代码+Bridge 类型 / SDK 公共 API）
> 参考文档：`docs/okr-roadmap.md`、`claude-code/ARCHITECTURE.md`、`docs/architecture-design.md`

---

## 一、框架现状分析

### 1.1 V18 完成后能力总览

V18 完成了 OKR V6 的核心 KR（状态外化 + 可观测性 + 配置归一化），SDK 架构从单进程向可分布式部署迈出了关键一步：

| 能力 | 状态 | 说明 |
|------|------|------|
| Session 持久化 | ✅ 完成 | ISessionStore write-through + 自动恢复 |
| 可观测性 | ✅ 接口完成 | ITracingProvider + IMetricsProvider（NoOp/InMemory） |
| 配置归一化 | ✅ 接口完成 | UnifiedConfig + ConfigDiagnostics |
| 全局单例 | ✅ 实例化 | TokenBudgetManager 迁移到实例级 |
| 类型屏障 | ✅ 补齐 | 6 个屏障文件，穿透从 88→~62 |
| Provider 运行时 | ❌ 未接入 | 7 个 ProviderAdapter 已实现但从未调用 |
| CircuitBreaker | ❌ 未启用 | 熔断器代码完整但零引用 |
| 穿透依赖 | ⚠️ 未达标 | 88→~62，目标 < 10 未达成 |

### 1.2 深度分析发现的新问题

通过本次 4 维度并行探索，发现以下结构性问题：

#### 问题 A：Provider 运行时路径完全断裂

当前 AgentEngine.query() 的调用链**完全绕过** engine/provider/ 目录：

```
AgentEngine.query()
  → buildQueryEngineConfigFromOptions()     // 只透传 model 字符串
  → CCRuntime.createQueryEngine()           // 创建 CC 原始 QueryEngine
  → queryEngine.submitMessage()             // CC 核心查询循环
  → query() → deps.callModel()              // CC 内部 callModel
  → queryModel() → getAPIProvider()         // CC 内部 Provider 选择（读环境变量）
```

**关键发现**：Bridge 层只透传 `provider.config.model`，`provider.type` 被完全忽略。Provider 选择依赖 CC 内部环境变量，SDK 配置无法控制。

#### 问题 B：Provider 配置是类型黑洞

`ProviderConfig.config` 类型是 `Record<string, unknown>`，SDK 用户无法获得 API Key、Base URL、Model 等参数的类型提示。API Key 只能通过环境变量传入，多租户场景不可用。

#### 问题 C：SDK 入口文件导出不一致

`engine/index.ts` 导出 7 个 Provider 类及配置类型，`src/index.ts` 只导出 `ProviderRegistry`。两个入口的 API 表面不统一，集成者会困惑。

#### 问题 D：穿透依赖实际数量高于预期

穿透 Agent 发现的穿透依赖远不止 ~62 条。仅 `DefaultCCRuntime.ts` 就有 10 条 `require()` 向上穿透，加上静态 import 和 `await import()`，实际穿透总量约 80+ 条。

#### 问题 E：Bridge 层 4 处 `as unknown as` 有 3 处是结构性不兼容

| 位置 | 根因 | 可消除性 |
|------|------|---------|
| L212-213 AppState | CoreAppState 是 AppState 的严格子集，回调签名逆变不兼容 | 困难（需改 QueryEngineConfig） |
| L214 readFileCache | CCRuntime 工厂方法返回类型不同 | 中等（统一类型导出） |
| L286 adaptToolExtension | Tool 接口方法过多，SDK 只需子集 | 可行（定义 SDKTool 接口） |

---

## 二、框架目标对齐分析

| 框架目标 | 当前状态 | 差距 | 对应优化点 |
|---------|---------|------|-----------|
| **可嵌入任意应用** | ⚠️ 部分 | Provider 配置无类型安全，API Key 无法代码传入 | #2 配置类型安全 |
| **多 Session 并发 ≥10** | ✅ 满足 | — | 已满足 |
| **零 UI 依赖** | ✅ 满足 | — | 已满足 |
| **独立发布** | ⚠️ 部分 | Provider 运行时未接入，运行时走 CC 旧路径 | #1 Provider 接入 |
| **多实例/分布式部署** | ✅ V18 完成 | — | 已满足 |
| **生产可观测** | ✅ V18 完成 | Provider 级别可观测缺失（熔断/重试无事件） | #5 熔断启用 |
| **SDK 包 < 2MB** | ⚠️ 部分 | ToolRegistry 动态注册未激活，55+ 工具全量加载 | #9 工具动态化 |
| **架构边界清晰** | ⚠️ 部分 | 穿透依赖 ~62 条（目标 < 10） | #4 穿透治理 |
| **API Key 代码传入** | ❌ 缺失 | 只能环境变量，多租户不可用 | #3 配置注入 |
| **入口文件统一** | ❌ 缺失 | 两个入口导出不一致 | #7 入口统一 |

---

## 三、优化清单（按优先级排序，TOP 10）

| # | 优化点 | 优先级 | 对应来源 |
|---|--------|--------|---------|
| 1 | Provider 运行时接入（QueryDeps 注入） | P0 | V18 #5 延后 |
| 2 | Provider 配置类型安全（discriminated union） | P0 | SDK API 审计 |
| 3 | API Key / Model / BaseUrl 配置注入 | P0 | SDK API 审计 |
| 4 | 穿透依赖持续治理（目标 < 30） | P1 | V18 KR5 未达标 |
| 5 | CircuitBreaker + executeWithRetry 启用 | P1 | 依赖 #1 |
| 6 | LLMRuntime 与 ProviderAdapter 类型合并 | P2 | 死代码审计 |
| 7 | SDK 入口文件导出统一 | P1 | SDK API 审计 |
| 8 | Bridge 层类型安全改善 | P2 | Bridge 类型审计 |
| 9 | ToolRegistry 动态注册激活 | P2 | 死代码审计 |
| 10 | 文档更新（13 个文档） | P2 | V18 文档审计 |

---

## 四、每个优化点的详细 OKR 描述

---

### 优化 #1：Provider 运行时接入（QueryDeps 注入）

**优化重点**：利用 CC 已有的 `query/deps.ts` 依赖注入机制，将 ProviderAdapter 接入运行时调用链

**优化目标**：AgentEngine 的 LLM 调用走 ProviderAdapter → CircuitBreaker → executeWithRetry，支持 per-session Provider 选择

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR1a | QueryEngineConfig 增加 `customDeps?: QueryDeps` 可选字段 | 字段存在且向后兼容 |
| KR1b | QueryEngine.submitMessage() 透传 customDeps 给 query() | CLI 模式不受影响 |
| KR1c | Bridge 层根据 provider.type 注入 ProviderAdapter 包装的 callModel | 指定 provider.type='openai' 时实际走 OpenAIProvider |
| KR1d | per-session Provider 切换可用 | 不同 session 可用不同 Provider，互不干扰 |

**预期收益**：
- SDK 用户可通过 `provider.type` 配置选择 Provider，不再依赖环境变量
- 为 CircuitBreaker、executeWithRetry、Metrics 埋点奠定基础
- 消除"Provider 层是空壳"的架构缺陷

**对框架的影响**：
- 是否破坏"包装不替代"：⚠️ 需谨慎。在 QueryEngineConfig 增加 1 个可选字段，在 submitMessage 增加 1 行条件透传。**不修改 CC 核心逻辑，只在配置层增加扩展点。**
- 正向影响：Provider 选择从环境变量驱动变为配置驱动
- 负面影响：需编写 ProviderMessage → StreamEvent 适配器，类型转换有风险
- 实施风险：中。类型适配是主要风险点。工具执行循环中 callModel 会被多次调用，必须保证一致性。

**符合框架目标**：终极目标 — "SDK 暴露 Claude Code 的全部核心能力"；架构原则 A6 — "Provider 模式"

**依赖关系**：无前置依赖（可最先启动）

**推荐方案**：QueryDeps 注入（方案 B），分 4 个 Phase 实施：
- Phase 1：最小可用路径（环境变量 + customDeps 透传）
- Phase 2：ProviderAdapter 包装为 callModel
- Phase 3：CircuitBreaker + executeWithRetry 集成
- Phase 4：测试 + Metrics 埋点

---

### 优化 #2：Provider 配置类型安全

**优化重点**：将 `ProviderConfig.config: Record<string, unknown>` 改为 discriminated union，提供完整的类型提示

**优化目标**：SDK 用户配置 Provider 时获得完整的 IDE 自动补全

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR2a | 定义每个 Provider 的配置类型（AnthropicProviderConfig、OpenAIProviderConfig 等） | 7 个 Provider 各有独立类型 |
| KR2b | ProviderConfig 改为 discriminated union：`type + 对应配置` | IDE 自动补全可用 |
| KR2c | 消除 7 个 Provider 子类中的 `as any[]` 类型断言 | 子类代码类型安全 |

**预期收益**：
- IDE 补全从"不知道该传什么"变为"每个字段都有提示"
- 消除 7 处 `as any[]` 类型断言
- 为 #3（API Key 注入）奠定类型基础

**对框架的影响**：
- 是否破坏"包装不替代"：否，只改 engine/ 类型定义
- 正向影响：类型安全，开发体验大幅提升
- 负面影响：ProviderConfig 接口签名变更，需要更新测试
- 实施风险：低，纯类型改动

**符合框架目标**：技术目标 — "SDK 可独立发布，开发者可快速理解和使用"

**依赖关系**：无，可与 #1 并行

---

### 优化 #3：API Key / Model / BaseUrl 配置注入

**优化重点**：允许 SDK 用户通过配置对象传入 API Key、Model、Base URL，不再依赖环境变量

**优化目标**：多租户场景可用，不同 Session 可用不同 API Key

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR3a | ProviderConfig 支持 `apiKey` 字段，优先于环境变量 | `provider: { apiKey: 'sk-xxx' }` 可用 |
| KR3b | ProviderConfig 支持 `baseUrl` 字段 | `provider: { baseUrl: 'https://...' }` 可用 |
| KR3c | ProviderConfig 支持 `model` 字段 | `provider: { model: 'claude-3.5-sonnet' }` 可用 |
| KR3d | API Key 通过 customDeps 注入 CC 内部 | #1 完成后，API Key 通过 callModel 参数传入 |

**预期收益**：
- 多租户场景：不同用户用不同 API Key
- Serverless/容器化：无需配置环境变量
- 安全性：API Key 不出现在环境变量中

**对框架的影响**：
- 是否破坏"包装不替代"：否
- 正向影响：企业级集成门槛降低
- 负面影响：API Key 存在于内存中，需注意安全性
- 实施风险：低-中。#3a-#3c 纯配置改动；#3d 依赖 #1 的 customDeps 机制

**符合框架目标**：终极目标 — "可嵌入、分布式、多实例"；企业级用户画像

**依赖关系**：#3d 依赖 #1（QueryDeps 注入）

---

### 优化 #4：穿透依赖持续治理

**优化重点**：将 engine/ 穿透依赖从 ~62 条继续降低，目标 < 30 条

**优化目标**：engine/ 的 import 边界更清晰，向独立编译迈进

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR4a | DefaultCCRuntime.ts 的 10 条 require() 穿透归类：哪些是必须的、哪些可通过 DI 消除 | 分类清单完成 |
| KR4b | bootstrap/ 的 7 条 await import() 穿透改为通过 config 注入 | bootstrap 层穿透减少 |
| KR4c | Provider adapters 的 8 条 await import() 穿透保留（运行时需要，#1 接入后自然解决） | 标记为"不可消除" |
| KR4d | 总穿透数 < 30 条 | grep 验证 |

**预期收益**：
- engine/ 独立编译可能性增加
- 新开发者更容易理解 engine/ 边界
- 为 engine/ 独立 npm 包奠定基础

**对框架的影响**：
- 是否破坏"包装不替代"：否，只改 import 路径和注入方式
- 正向影响：架构边界更清晰
- 负面影响：DI 注入增加 config 复杂度
- 实施风险：低，机械性改动

**符合框架目标**：技术目标 — "物理分离"；架构原则 F2 — "单向分层依赖"

**依赖关系**：无硬依赖，但 #1 完成后 Provider adapter 穿透自然减少

---

### 优化 #5：CircuitBreaker + executeWithRetry 启用

**优化重点**：激活 BaseProvider 的重试和熔断基础设施，为 LLM 调用增加弹性

**优化目标**：连续失败时自动熔断，429/网络错误时自动重试，错误有精细分类

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR5a | BaseProvider 增加 CircuitBreaker 实例属性 | 每个 Provider 有独立熔断器 |
| KR5b | callModel 包装函数集成 executeWithRetry + CircuitBreaker | 模拟 429 时自动重试 |
| KR5c | 熔断状态事件（circuit_open/circuit_half_open/circuit_closed）发布到 EventBus | 可订阅熔断事件 |
| KR5d | classifyError() 的 AUTH_ERROR 不计入熔断失败次数 | 认证失败不触发熔断 |

**预期收益**：
- LLM 调用具备弹性：重试 + 熔断 + 错误分类
- 生产环境可观测熔断状态
- 连续失败不再持续重试

**对框架的影响**：
- 是否破坏"包装不替代"：否，只改 engine/provider/ 包装层
- 正向影响：LLM 调用更可靠
- 负面影响：首次调用增加 CircuitBreaker 初始化开销（~1ms）
- 实施风险：低，CircuitBreaker 代码完整，只需集成

**符合框架目标**：架构纲领 A6 — "Provider 模式"；终极目标 — "可靠性"

**依赖关系**：依赖 #1（Provider 运行时接入）

---

### 优化 #6：LLMRuntime 与 ProviderAdapter 类型合并

**优化重点**：消除两套并行的 LLM 接口抽象，统一为类型安全的 ProviderAdapter

**优化目标**：只有一套 Provider 接口，参数使用强类型（LLMMessage/LLMTool/LLMEvent）

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR6a | ProviderAdapter.query() 参数改为 LLMMessage[] + LLMTool[] | 消除 unknown[] |
| KR6b | ProviderAdapter.query() 返回类型改为 AsyncGenerator<LLMEvent> | 消除 ProviderMessage 中的 unknown |
| KR6c | LLMRuntime.ts 的类型定义合并到 ProviderAdapter.ts | 只有一个 Provider 接口文件 |
| KR6d | ProviderRegistry.getRuntime() 的 duck typing 检查消除 | 不再需要 as LLMRuntime 断言 |

**预期收益**：
- 消除两套 Provider 抽象的混乱
- 消除 7 个子类中的 `as any[]` 断言
- Provider 接口真正类型安全

**对框架的影响**：
- 是否破坏"包装不替代"：否
- 正向影响：类型安全
- 负面影响：7 个子类需修改参数类型
- 实施风险：低，纯类型改动，无运行时行为变更

**符合框架目标**：技术目标 — "API 类型体系统一"

**依赖关系**：#2（Provider 配置类型安全）之后，可与 #1 并行

---

### 优化 #7：SDK 入口文件导出统一

**优化重点**：统一 `engine/index.ts` 和 `src/index.ts` 的导出集，消除不一致

**优化目标**：SDK 用户无论通过哪个路径导入，看到的 API 表面一致

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR7a | src/index.ts 补充 7 个 Provider 类导出 | 从 src/ 导入也能用 AnthropicProvider |
| KR7b | engine/index.ts 补充 RBACPermissionDelegate、AuditPermissionDelegate 导出 | 权限委托在 engine/ 也可用 |
| KR7c | engine/index.ts 补充 IBackend/InMemoryBackend/FilesystemBackend/CompositeBackend | 存储后端在 engine/ 也可用 |
| KR7d | src/index.ts 移除已 deprecated 的 initializeEngine/createDefaultEngineConfig/validateEngineConfig | 清理废弃导出 |

**预期收益**：
- SDK 用户不再困惑于两个入口的差异
- 统一的 API 表面，文档更清晰
- 清理 deprecated 导出

**对框架的影响**：
- 是否破坏"包装不替代"：否
- 正向影响：开发体验提升
- 负面影响：engine/index.ts 文件增长
- 实施风险：极低，纯导出调整

**符合框架目标**：技术目标 — "SDK 可独立发布，开发者可快速理解和使用"

**依赖关系**：无

---

### 优化 #8：Bridge 层类型安全改善

**优化重点**：减少 Bridge 层的 `as unknown as` 使用，增强类型安全

**优化目标**：Bridge 层类型断言从 4 处降至 2 处（保留结构性不兼容的 2 处）

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR8a | 定义 `SDKTool` 接口，adaptToolExtension 返回 SDKTool 而非 Tool | L286 的 `as unknown as Tool` 消除 |
| KR8b | 统一 FileStateCache 类型导出 | L214 的 `as unknown as` 消除 |
| KR8c | AppState/getAppState/setAppState 保留 `as unknown as`（结构性不兼容） | 文档说明保留原因 |

**预期收益**：
- Bridge 层类型更安全
- SDKTool 接口可供外部用户使用
- 减少 runtime 类型风险

**对框架的影响**：
- 是否破坏"包装不替代"：否
- 正向影响：类型安全
- 负面影响：可能需要 QueryEngine 对缺失方法增加 fallback
- 实施风险：低-中

**符合框架目标**：架构原则 — "核心模块零 React"（类型安全）

**依赖关系**：可与 #1 并行

---

### 优化 #9：ToolRegistry 动态注册激活

**优化重点**：激活 DefaultToolRegistry 的动态注册能力，SDK 用户可按需加载工具

**优化目标**：SDK 用户通过 `registerToolSet()` 注册自定义工具组，不加载不需要的内置工具

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR9a | AgentEngine.create() 使用 createSDKToolRegistry() 创建 SDK 模式 registry | SDK 模式只加载 17 个核心工具 |
| KR9b | AgentEngineConfig 增加 `toolsets?: ToolSet[]` 配置项 | 用户可配置额外工具组 |
| KR9c | ToolAdapter 的 coreToolToTool() 在工具注册路径中启用 | 自定义 CoreTool 可通过 ToolAdapter 注入 |

**预期收益**：
- SDK 包大小减少（不加载 55+ 全量工具）
- 工具按需加载，内存占用降低
- 自定义工具有清晰的注册路径

**对框架的影响**：
- 是否破坏"包装不替代"：否
- 正向影响：SDK 轻量化
- 负面影响：需要验证 17 个核心工具是否覆盖 SDK 基本场景
- 实施风险：低-中，已有 DefaultToolRegistry 实现

**符合框架目标**：终极目标 — "轻量化框架"；成功指标 — "SDK 包 < 2MB"

**依赖关系**：无硬依赖，但建议在 #1 之后（Provider 接入后工具注册路径更清晰）

---

### 优化 #10：文档更新（13 个文档）

**优化重点**：更新 V18 文档审计发现的 13 个过期文档

**优化目标**：核心文档与代码状态一致，新用户可从文档理解当前架构

**关键结果**：

| KR | 描述 | 验证标准 |
|----|------|---------|
| KR10a | P0 文档更新：architecture-design.md、project-purpose.md | engine/ 文件数、模块列表、版本号更新 |
| KR10b | P1 文档更新：session-manager-design.md、session-store-design.md、bootstrap-design.md、engine-state-design.md、extension-model-design.md | write-through、DI 重构、UnifiedConfig 反映 |
| KR10c | P2 文档更新：memory-and-session-content-design.md 等 5 个 | 立场修正、配置类型更新 |

**预期收益**：
- 新用户从文档获得准确信息
- V19 优化点有正确的基线文档
- 减少因文档过时导致的开发困惑

**对框架的影响**：
- 是否破坏"包装不替代"：否
- 正向影响：项目可维护性
- 负面影响：纯文档工作，不影响代码
- 实施风险：极低

**符合框架目标**：文档管理规范 — "文档是最宝贵的资源"

**依赖关系**：建议在 #1-#9 代码改动完成后更新

---

## 五、优化点依赖关系

```
#1 Provider 运行时接入 (P0) ←── #5 CircuitBreaker 启用 (P1)
     │                                    │
     │                                    └── #9 ToolRegistry 动态化 (P2)
     │
#2 Provider 配置类型安全 (P0) ←── #6 LLMRuntime 合并 (P2)
     │
     ├── #3 API Key 配置注入 (P0)
     │       └── #3d 依赖 #1
     │
#4 穿透依赖治理 (P1) ←── 独立，可并行
     │
#7 SDK 入口统一 (P1) ←── 独立，可并行
     │
#8 Bridge 类型安全 (P2) ←── 独立，可并行
     │
#10 文档更新 (P2) ←── 建议 #1-#9 完成后
```

**建议执行顺序**：

| 波次 | 优化点 | 理由 |
|------|--------|------|
| 第一波（并行） | #1 Provider 运行时 + #2 配置类型安全 + #7 入口统一 | 互不依赖，#1 和 #2 是最关键 |
| 第二波 | #3 API Key 注入 + #4 穿透治理 + #8 Bridge 类型 | #3d 依赖 #1，其余独立 |
| 第三波 | #5 CircuitBreaker 启用 + #6 LLMRuntime 合并 + #9 ToolRegistry | 依赖 #1 #2 |
| 第四波 | #10 文档更新 | 代码稳定后统一更新 |

---

## 六、后续行动建议

### 6.1 与 OKR 路线图的映射

| OKR 路线图目标 | V19 覆盖 | 说明 |
|--------------|---------|------|
| Provider 运行时接入 | #1, #5 | V18 延后的最高优先级项 |
| 配置完善 | #2, #3 | 企业级集成必需 |
| 穿透依赖治理 | #4 | KR5 目标持续推进 |
| API 类型统一 | #6, #8 | 消除 as any / as unknown as |
| 轻量化 | #9 | SDK 模式工具按需加载 |
| 文档一致性 | #10 | 13 个文档更新 |

### 6.2 V19 不纳入的优化点

| 优化点 | 描述 | 延后原因 |
|--------|------|---------|
| 多租户支持 | userId 标识 + per-user 隔离 + per-user 配额 | 需要 Provider 运行时先就绪 |
| Token 限额执行 | TokenBudget 从追踪变为限制 | 需要多租户基础 |
| 审计日志 | AuditLogger 接口 | 非阻塞，可延后 |
| 健康检查 | healthCheck() 方法 | 非阻塞 |
| 查询级超时/轮次限制 | QueryOptions.timeoutMs / maxTurns | 非阻塞 |

### 6.3 风险提示

1. **#1 Provider 运行时接入是最高风险项**：涉及 CC 核心调用链变更，需要全面回归测试
2. **工具执行循环断裂**：CC 的 query() 包含完整工具循环，callModel 被替换后工具执行回调必须一致
3. **thinkingConfig 丢失**：ProviderAdapter 当前硬编码 `thinkingConfig: { type: 'disabled' }`，直接替换会丧失 thinking 能力

---

## 七、关键文件索引

### Provider 运行时核心
- `engine/AgentEngine.ts` — query() 方法入口
- `engine/bridge/OriginalQueryEngineBridge.ts` — 配置转换层（buildQueryEngineConfigFromOptions）
- `engine/cc-runtime/DefaultCCRuntime.ts` — QueryEngine 创建（10 条 require 穿透）
- `src/query/deps.ts` — QueryDeps 依赖注入定义
- `src/QueryEngine.ts` — submitMessage() 中的 deps 透传点
- `src/services/api/claude.ts` — queryModel() 中的 Provider 分叉点
- `src/utils/model/providers.ts` — getAPIProvider() 环境变量逻辑

### Provider 类型核心
- `engine/provider/ProviderAdapter.ts` — Provider 统一接口
- `engine/provider/adapters/BaseProvider.ts` — executeWithRetry + classifyError
- `engine/provider/CircuitBreaker.ts` — 三态熔断器
- `engine/provider/LLMRuntime.ts` — 强类型 LLM 抽象
- `engine/provider/adapters/*.ts` — 7 个 Provider 实现

### SDK 入口核心
- `engine/index.ts` — engine/ 公共 API 导出
- `src/index.ts` — SDK 构建入口导出

### Bridge 类型核心
- `engine/bridge/OriginalQueryEngineBridge.ts` — 4 处 as unknown as
