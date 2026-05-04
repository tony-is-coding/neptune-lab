# V19 任务计划

> 版本：V19
> 日期：2026-04-29
> 输入：`auto-upgrade/v19/01-optimizer-research.md`（TOP 10 优化清单）
> 目标：将优化清单转换为可执行的任务，组建 Agent Team 并行交付

---

## 一、项目概述

V19 聚焦三个方向：
1. **Provider 运行时接入**（P0）：让 AgentEngine 的 LLM 调用走 ProviderAdapter → CircuitBreaker → executeWithRetry
2. **SDK API 完善**（P0-P1）：Provider 配置类型安全、API Key 注入、入口文件统一
3. **架构治理持续优化**（P1-P2）：穿透依赖治理、Bridge 类型改善、文档更新

核心约束：
- "包装不替代"原则：不修改 CC 核心 agent loop
- 向后兼容：CLI 模式不受影响
- 渐进增强：每个任务独立可验证

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 需要的能力 | 协作方式 |
|------|------|------|-----------|---------|
| team-lead | 1 | 任务分配、进度管理、阻塞协调 | 任务管理、沟通协调 | 分配任务给各角色，接收完成通知 |
| architect | 1 | 架构设计决策、代码质量审核 | TypeScript 架构、设计模式、Provider 模式 | 审核每个任务的 PR，提供设计建议 |
| developer-1 | 1 | Provider 运行时链路（最复杂任务） | TypeScript、异步编程、流式处理、依赖注入 | 负责 Provider 接入主路径，与 architect 确认设计 |
| developer-2 | 1 | 类型系统 + 配置注入 | TypeScript 类型系统、discriminated union、泛型 | 负责 Provider 配置类型和 API Key 注入 |
| developer-3 | 1 | 架构治理（穿透、入口、Bridge） | TypeScript import 分析、模块设计、re-export 模式 | 负责穿透治理、入口统一、Bridge 类型 |
| doc-writer | 1 | 文档更新 | 技术文档撰写、架构理解 | 在代码任务完成后统一更新文档 |

**总计 6 个 Agent**

---

## 三、任务阶段规划

### Phase 1 — 并行启动（无依赖任务同时开始）

| 任务 | 执行人 | 目标 |
|------|--------|------|
| T1: Provider 运行时接入 — QueryDeps 注入基础 | developer-1 | 打通 customDeps 透传链路 |
| T2: Provider 配置类型安全 | developer-2 | 消除 `Record<string, unknown>` 类型黑洞 |
| T3: SDK 入口文件导出统一 | developer-3 | 两个入口 API 表面一致 |
| T4: 穿透依赖持续治理 | developer-3 | 新增屏障文件，穿透 < 30 |
| T5: Bridge 层类型安全改善 | developer-3 | 减少 as unknown as 使用 |

**小目标**：Phase 1 完成后，SDK 用户可通过代码配置 Provider，入口文件统一，穿透依赖显著下降。

### Phase 2 — 集成增强（依赖解锁后开始）

| 任务 | 执行人 | 依赖 | 目标 |
|------|--------|------|------|
| T6: API Key / Model / BaseUrl 配置注入 | developer-2 | T1, T2 | 多租户可用 |
| T7: CircuitBreaker + executeWithRetry 启用 | developer-1 | T1 | 弹性调用 |
| T8: LLMRuntime 与 ProviderAdapter 合并 | developer-2 | T2 | 消除两套 Provider 抽象 |

**小目标**：Phase 2 完成后，SDK 具备企业级集成能力（API Key 注入、熔断重试、类型安全）。

### Phase 3 — 扩展能力

| 任务 | 执行人 | 依赖 | 目标 |
|------|--------|------|------|
| T9: ToolRegistry 动态注册激活 | developer-1 | T1 | SDK 轻量化 |

**小目标**：Phase 3 完成后，SDK 支持工具按需加载。

### Phase 4 — 文档收尾

| 任务 | 执行人 | 依赖 | 目标 |
|------|--------|------|------|
| T10: 文档更新（13 个文档） | doc-writer | T1-T9 | 文档与代码一致 |

---

## 四、任务清单

### T1：Provider 运行时接入 — QueryDeps 注入基础

| 字段 | 内容 |
|------|------|
| **任务编号** | T1 |
| **执行人** | developer-1 |
| **依赖关系** | 无 |
| **优先级** | P0（最高） |

