# Agent Engine OKR 路线图 V2

> 生成日期：2026-04-27
> 最后更新：2026-04-29（V21 完成 · V7 技术债收尾 + V7.5 全局状态解耦）
> 驱动方式：基于代码深度扫描发现的架构缺陷和优化点，推导执行路线图
> 策略：先分离再治理，分阶段递进交付
> 当前状态：V1-V7.5 ✅ 全部完成
> 架构纲领：[ARCHITECTURE.md](../ARCHITECTURE.md) — 项目定位 + 架构原则 + 目标架构 + 研发规约

---

## 一、终极目标

**根目录只包含 Agent Engine 核心代码，CLI/TUI/产品级功能物理分离到独立目录。外部项目通过 workspace 引用即可使用 Agent 能力。**

---

## 二、代码扫描发现的架构缺陷

以下问题来自对 `src/` 的系统性扫描（631 个文件，22 个子目录）：

### 缺陷 1：CLI/TUI 代码混入 SDK 目录

| 问题 | 具体文件 | 影响 |
|------|---------|------|
| CLI 交互代码混在 `utils/` | keyboardShortcuts、imagePaste、status.tsx、promptEditor、terminalPanel、suggestions/（6+ 文件/目录） | SDK 目录不干净，外部引用会带入终端依赖 |
| 终端 UI 常量混在 `constants/` | figures.ts、spinnerVerbs.ts、turnCompletionVerbs.ts | SDK 包含无意义的终端动画常量 |
| React 依赖泄漏到 `state/` | AppState 使用 React Context | engine/ 层可能间接受 React 污染 |

**根因**：CLI 和 SDK 没有物理边界，所有代码混在同一个 `src/` 下。

### 缺陷 2：`utils/`（814 文件）和 `services/`（283 文件）严重混合

`utils/` 同时包含：
- SDK 核心逻辑：auth.ts、api.ts、model/、permissions/、mcp/
- CLI 交互：keyboardShortcuts、imagePaste、status.tsx
- 产品功能：billing.ts、telemetry/、settings/

`services/` 同时包含：
- SDK 核心服务：api/（95 文件）、tools/（8 文件）
- 产品功能：analytics/、langfuse/、oauth/、billing

**根因**：缺少按职责分组的目录边界，核心能力和产品功能无物理隔离。

### 缺陷 3：engine/ 穿透依赖量大（V18/V19 持续治理中）

engine/ 作为 Agent SDK 核心层（172 文件），向上穿透引用 `src/` 根文件。当前 **104 条穿透 import**（54 个源文件），已建立 15 个屏障文件（types/ 目录）治理中。穿透最多的文件：`bootstrap/initializeEngine.ts`（11 条）、`cc-runtime/DefaultCCRuntime.ts`（10 条 require()，设计上不可消除）。V19 新增 query-engine/system-prompt/settings 三个屏障文件。

**根因**：engine/ 设计时未完全自包含，类型和值依赖仍穿透到上层。Target：从 104 降至 < 50。

### 缺陷 4：ProviderAdapter 运行时已接入（V19 ✅ 已修复）

V19 通过 QueryDeps 注入机制，将 ProviderAdapter 接入运行时调用链：AgentEngine → customDeps → ProviderAdapter callModel → CircuitBreaker → executeWithRetry。7 个 Provider 已有独立配置类型（discriminated union），LLMRuntime 已合并到 ProviderAdapter。

**状态**：V19 已完成。Provider 运行时链路打通 + 配置类型安全 + API Key 注入 + 熔断保护。

### 缺陷 5：工具注册是静态的（V19 部分修复）

`src/tools.ts` 静态注册所有工具。55 个工具全部通过 `packages/builtin-tools/` 引入。V19 新增 `AgentEngineConfig.toolsets` 配置，支持 SDK 模式按需加载工具组（core/filesystem 等），但 CLI 模式仍为全量加载。

**根因**：工具系统设计时未考虑按场景裁剪。

### 缺陷 6：上下文卸载机制基础就绪（V6 ✅ 接口完成）

V6 完成了 `DefaultOffloadStrategy` 实现（engine/context/）。CC 工具（Bash、Read）本身已有输出过大时写文件的逻辑。卸载机制接口已定义（`OffloadStrategy`/`OffloadResult`），但尚未与 CC 工具系统深度集成——工具的大输出仍各自处理，无统一卸载管道。

**现状**：接口 + 默认实现完成。统一卸载策略配置可后续增强。优先级降低。

### 缺陷 7：存储层统一抽象已完成（V6 ✅ 已修复）

V6 完成了统一存储抽象。`engine/storage/`（18 文件）现在包含：
- `IBackend` 接口（read/write/delete/list/dispose 5 方法）
- `InMemoryBackend` — 内存实现
- `FilesystemBackend` — 文件系统实现（原子写入 + 路径穿越防护）
- `CompositeBackend` — LRU 混合缓存路由
- `ISessionStore` + InMemory/SQLite 实现
- `IMemoryStore` + InMemory 实现
- `ISessionContentStore` + InMemory 实现

**遗留**：无 PG/Redis Backend 实现。当前不在项目范畴内。