**任务目标**：打通 AgentEngine → QueryEngine → query() 的 customDeps 透传链路，让 Bridge 层能根据 provider.type 注入 ProviderAdapter 包装的 callModel。

**实施步骤**：

1. **QueryEngineConfig 增加 customDeps 字段**
   - 文件：`src/QueryEngine.ts`
   - 在 `QueryEngineConfig` 类型中增加 `customDeps?: QueryDeps` 可选字段
   - 约束：可选字段，不传时走默认 `productionDeps()`，CLI 模式零影响

2. **submitMessage() 透传 customDeps**
   - 文件：`src/QueryEngine.ts`
   - 在 `submitMessage()` 调用 `query()` 时，增加 `deps: this.config.customDeps` 透传
   - 条件透传：`deps: this.config.customDeps ?? productionDeps()` 或直接 `deps: this.config.customDeps`（query() 内部已有 fallback）

3. **Bridge 层根据 provider.type 注入 ProviderAdapter callModel**
   - 文件：`src/engine/bridge/OriginalQueryEngineBridge.ts`
   - 在 `buildQueryEngineConfig()` 中，当 `provider.type` 非空时：
     - 从 `ProviderRegistry` 获取对应 ProviderAdapter
     - 创建包装函数：将 CC 的 `queryModelWithStreaming` 参数格式转换为 ProviderAdapter 的 `ProviderQueryParams`
     - 将包装函数作为 `callModel` 注入 `customDeps`
   - 当 `provider.type` 为空时，不注入 customDeps（走 CC 默认路径）

4. **per-session Provider 切换**
   - 文件：`src/engine/AgentEngine.ts`
   - `query()` 方法中 `effectiveProvider` 已有 session > engine 优先级逻辑
   - 确保 Bridge 层正确使用 `effectiveProvider` 的 type 字段

**验收标准**：
1. `QueryEngineConfig` 类型包含 `customDeps?: QueryDeps` 字段
2. `submitMessage()` 将 customDeps 透传给 `query()`
3. 指定 `provider.type='openai'` 时，LLM 调用实际走 `OpenAIProvider`
4. CLI 模式（不传 provider.type）行为完全不变
5. 不同 session 可使用不同 Provider，互不干扰

**关键文件**：
- `src/QueryEngine.ts` — QueryEngineConfig + submitMessage()
- `src/query.ts` — query() 函数（deps fallback）
- `src/query/deps.ts` — QueryDeps 类型 + productionDeps()
- `src/engine/bridge/OriginalQueryEngineBridge.ts` — buildQueryEngineConfig()
- `src/engine/AgentEngine.ts` — query() + effectiveProvider
- `src/engine/provider/ProviderAdapter.ts` — ProviderAdapter 接口

---

### T2：Provider 配置类型安全

| 字段 | 内容 |
|------|------|
| **任务编号** | T2 |
| **执行人** | developer-2 |
| **依赖关系** | 无 |
| **优先级** | P0 |

**任务目标**：将 `ProviderConfig.config: Record<string, unknown>` 改为 discriminated union，消除 7 个 Provider 子类中的 `as any[]` 类型断言。

**实施步骤**：

1. **定义每个 Provider 的配置类型**
   - 文件：新建 `src/engine/provider/types/ProviderConfigs.ts`
   - 定义 `AnthropicProviderConfig`（apiKey, model, baseUrl, maxTokens 等）
   - 定义 `OpenAIProviderConfig`（apiKey, model, baseUrl, organization 等）
   - 定义 `GeminiProviderConfig`、`GrokProviderConfig`、`BedrockProviderConfig`、`VertexProviderConfig`、`FoundryProviderConfig`
   - 所有配置类型包含 `apiKey?: string`、`model?: string`、`baseUrl?: string` 共通字段

2. **改造 ProviderConfig 为 discriminated union**
   - 文件：`src/engine/AgentEngine.ts`
   - 将 `ProviderConfig` 从：
     ```typescript
     interface ProviderConfig {
       type?: ProviderType
       config?: Record<string, unknown>
     }
     ```
   - 改为：
     ```typescript
     type ProviderConfig = {
       type: 'anthropic'
       config?: Omit<AnthropicProviderConfig, 'type'>
     } | {
       type: 'openai'
       config?: Omit<OpenAIProviderConfig, 'type'>
     } | ... // 其他 Provider
     ```

3. **消除 Provider 子类的 as any[]**
   - 文件：`src/engine/provider/adapters/*.ts`（7 个文件）
   - 将 `params.messages as any[]` 改为强类型转换
   - 将 `params.tools as any[]` 改为强类型转换
   - 根源修复：`ProviderQueryParams` 的 `messages` 和 `tools` 类型需要同步调整

**验收标准**：
1. 7 个 Provider 各有独立的配置类型，包含 apiKey、model、baseUrl 字段
2. `ProviderConfig` 使用 discriminated union，IDE 自动补全可用
3. 7 个 Provider 子类中 `as any[]` 全部消除
4. 现有测试不受影响

**关键文件**：
- `src/engine/AgentEngine.ts` — ProviderConfig 类型定义
- `src/engine/provider/ProviderAdapter.ts` — ProviderQueryParams 类型
- `src/engine/provider/adapters/*.ts` — 7 个 Provider 子类

---

### T3：SDK 入口文件导出统一

| 字段 | 内容 |
|------|------|
| **任务编号** | T3 |
| **执行人** | developer-3 |
| **依赖关系** | 无 |
| **优先级** | P1 |

**任务目标**：统一 `engine/index.ts` 和 `src/index.ts` 的导出集，使 SDK 用户无论通过哪个路径导入，看到的 API 表面一致。

**实施步骤**：

1. **src/index.ts 补充缺失的 engine 导出**
   - 补充 7 个 Provider 类导出（AnthropicProvider 等）
   - 补充 LLMRuntime 相关类型导出
   - 补充 CCRuntime 相关导出
   - 补充 Tool 适配器导出

2. **engine/index.ts 补充缺失的 src 导出**
   - 补充 `RBACPermissionDelegate`、`AuditPermissionDelegate` 导出
   - 补充 `IBackend`、`InMemoryBackend`、`FilesystemBackend`、`CompositeBackend` 导出

3. **清理废弃导出**
   - 移除 `initializeEngine`、`createDefaultEngineConfig`、`validateEngineConfig` 等 deprecated 导出（或标记 @deprecated）

**验收标准**：
1. 从 `src/index.ts` 可导入 `AnthropicProvider` 等具体 Provider 类
2. 从 `engine/index.ts` 可导入 `IBackend`、`RBACPermissionDelegate`
3. 废弃导出已标记 `@deprecated` 或移除
4. `npm run build` 编译通过

**关键文件**：
- `src/engine/index.ts` — engine/ 公共 API 导出
- `src/index.ts` — SDK 构建入口导出

---

### T4：穿透依赖持续治理

| 字段 | 内容 |
|------|------|
| **任务编号** | T4 |
| **执行人** | developer-3 |
| **依赖关系** | 无（可与 T3 并行） |
| **优先级** | P1 |

**任务目标**：将 engine/ 穿透依赖从 ~81 条降至 < 30 条。

**实施步骤**：

1. **穿透分类审计**
   - 81 条穿透分为三类：
     - **不可消除**（~25 条）：DefaultCCRuntime require()（桥接层设计意图）、Provider adapter 的 await import()（运行时动态加载）、屏障文件自身的 re-export
     - **可通过屏障文件消除**（~35 条）：Tool、QueryEngine、model、systemPromptType 等的类型/值 import
     - **可通过 DI 消除**（~10 条）：bootstrap/ 的 await import() 初始化逻辑

2. **新增屏障文件**
   - `engine/types/query-engine.ts` — re-export `QueryEngineConfig`、`QueryEngine` 类型
   - `engine/types/system-prompt.ts` — re-export `SystemPrompt`、`asSystemPrompt`
   - `engine/types/api-providers.ts` — re-export `queryModelWithStreaming`、`queryModelOpenAI` 等函数类型
   - 其他：根据审计结果补充

3. **替换穿透 import 为屏障引用**
   - 将 `../../Tool.js`（value import）→ `../types/tool.js`
   - 将 `../../utils/systemPromptType.js` → `../types/system-prompt.js`
   - 将 `../../QueryEngine.js`（type import）→ `../types/query-engine.js`