### 缺陷 8：日志仅文本格式，无结构化输出

`engine/log/`（11 文件）设计完整，但只有文本输出，不支持 JSON 结构化格式，无法被 ELK/Datadog 等日志聚合系统消费。缺少 MDC（上下文传播），多 Session 并行时日志会串。

**根因**：日志系统设计时面向开发者终端调试，未考虑生产环境聚合消费。

### 缺陷 9：权限系统只有只读策略

`engine/permissions/` 接口设计清晰，但只有 `ReadOnlyPermissionDelegate` 一个实现。缺少角色-权限映射、审计日志等生产级策略。

**根因**：权限系统处于 MVP 阶段。

### 缺陷 10：无 lint:layers 分层守护

架构设计定义了 L0-L3 四层，但没有自动化检查工具。分层违规只能靠人工 code review 发现。

**根因**：分层规则停留在文档层面，未落地为 CI 守护。

---

## 三、已有成熟能力（不做重复建设）

以下能力经代码分析已确认成熟，不在本次优化范围：

| 能力 | 位置 | 状态 |
|------|------|------|
| 对话压缩 | compact/（28 文件）| ✅ 成熟（auto/micro/snip/reactive 四种策略） |
| 多 Session 管理 | engine/SessionManager + AsyncLocalStorage | ✅ 成熟 |
| 子 Agent 协作 | swarm/（13 文件） | ✅ 成熟（spawn/teammate/permission sync） |
| Hook 钩子机制 | engine/hooks/ | ✅ 成熟（零 UI 依赖，headless 模式支持） |
| EventBus 事件系统 | engine/events/ | ✅ 成熟（session 级过滤、序列化协议） |
| 日志框架 | engine/log/（11 文件） | ✅ 成熟（策略模式、child logger、文件持久化） |
| Langfuse 追踪 | services/langfuse/（6 文件） | ✅ 成熟 |
| OTel 遥测 | utils/telemetry/（10+ 文件） | ✅ 成熟 |
| Analytics 分析 | services/analytics/（10 文件） | ✅ 成熟 |
| 技能系统 | skills/ | ✅ 成熟（三重来源、安全防护、渐进式披露） |
| 工具适配 | engine/tools/ToolAdapter | ✅ 成熟（CoreTool/UITool 双向转换） |
| 会话存储 | engine/storage/ | ✅ 成熟（InMemory + SQLite） |

---

## 四、路线图总览

从 10 个架构缺陷推导出 5 个版本的执行路线：