4. **标记不可消除穿透**
   - DefaultCCRuntime 的 require()：添加注释说明设计意图
   - Provider adapter 的 await import()：添加注释说明运行时需要

**验收标准**：
1. `grep -r "from ['\"]\.\.\/\.\.\/" engine/ | wc -l` < 30 条
2. DefaultCCRuntime 的 require() 穿透保留（标记为不可消除）
3. 新增 3-5 个屏障文件
4. `npm run build` 编译通过

**关键文件**：
- `src/engine/types/` — 屏障文件目录
- `src/engine/cc-runtime/DefaultCCRuntime.ts` — 穿透集中地
- `src/engine/bootstrap/initializeEngine.ts` — 穿透密集

---

### T5：Bridge 层类型安全改善

| 字段 | 内容 |
|------|------|
| **任务编号** | T5 |
| **执行人** | developer-3 |
| **依赖关系** | 无（可与 T3、T4 并行） |
| **优先级** | P2 |

**任务目标**：Bridge 层 `as unknown as` 从 4 处降至 2 处，消除可修复的类型断言。

**实施步骤**：

1. **定义 SDKTool 接口**
   - 文件：新建 `src/engine/types/tool-extension.ts`
   - 定义 `SDKTool` 接口，只包含 SDK 需要的 Tool 方法子集
   - `adaptToolExtension()` 返回 `SDKTool` 而非 `Tool`

2. **统一 FileStateCache 类型导出**
   - 确保 Bridge 和 CCRuntime 使用相同的 `FileStateCache` 类型定义
   - 消除 L214 的 `as unknown as`

3. **保留 AppState 的 as unknown as（结构性不兼容）**
   - `CoreAppState` 是 `AppState` 的严格子集，回调签名逆变不兼容
   - 添加注释说明保留原因

**验收标准**：
1. `as unknown as` 从 4 处降至 2 处
2. `SDKTool` 接口定义完成，Bridge 层使用 `SDKTool` 替代 `Tool`
3. 保留的 2 处 `as unknown as` 有注释说明原因
4. `npm run build` 编译通过

**关键文件**：
- `src/engine/bridge/OriginalQueryEngineBridge.ts` — 4 处 as unknown as
- `src/engine/types/tool-extension.ts` — 新建 SDKTool 接口

---

### T6：API Key / Model / BaseUrl 配置注入

| 字段 | 内容 |
|------|------|
| **任务编号** | T6 |
| **执行人** | developer-2 |
| **依赖关系** | T1（customDeps 透传）、T2（配置类型） |
| **优先级** | P0 |

**任务目标**：SDK 用户通过配置对象传入 API Key、Model、Base URL，支持多租户场景。

**实施步骤**：

1. **ProviderConfig 支持顶层配置字段**（依赖 T2 的配置类型）
   - `apiKey` 优先于环境变量 `ANTHROPIC_API_KEY`
   - `baseUrl` 覆盖默认 endpoint
   - `model` 指定模型名称

2. **Bridge 层传递 API Key 到 ProviderAdapter**（依赖 T1 的 customDeps）
   - 在 `buildQueryEngineConfig()` 中，将 `provider.config.apiKey` 注入 ProviderAdapter
   - ProviderAdapter 的 `callModel` 包装函数使用注入的 API Key

3. **环境变量 fallback**
   - API Key：`config.apiKey` > `process.env.ANTHROPIC_API_KEY`
   - Model：`config.model` > `userSpecifiedModel`
   - BaseUrl：`config.baseUrl` > Provider 默认 endpoint

**验收标准**：
1. `provider: { type: 'anthropic', config: { apiKey: 'sk-xxx', model: 'claude-3.5-sonnet' } }` 配置可用
2. 不同 session 使用不同 API Key 互不干扰
3. 环境变量 fallback 正常工作
4. API Key 不出现在日志中

**关键文件**：
- `src/engine/AgentEngine.ts` — ProviderConfig 使用
- `src/engine/bridge/OriginalQueryEngineBridge.ts` — 配置传递
- `src/engine/provider/adapters/*.ts` — Provider 实现

---

### T7：CircuitBreaker + executeWithRetry 启用

| 字段 | 内容 |
|------|------|
| **任务编号** | T7 |
| **执行人** | developer-1 |
| **依赖关系** | T1（Provider 运行时接入） |
| **优先级** | P1 |

**任务目标**：激活 BaseProvider 的重试和熔断基础设施，为 LLM 调用增加弹性。

**实施步骤**：

1. **BaseProvider 集成 CircuitBreaker 实例**
   - 在 `BaseProvider` 构造函数中创建 `CircuitBreaker` 实例
   - 每个 Provider 有独立熔断器（per-provider 隔离）

2. **callModel 包装函数集成 executeWithRetry + CircuitBreaker**
   - 在 T1 创建的 callModel 包装函数中：
     - 先检查 `circuitBreaker.canExecute()`
     - 然后通过 `executeWithRetry()` 包装实际调用
     - 成功时 `recordSuccess()`，失败时 `recordFailure()`
   - `classifyError()` 的 `AUTH_ERROR` 不计入熔断失败次数

3. **熔断状态事件发布**
   - 熔断状态变化时（open/half-open/closed）发布到 EventBus
   - 事件类型：`provider:circuit_open`、`provider:circuit_half_open`、`provider:circuit_closed`

**验收标准**：
1. 每个 Provider 有独立 CircuitBreaker 实例
2. 模拟 429 错误时自动重试（指数退避）
3. 连续失败达到阈值时熔断，不再重试
4. 认证失败（401/403）不触发熔断
5. 熔断状态事件可通过 EventBus 订阅

**关键文件**：
- `src/engine/provider/adapters/BaseProvider.ts` — executeWithRetry
- `src/engine/provider/CircuitBreaker.ts` — 熔断器
- `src/engine/bridge/OriginalQueryEngineBridge.ts` — callModel 包装

---

### T8：LLMRuntime 与 ProviderAdapter 类型合并

| 字段 | 内容 |
|------|------|
| **任务编号** | T8 |
| **执行人** | developer-2 |
| **依赖关系** | T2（Provider 配置类型安全） |
| **优先级** | P2 |

**任务目标**：消除两套并行的 LLM 接口抽象，统一为类型安全的 ProviderAdapter。

**实施步骤**：

1. **ProviderAdapter 接口参数类型化**
   - 将 `ProviderQueryParams.messages: unknown[]` 改为 `LLMMessage[]`
   - 将 `ProviderQueryParams.tools: unknown[]` 改为 `LLMTool[]`
   - 将 `ProviderMessage.content: unknown` 改为强类型

2. **LLMRuntime 类型合并到 ProviderAdapter**
   - `ProviderAdapter` 增加返回类型约束为 `AsyncGenerator<LLMEvent>`
   - 删除 `LLMRuntime.ts`（类型合并后不再需要）
   - 更新 `ProviderRegistry.getRuntime()` 的 duck typing（消除 as LLMRuntime 断言）

3. **更新 7 个 Provider 子类**
   - 消除所有 `as any[]` 和 `as Message[]` 断言
   - 使用统一的 `LLMMessage`/`LLMTool` 类型

**验收标准**：
1. `LLMRuntime.ts` 已删除
2. 只有一个 Provider 接口文件 `ProviderAdapter.ts`
3. 7 个 Provider 子类无 `as any[]` / `as unknown[]` 断言
4. `ProviderRegistry.getRuntime()` 无 duck typing
5. `npm run build` 编译通过

**关键文件**：
- `src/engine/provider/ProviderAdapter.ts` — 统一接口
- `src/engine/provider/LLMRuntime.ts` — 待删除
- `src/engine/provider/ProviderRegistry.ts` — getRuntime
- `src/engine/provider/adapters/*.ts` — 7 个子类

---

### T9：ToolRegistry 动态注册激活

| 字段 | 内容 |
|------|------|
| **任务编号** | T9 |
| **执行人** | developer-1 |
| **依赖关系** | T1（Provider 运行时接入后工具注册路径更清晰） |
| **优先级** | P2 |

**任务目标**：SDK 用户可按需加载工具，不加载不需要的内置工具，实现 SDK 轻量化。

**实施步骤**：

1. **创建 SDK 模式 ToolRegistry 工厂**
   - 实现 `createSDKToolRegistry()`：只加载 17 个核心工具（非 55+ 全量）
   - 核心工具清单：Read, Write, Edit, Bash, Glob, Grep, Agent, WebSearch, WebFetch, TodoRead, TodoWrite 等