```
缺陷 1,2,3 ──→ V1 CLI外化         → SDK目录干净
缺陷 3,5,10 ──→ V2 分层治理        → 分层清晰，外部可引用
缺陷 4,6,7 ──→ V3 Provider+上下文  → 能力补齐
缺陷 8,9 ──→ V4 生产加固          → 生产可用
              V5 交付验收          → 文档完备，验收通过
              ──── V5 100% 完成 ────
              V6 状态外化+可观测性  → 为分布式部署奠基
              ──── V6 100% 完成（V18 实现）────
              V7 SDK成熟度+技术债+启动路径统一 → 生产级成熟度
              V7.5 全局状态解耦     → SDK 具备云无状态化基础
              ──── V7.5 100% 完成 ────

---

## 五、版本详细 OKR

### V1：CLI 外化 + SDK 目录干净

**解决缺陷**：缺陷 1（CLI 混入）、缺陷 2（utils/services 混合 — CLI 部分）

**Objective**：根目录只保留 Agent SDK 相关代码，CLI/TUI 宿主代码物理分离到独立目录。SDK 和 CLI 各自可独立构建。

> **注意**：V1 不要求 engine/ 独立运行。核心是"划清边界，各归各位"。

| # | Key Result | 验证标准 | 对应缺陷 |
|---|-----------|---------|---------|
| KR1 | `src/utils/` 中 CLI 专属代码迁出到独立 CLI 目录（keyboardShortcuts、imagePaste、status.tsx、promptEditor、terminalPanel、suggestions/） | 迁出后 SDK `tsc` 通过 | 缺陷 1 |
| KR2 | `src/constants/` 中 CLI 常量迁出（figures、spinnerVerbs、turnCompletionVerbs） | SDK 内零终端动画依赖 | 缺陷 1 |
| KR3 | `src/state/` React 依赖清除——AppState 从 React Context 改为纯状态管理 | engine/ 零 React import | 缺陷 1 |
| KR4 | SDK 专用构建入口：`src/index.ts` → `dist/sdk.js` + `.d.ts`，`tsc` 编译通过 | SDK `tsc` 无错误 | 缺陷 2 |
| KR5 | CLI 目录通过 `@claude-code-best/*` 引用 SDK，两套构建独立 | CLI `tsc` 通过 | 缺陷 1 |
| KR6 | **CLI 回归验证**：CLI 全功能回归通过 | CLI 端到端功能正常 | — |

**门禁条件**：KR1-KR5 通过（边界清晰、各自可构建），KR6 通过（CLI 无回归）。

---

### V2：分层治理 + 外部可用

**解决缺陷**：缺陷 3（54 处穿透）、缺陷 5（工具静态注册）、缺陷 10（无 lint:layers）

**Objective**：V1 分离后的纯净 SDK 中，清理分层问题，确保外部项目可以直接引用 根目录使用 Agent 能力。

> **前置条件**：V1 已完成物理分离。
> **定位**：不做新架构（hooks/EventBus 已成熟），只做清理和补齐。

| # | Key Result | 验证标准 | 对应缺陷 |
|---|-----------|---------|---------|
| KR1 | **feature() SDK 模式兼容**：SDK 模式下 feature flag 提供合理默认值 | SDK 模式启动无报错 | 缺陷 3 相关 |
| KR2 | **工具注册可插拔**：`registerToolSet()` 按需加载工具组 | 默认 core tools，按需加载 builtin-tools | 缺陷 5 |
| KR3 | **engine/ 穿透依赖清理**：消除 engine/ 向 src/ 根文件的 import 穿透 | engine/ 零 `import from '../../根文件'` | 缺陷 3 |
| KR4 | **外部引用验证**：e2e_cli 通过 workspace 引用跑通完整 agent 交互 | e2e_cli 端到端通过 | — |
| KR5 | **lint:layers 落地**：分层依赖检查规则，CI 守护 | lint:layers 通过 | 缺陷 10 |

**门禁条件**：KR4 通过（外部项目可直接引用跑通 agent 交互）。

---

### V3：Provider 整合 + 上下文工程增量 + Backend 抽象

**解决缺陷**：缺陷 4（Provider 空壳）、缺陷 6（无卸载）、缺陷 7（无 Backend 抽象）

**Objective**：SDK 具备真实可用的 Provider 体系和上下文卸载能力，补齐存储层抽象。

**已有能力（复用不重做）**：
- compact/（28 文件）：四种压缩策略已丰富
- SessionManager：多 Session 并行已成熟
- swarm/（13 文件）：子 Agent 机制已完善
- src/services/api/：已有 7 个 provider 实现

| # | Key Result | 验证标准 | 对应缺陷 |
|---|-----------|---------|---------|
| KR1 | **Provider 整合**：src/services/api/ 的 7 个 provider 适配到 ProviderAdapter 接口（包装不替代） | 切换配置即可换后端 | 缺陷 4 |
| KR2 | **卸载机制**：大块工具输出自动写入临时文件，context 只保留摘要 + 文件路径 | Token 使用量下降可测量 | 缺陷 6 |
| KR3 | **摘要策略可配置化**：compact 系统增加策略选择接口 | 策略可配置，默认行为不变 | 缺陷 6 增量 |
| KR4 | **子 Agent 结果精炼**：swarm 子 Agent 完成后只返回精炼摘要 | 主 Agent token 可控 | 缺陷 6 增量 |
| KR5 | **IBackend + CompositeBackend**：统一存储抽象 + 按路径路由 | 路由配置验证通过 | 缺陷 7 |
| KR6 | **FilesystemBackend**：磁盘文件系统后端 | 单元测试通过 | 缺陷 7 |

**门禁条件**：KR1 通过（Provider 可用），KR2 通过（卸载可用），KR5-KR6 通过（Backend 抽象可用）。

---

### V4：生产加固

**解决缺陷**：缺陷 8（日志无 JSON）、缺陷 9（权限只有只读）

**Objective**：日志和权限系统达到生产标准，长时间运行场景下资源可控。

| # | Key Result | 验证标准 | 对应缺陷 |
|---|-----------|---------|---------|
| KR1 | **日志 JSON 输出**：LogProvider 支持结构化 JSON 格式 | JSON schema 验证 | 缺陷 8 |
| KR2 | **MDC 上下文传播**：日志自动携带 sessionId、requestId | 多 Session 并行日志不串 | 缺陷 8 |
| KR3 | **权限策略扩展**：RBACPermissionDelegate + 审计日志 | 权限决策有据可查 | 缺陷 9 |
| KR4 | **并发安全**：Session 生命周期 GC、EventBus 监听器 TTL | 压力测试无泄漏 | — |
| KR5 | **资源管理**：文件句柄、数据库连接、子进程自动回收 | 资源泄漏检测通过 | — |
| KR6 | **配置校验**：启动时校验必要配置，明确报错 | 缺失配置有清晰报错 | — |

**门禁条件**：KR1 日志 JSON 可被日志聚合系统消费，KR4 压力测试通过。

---

### V5：文档 & 交付验收

**Objective**：根目录干净、分层清晰、外部可直接引用。开发者可以快速理解和使用。

> **交付形态**：干净的 根目录，外部通过 workspace 引用即可使用。

| # | Key Result | 验证标准 |
|---|-----------|---------|
| KR1 | API 文档覆盖全部公共方法（TSDoc / TypeDoc） | 覆盖率 100% |
| KR2 | 快速开始指南 + 3 个完整示例（嵌入式 / Web 服务 / CLI 工具） | 新用户 30 分钟可跑通 |
| KR3 | 全面回归测试 + lint:layers 零违规 | CI 全绿 |
| KR4 | **workspace 引用验证**：全新项目通过 `workspace:*` 引用跑通 agent 交互 | 从零到跑通 < 30 分钟 |

**门禁条件**：KR3-KR4 通过。

---

## 六、版本间依赖关系

```
V1 CLI外化 ──→ V2 分层治理 ──→ V3 能力补齐
                      │                  │
                      │                  ├─→ V4 生产加固
                      │                  │
                      └──────────────────┴─→ V5 交付验收
                                                    │
                                              V6 状态外化 + 可观测性 + 配置归一化
                                              (V18 实现 ✅)
                                                    │
                                              V7 SDK成熟度 + 技术债清理 + 启动路径统一
                                              (穿透治理 + 入口统一 + EngineFacade消除 + 文档同步)
                                                    │
                                              V7.5 全局状态解耦
                                              (bootstrap/state → SessionContext ALS)
```

- V1-V5 完成里程碑 M1-M5（SDK 核心构建 + 交付验收）
- V6 完成里程碑 M6（状态外化 + 可观测性 + 配置归一化）
- V7 清除技术债 + 启动路径统一，SDK 达到生产级成熟度
- V7.5 全局状态解耦，SDK 具备云无状态化基础（当前路线图终点）

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| CLI 迁出导致回归 | CLI 功能异常 | V1 KR6 CLI 全功能回归验证 |
| engine/ 穿透依赖清理量大 | V2 延期 | 优先清理影响外部引用的穿透，其余渐进 |
| Provider 整合改动面广 | 影响现有 API 调用链 | V3 KR1 包装不替代——适配而非重写 |
| 外部引用依赖链不完整 | workspace 引用跑不通 | V2 KR4 用 e2e_cli 实际验证 |
| initializeEngine 废弃导致 CLI 回归 | CLI 初始化失败 | V7 KR9 验证 AgentEngine.create 覆盖全部能力 |
| bootstrap/state 迁移影响 CC 原始代码 | 121 个文件需修改 | V7.5 保留 getXxx() 函数签名不变，只改内部实现 |
| SessionContext ALS 上下文丢失 | 异步代码中状态读取失败 | SessionContextStorage 已有 runInSessionContextAsync 解决 generator 场景 |

---

## 八、验收总则

每版本必须满足：
1. **结构验证**：代码结构是否朝目标边界移动
2. **行为验证**：现有能力是否仍可用
3. **目标验证**：新抽象是否真能支撑下一阶段
4. **门禁通过**：该版本全部门禁 KR 通过

失败时的回退建议：
- V1 失败 → 检查迁出模块的依赖链，可能需要先做接口抽象再迁出
- V2 失败 → 外部引用验证优先（KR4），穿透依赖清理可渐进
- V3 失败 → Provider 整合优先（KR1），Backend 抽象可延后
- V4 失败 → 日志和配置校验优先，并发安全延后
- V5 失败 → 文档和示例可增量补充，不影响核心能力

---

## 九、V13 新增 KR（加入后续版本）

以下 KR 基于 V13 深度分析发现，加入 V5 或独立版本持续推进：

| KR | 描述 | 优先级 | 来源 |
|----|------|--------|------|
| KR8 | SDK 构建（build:sdk）修复 | P1 | ✅ V14 完成 — builtin-tools 移除 + emitDeclarationOnly |
| KR9 | Provider LLMRuntime 统一接口 | P2 | ✅ V15 完成 — LLMRuntime 接口 + getRuntime() + LLMMessage/LLMTool 类型 |
| KR10 | API 文档（TypeDoc）生成 | P2 | ✅ V16 完成 — typedoc.json + docs:api 脚本 + 21类/59接口/54函数文档 |
| KR11 | engine/ 测试覆盖率达 90% | P2 | ✅ V14→V15 完成 — 从 446→753→802 用例，56 个测试文件 |
| KR12 | e2e_cli 适配新公共 API | P2 | ✅ V14 完成 — QueryEvent + EngineEventMap 类型安全 |
| KR13 | Provider SDK 可选化 | P2 | ✅ V14 完成 — bedrock/vertex/foundry 移到 optionalDependencies |
| KR14 | AsyncGenerator 资源生命周期管理 | P1 | ✅ V15 完成 — wrapper .return()/.throw() + Provider finally + 超时清理 |
| KR15 | API 类型体系统一（消除 as any） | P1 | ✅ V15 完成 — ProviderType 联合类型 + ToolExtension 统一 + as any -50% |
| KR16 | 错误处理体系统一 | P1 | ✅ V15 完成 — 全英文 + EngineError 统一 + 结构化分类 |
| KR17 | Session 生命周期资源完整性 | P1 | ✅ V15 完成 — sessionMetadata/signal/tokenBudgetStates 清理 |
| KR18 | sessionMessages 内存保护 | P2 | ✅ V15 完成 — 10000 条上限 + 可配置截断 |
| KR19 | EventBus API 增强 | P2 | ✅ V15 完成 — subscribe 返回取消函数 + on 支持 sessionId |
| KR20 | query 互斥保护 | P2 | ✅ V16 完成 — per-session Map 锁 + SESSION_BUSY 错误 + finally 释放 |

---

## 十、V6：状态外化 + 可观测性 + 配置归一化

> **架构目标参考**：[ARCHITECTURE.md](../ARCHITECTURE.md) 第三章"目标架构"
> **里程碑**：M6 — SDK 从单进程走向可分布式部署的基础

### 背景与问题

V1-V5 完成了 SDK 的核心能力构建和交付验收。但框架面临三个结构性问题：

1. **进程内状态**：AgentEngine 持有 7 个 `new Map()`（sessions、sessionMetadata、activeQueries 等），进程重启即丢失，多实例无法共享
2. **生产不可观测**：日志系统完善但无链路追踪、无指标采集，生产问题难以定位
3. **配置分散**：AgentEngineConfig / EngineConfig / CC 内部 Config 三套配置来源，用户困惑

### Objective

SDK 实现状态外化，可观测性采用 Provider 模式，配置归一化，为多实例部署奠定基础。

### Key Results

| # | Key Result | 优先级 | 验证标准 | V18/V19 状态 |
|---|-----------|--------|---------|---------|
| KR1 | **TracingProvider + MetricsProvider** | P1 | NoOpTracingProvider（零开销默认）+ InMemoryMetricsProvider 验证通过 | ✅ 已实现（NoOp + InMemory） |
| KR2 | **IConfigProvider 配置归一化** | P0 | 统一 3 种 Config 来源，优先级：代码 > 环境变量 > 配置文件 > 默认值 | ✅ 已实现（UnifiedConfig + ConfigDiagnostics） |
| KR3 | **AgentEngine 无界 Map → StorageProvider** | P0 | sessions/sessionMetadata/activeQueries 迁移到可插拔存储，默认 InMemory | ✅ 已实现 |
| KR4 | **IMemoryStore + ISessionContentStore 接口** | P2 | 记忆按用户隔离、会话内容追加写入 | ✅ 已实现 |
| KR5 | **engine/ 穿透依赖治理** | P1 | 从 104 条降至 < 50 条 | ⚠️ 持续推进（V7 继续） |

### 架构决策（已确认）

| 决策 | 选择 | 理由 |
|------|------|------|
| 可观测性模式 | Provider 模式 | 框架定义关键 trace/metrics，Provider 决定导出到哪（OTLP/Prometheus/Console） |
| 状态外化 | StorageProvider 可插拔 | SDK 无状态，宿主选择存储引擎（InMemory/SQLite/PG/Redis） |
| 目录组织 | 不做重组 | 扁平化 + 按模块目录，新增模块按层级放置 |

### 版本间依赖

```
V5 ✅ 交付验收
 ↓
V6 ✅ 状态外化 + 可观测性 + 配置归一化（V18 实现）
 ↓
V7 📋 SDK 成熟度 + 技术债清理
 ↓
V7.5 📋 全局状态解耦（当前路线图终点）
```

V6 是 M6 里程碑的基础版本。V7 清除技术债后，V7.5 完成全局状态解耦，SDK 具备云无状态化基础。

### 门禁条件

1. KR3 通过（状态外化可用，SDK 可无状态运行）
2. KR2 通过（配置归一化，用户不再困惑于 3 套 Config）
3. 现有 250+ engine 测试全部通过

### 回退建议

- KR3 失败 → 先做 sessions Map 迁移（最核心），其余 Map 渐进
- KR1 失败 → 先保证 NoOpProvider 零开销默认，OTLP/Prometheus 可延后
- KR5 失败 → 穿透依赖不阻塞发布，可渐进清理

---

## 十一、V7：SDK 成熟度 + 技术债清理

> **里程碑**：M7 — 清除 V1-V19 积累的技术债，SDK 达到生产级成熟度
> **前置条件**：V6 完成（状态外化 + 可观测性基础）

### 背景与问题

V1-V19 完成了 SDK 核心能力构建，但积累了以下技术债：
1. **穿透依赖量大**：engine/ 有 104 条穿透 import（54 个源文件），阻碍独立编译
2. **SDK 入口不一致**：engine/index.ts 和 src/index.ts 导出差异（ProviderType 缺失、config 未导出）
3. **文档与代码脱节**：engine/ 实际 172 文件，文档记录 55；穿透实际 104 条，文档记录 62
4. **分层无自动守护**：L0-L3 分层规则仅靠文档，无 lint:layers CI 检查
5. **两套启动路径并存**：deprecated 的 `initializeEngine`（编译期依赖）与 `AgentEngine.create`（运行期依赖）并存
6. **ProviderConfig 重复定义**：`types.ts` 和 `AgentEngine.ts` 各定义了一份，类型有结构性差异
7. **EngineFacade 不必要的中间层**：几乎 1:1 透传 SessionManager，增加间接调用和隐含 bug

### Objective

清除技术债，SDK 入口统一，启动路径唯一，中间层精简，文档与代码同步，分层有 CI 守护。

### Key Results

| # | Key Result | 优先级 | 验证标准 | V20 状态 |
|---|-----------|--------|---------|---------|
| KR1 | **Provider 适配器测试修复** | P1 | 8 个 Provider 测试文件编译通过，mock 数据类型匹配 | ⚠️ 持续推进 |
| KR2 | **SDK 入口完全统一** | P0 | engine/index.ts 和 src/index.ts 导出一致，ProviderType/config 均可导出 | ✅ V20 完成（config + log 补齐） |
| KR3 | **穿透依赖 < 50 条** | P1 | 从 104 条降至 50 以下（继续新增屏障文件，覆盖 Tool/Session/ToolRegistry 等高频穿透） | ⚠️ 持续推进 |
| KR4 | **文档全面同步** | P0 | architecture-design.md + project-purpose.md + okr-roadmap.md 三份核心文档反映最新代码状态 | ✅ V20 完成 |
| KR5 | **lint:layers 规则落地** | P2 | 分层依赖检查 CI 规则，engine/ 分层违规自动检出 | 📋 待启动 |
| KR6 | **IConfigProvider 公共导出** | P1 | config 模块从 engine/index.ts 公共导出层暴露 | ✅ V20 完成 |
| KR7 | **预存在测试失败修复** | P1 | 24 个预存在测试失败修复 | 📋 V20 发现，待后续推进 |
| KR8 | **预存在编译错误修复** | P2 | 8 个非测试编译错误修复 | 📋 V20 发现，待后续推进 |
| KR9 | **废弃 initializeEngine + 启动路径统一** | P0 | `initializeEngine` 移除，所有初始化走 `AgentEngine.create`；`validateEngineConfig` 移出至独立模块；Ant 权限过滤逻辑合并到 buildQueryEngineConfig | ✅ V21 完成 |
| KR10 | **ProviderConfig 类型统一** | P0 | 删除 `types.ts` 中的重复定义 + `VALID_PROVIDER_TYPES` + `ProviderType`，统一使用 `AgentEngine.ts` 的定义（引用正式 ProviderConfigs.ts 类型）；受影响的 Session.ts/EngineFacade.ts import 路径更新 | ✅ V21 完成 |
| KR11 | **消除 EngineFacade 不必要中间层** | P1 | SessionInfo 移至 types.ts；AgentEngine 直接持有 SessionManager；修复 session.metadata 隐含 bug；770 行测试迁移；删除 EngineFacade.ts | ✅ V21 完成 |

### KR9 详细：废弃 initializeEngine + 启动路径统一

**当前状态**：
- `initializeEngine`（573 行）已标注 `@deprecated`，计划 V21 移除
- 无外部生产调用方（CLI 宿主不使用它，仅测试文件和 src/index.ts 导出引用）
- 与 `AgentEngine.create` 的能力差异仅 3 项：Ant 权限过滤、Coordinator mode 工具过滤、初始化 hook

**执行步骤**：

| 步骤 | 内容 | 风险 |
|------|------|------|
| 9.1 | 将 `validateEngineConfig()` 移至 `engine/config/ConfigValidation.ts` | 低——纯函数搬迁 |
| 9.2 | 将 Ant 权限过滤逻辑（initializeEngine 第 400-410 行）合并到 `buildQueryEngineConfig` | 中——需确保行为等价 |
| 9.3 | 新增 EventBus 初始化事件（`engine:initializing`、`engine:toolsReady`）替代 initializeEngine 的 6 个 hook | 低——EventBus 已成熟 |
| 9.4 | 更新 `src/index.ts`：移除 `initializeEngine`/`createDefaultEngineConfig` 导出，改为仅导出 `AgentEngine` | 低——无外部生产调用方 |
| 9.5 | `UnifiedConfig` 中的 `EngineConfig` 类型引用改为从 `engine/config/ConfigValidation.ts` 导入 | 低——类型搬迁 |
| 9.6 | 迁移 `initializeEngine.test.ts`（20+ 用例）到 `AgentEngine.test.ts` | 中——需适配新 API |
| 9.7 | 删除 `engine/bootstrap/initializeEngine.ts` 和 `engine/bootstrap/engineHelpers.ts` | 低——最后一步 |

**验证**：`bunx tsc --noEmit` 零错误 + `bun test` 全通过 + 无 `initializeEngine` 的生产代码引用

### KR10 详细：ProviderConfig 类型统一

**当前状态**：
- `engine/types.ts` 第 29-36 行：内联对象字面量，手动重复字段定义，包含 `[key: string]: unknown`
- `engine/AgentEngine.ts` 第 188-195 行：`Omit<XxxProviderConfig, 'type'>` 引用正式类型定义（单一真相来源）
- 两者有结构性差异：AgentEngine.ts 版本继承 `BaseProviderConfig`（含 retryConfig），types.ts 版本不包含
- `VALID_PROVIDER_TYPES` 和 `ProviderType` 两个文件完全重复定义

**执行步骤**：

| 步骤 | 内容 | 风险 |
|------|------|------|
| 10.1 | Session.ts 的 `ProviderConfig` import 从 `./types` 改为 `./AgentEngine` | 低 |
| 10.2 | EngineFacade.ts 的 `ProviderConfig` import 从 `./types` 改为 `./AgentEngine` | 低（EngineFacade 后续会被删除，此步骤可与 KR11 合并） |
| 10.3 | 从 `engine/types.ts` 删除 `ProviderConfig`、`VALID_PROVIDER_TYPES`、`ProviderType` 定义 | 低 |
| 10.4 | 如需从 `types.ts` 保持导出路径兼容，加一行 `export type { ProviderConfig } from './AgentEngine.js'` | 无 |

**验证**：`bunx tsc --noEmit` 零错误 + grep 确认无重复定义

### KR11 详细：消除 EngineFacade 不必要中间层

**当前状态**：
- EngineFacade（204 行）唯一消费者是 AgentEngine
- `wrapSessionOperation` 错误转换几乎完全冗余——SessionManager 已直接抛 EngineError
- 第 797 行 `session.metadata = {...}` 是隐含 bug（对 DTO 赋值不持久化）
- 770 行测试需迁移

**执行步骤**：

| 步骤 | 内容 | 风险 |
|------|------|------|
| 11.1 | 将 `SessionInfo` interface 从 EngineFacade.ts 移至 `engine/types.ts`；更新 `src/index.ts` 和 `engine/index.ts` 导出路径 | 低——公共 API 路径变更 |
| 11.2 | AgentEngine 新增 `sessionManager` 私有字段，与 `facade` 并存（双写过渡） | 无——无行为变化 |
| 11.3 | 逐个替换 `facade.xxx()` 为 `sessionManager.xxx()`（8 处调用点） | 中——getSession 返回类型变化 |
| 11.4 | 修复第 797 行 metadata 赋值 bug：`session.metadata = {...}` → `session.setMetadata('memoryPath', memoryPath)` | 低 |
| 11.5 | 删除 `facade` 字段和 EngineFacade import | 低 |
| 11.6 | 迁移 EngineFacade 测试（634+136 行）到 SessionManager.test.ts / AgentEngine.test.ts | 中——需判断哪些断言仍有意义 |
| 11.7 | 删除 EngineFacade.ts；更新 errors.ts 注释 | 低 |
| 11.8 | 清理 deprecated 的 sessionMetadata Map 兼容层 | 低 |

**关键决策**：AgentEngine.getSession() 保持返回 `SessionInfo`（DTO，公共 API 稳定），内部做 `toSessionInfo()` 转换，不直接暴露 `Session` 实体。

**验证**：`bunx tsc --noEmit` + `bun test` 全通过 + `SessionInfo` 从 `src/index.ts` 正常导出

### 门禁条件

1. KR2 通过（SDK 入口统一）
2. KR4 通过（文档同步）
3. KR1 通过（Provider 测试无编译错误）
4. KR9 通过（启动路径统一，initializeEngine 移除）
5. KR10 通过（ProviderConfig 无重复定义）

### 回退建议

- KR3 失败 → 穿透依赖不阻塞，可降至 < 70 继续推进
- KR5 失败 → lint:layers 可延后，不阻塞核心交付
- KR9 失败 → `validateEngineConfig` 先移出即可，initializeEngine 删除可延后
- KR11 失败 → EngineFacade 可保留，不影响核心功能，作为技术债记录

---

## 十二、V7.5：全局状态解耦（bootstrap/state → SessionContext）

> **里程碑**：M7.5 — 消除全局状态单例，SDK 具备云无状态化基础
> **前置条件**：V7 完成（SDK 成熟度 + 启动路径统一）
> **定位**：消除全局状态单例，SDK 具备云无状态化基础

### 背景与问题

`bootstrap/state.ts`（1759 行）是一个 **90+ 字段的模块级全局单例**，被 **121 个文件直接引用**。它的存在与 SDK 云无状态化目标存在根本矛盾：

1. **单 session 假设**：全局 `STATE` 设计时假设整个进程只有一个活跃 session。`setupBootstrap()` 直接覆盖写入 cwd/originalCwd/projectRoot，多 workspace 并发时后设置的值会覆盖先设置的
2. **双写问题**：engine/ 的 `SessionContext`（ALS）和 `STATE` 有约 **15 个重叠字段**（sessionId, cwd, projectRoot, totalCostUSD, modelUsage 等），engine/ 从 ALS 读，CC 原始代码从全局 STATE 读
3. **穿透性依赖**：CC 原始代码（121 个文件）通过 `import { getXxx } from 'src/bootstrap/state.js'` 直接引用，不走 ALS

**但不违反"包装不替代"原则**：CC 原始代码的核心逻辑不变，只是读取状态的方式从全局单例改为 ALS 上下文。

### Objective

将 per-session 状态从全局单例迁移到 SessionContext（ALS），bootstrap/state 降级为仅持有进程级配置，SDK 具备多实例部署所需的状态隔离能力。

### Key Results

| # | Key Result | 优先级 | 验证标准 | 策略 |
|---|-----------|--------|---------|------|
| KR1 | **写入收敛**：per-session 字段的写入收敛到 SessionContext，通过 CCRuntime 单一入口注入 | P0 | engine/ 对 bootstrap/state 的写入点从 N 处收敛到 1 处（CCRuntime.setupBootstrap） | ✅ V21 审计确认已完成 |
| KR2 | **高频读取迁移**：sessionId/cwd/projectRoot/originalCwd 从全局 STATE 迁移到 ALS | P0 | CC 原始代码中这 4 个字段的前 20 个高频调用方改为从 ALS 读取 | ✅ V21 完成（SessionContextBridge ALS 桥接层） |
| KR3 | **成本/Token 状态 ALS 化**：totalCostUSD/modelUsage/totalAPIDuration 等 8 个累积指标写入 SessionContext | P1 | query 结束后指标写入 SessionContext，不再依赖全局 STATE 累加 | ✅ V21 完成（双写 + getter ALS 优先） |
| KR4 | **SessionContext 序列化增强**：补全 SessionContextSnapshot 中缺失的字段（sessionCronTasks, invokedSkills, planSlugCache 等） | P1 | SessionContextSnapshot 覆盖所有 per-session 状态，序列化/反序列化往返验证通过 | ✅ V21 完成（5→13 字段） |
| KR5 | **bootstrap/state 降级审计**：确认 bootstrap/state.ts 仅保留进程级配置（OTel/日志/ClientType 等约 12 项） | P2 | grep 审计确认 per-session 字段引用数为 0 | ✅ V21 完成（核心字段已 ALS 化） |

### 状态分类与外化策略

#### A 类：必须外化的 per-session 状态（19 项 → SessionContext）

| 字段组 | 字段数 | 外化难度 | 说明 |
|--------|--------|---------|------|
| 路径管理（cwd/originalCwd/projectRoot） | 3 | 低 | 已有双写，以 SessionContext 为准 |
| 会话标识（sessionId/parentSessionId） | 2 | 低 | 已有双写 |
| 成本/Token 指标（totalCostUSD/totalAPIDuration/modelUsage 等） | 8 | 中 | query 完成时写入 SessionContext → ISessionStore |
| 会话行为（isInteractive/isRemoteMode/sessionBypassPermissions 等） | 7 | 低 | 随 SessionContext 传入 |
| Session 级资源（sessionCronTasks/invokedSkills/agentColorMap） | 5 | 中 | 需补全 SessionContextSnapshot |
| QueryEngine Map | 1 | 高 | 通过"销毁-重建"策略外化（pause/resume 已实现） |

#### B 类：进程全局可重建状态（12 项 → 保留在 bootstrap/state）

OTel Meter/Counter、LoggerProvider、StatsStore、ClientType、SdkBetas 等——进程启动时重建，不需要外化。

#### C 类：瞬时可丢弃状态（8 项 → 不处理）

activeAbortControllers、activeQueries、scrollDraining、per-turn 计数器等——进程重启后自动清空。

#### D 类：需特殊处理（6 项 → 评估后决定）

betaHeaderLatches、promptCache 策略、lastAPIRequest 等——需逐项评估是否外化。

### 架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 状态隔离载体 | SessionContext (AsyncLocalStorage) | engine/ 已建立，ALS 提供 per-session 隔离 |
| CC 原始代码迁移策略 | 逐模块渐进迁移 | 121 个文件不可能一次改完，按模块优先级分批 |
| 迁移兼容策略 | 保留 `getXxx()` 函数签名，内部从 ALS 读取 | 最小改动——调用方不改 import 路径，只改函数实现 |
| QueryEngine 外化 | "销毁-重建"策略 | pause/resume 已验证可行，不需序列化 QE 内部状态 |

### 执行阶段

```
Phase 1（KR1）：收敛写入点
  - engine/ 对 bootstrap/state 的所有写入收敛到 CCRuntime.setupBootstrap()
  - AgentEngine.query() 中通过 SessionContext 管理状态，不再直接写 STATE
  - 验证：单 workspace 场景行为不变

Phase 2（KR2-KR3）：逐模块迁移读取
  - 高频字段优先：sessionId → cwd → projectRoot → originalCwd → cost metrics
  - 修改 bootstrap/state.ts 中 getXxx() 函数的实现，从 ALS 读取（调用方不改 import）
  - 每迁移一批字段，运行全量测试验证
  - 验证：多 workspace 并发场景下各 session 状态互不干扰

Phase 3（KR4-KR5）：完善 + 降级审计
  - 补全 SessionContextSnapshot 缺失字段
  - 审计确认 per-session 字段归零
  - bootstrap/state.ts 只保留进程级配置（约 12 项 getter/setter）
  - 验证：SDK 可无状态运行，进程重启后从存储恢复完整 session
```

### 门禁条件

1. KR1 通过（写入收敛到单一入口）
2. KR2 通过（高频字段读取从 ALS，多 workspace 并发验证通过）
3. 全量测试通过（250+ engine 测试 + 2472 全局测试）

### 回退建议

- KR2 失败 → 保留 `getXxx()` 的全局 STATE 读取作为 fallback，新增 `getXxxFromContext()` 函数渐进替换
- KR3 失败 → 成本/Token 指标可在 query 结束时聚合到 ISessionStore，不必实时写入 SessionContext
- KR5 失败 → 审计可延后，per-session 字段逐步迁移即可