2. **AgentEngineConfig 增加 toolsets 配置**
   - 增加 `toolsets?: ToolSet[]` 配置项
   - `ToolSet` 类型：`'core' | 'filesystem' | 'web' | 'git' | 'development'`
   - 默认值：`['core']`

3. **AgentEngine.create() 使用 SDK 模式 registry**
   - SDK 模式（非 CLI）使用 `createSDKToolRegistry()`
   - 根据 `toolsets` 配置加载额外工具组

**验收标准**：
1. SDK 模式默认只加载核心工具集（< 20 个）
2. 用户可通过 `toolsets: ['core', 'filesystem']` 按需加载
3. CLI 模式仍加载全量工具，不受影响
4. `npm run build` 编译通过

**关键文件**：
- `src/engine/AgentEngine.ts` — create() 方法
- `src/engine/tools/DefaultToolRegistry.ts` — 动态注册实现
- `src/engine/tools/ToolAdapter.ts` — 工具适配

---

### T10：文档更新（13 个文档）

| 字段 | 内容 |
|------|------|
| **任务编号** | T10 |
| **执行人** | doc-writer |
| **依赖关系** | T1-T9（所有代码任务完成后） |
| **优先级** | P2 |

**任务目标**：更新 V18 审计发现的 13 个过期文档，反映 V19 代码变更。

**实施步骤**：

1. **P0 文档更新**（2 个）
   - `docs/architecture-design.md`：更新 Provider 运行时调用链、穿透依赖数量、模块列表
   - `docs/project-purpose.md`：更新 SDK 能力描述、使用场景

2. **P1 文档更新**（5 个）
   - `docs/feature-design/session-manager-design.md`：反映 per-session Provider
   - `docs/feature-design/session-store-design.md`：write-through 状态更新
   - `docs/feature-design/bootstrap-design.md`：DI 重构反映
   - `docs/feature-design/engine-state-design.md`：状态管理更新
   - `docs/feature-design/extension-model-design.md`：工具注册更新

3. **P2 文档更新**（5 个）
   - `docs/feature-design/memory-and-session-content-design.md` 等

**验收标准**：
1. 13 个文档全部更新，反映 V19 代码状态
2. 文档中的代码示例可运行
3. 文档中的模块列表与实际代码一致
4. 无过期引用（如已删除的文件、已更改的接口）

---

## 五、依赖关系图

```
T1 (Provider 运行时) ─────┬── T6 (API Key 注入) ─── T2 (类型安全)
                          ├── T7 (CircuitBreaker)
                          └── T9 (ToolRegistry)
T2 (配置类型安全) ────────┬── T6 (API Key 注入)
                          └── T8 (LLMRuntime 合并)
T3 (入口统一) ──────────── 无后续依赖
T4 (穿透治理) ──────────── 无后续依赖
T5 (Bridge 类型) ───────── 无后续依赖
T10 (文档) ─────────────── 依赖 T1-T9 全部完成
```

**关键路径**：T1 → T6 → T7 → T9（Provider 运行时链路，最关键）

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| T1 QueryDeps 注入导致工具循环断裂 | 高 | 先确保 CLI 模式不受影响（customDeps 可选） |
| T1 ProviderAdapter 包装的 callModel 类型不兼容 | 高 | 需要适配 ProviderMessage → StreamEvent 转换 |
| T2 ProviderConfig breaking change | 中 | SDK 尚未公开发布，breaking 可接受 |
| T4 穿透治理导致循环依赖 | 中 | 逐个屏障验证，保留 require() 作为 fallback |
| T8 LLMRuntime 合并导致 Provider 子类全改 | 中 | 先确保类型兼容，再逐个更新子类 |

---

## 七、与 OKR 路线图的映射

| OKR 目标 | V19 任务 | 进展指标 |
|----------|---------|---------|
| Provider 运行时接入 | T1, T7 | 从"零调用"到"完全接入" |
| 配置完善 | T2, T6 | API Key 可代码传入 |
| 穿透依赖治理 | T4 | 81 → < 30 |
| API 类型统一 | T5, T8 | as any / as unknown as 显著减少 |
| SDK 入口统一 | T3 | 两个入口 API 一致 |
| 轻量化 | T9 | 工具按需加载 |
| 文档一致性 | T10 | 13 个文档更新 |
