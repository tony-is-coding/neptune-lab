# V6 框架深度分析报告 — 核心层架构持续解耦

> 生成时间：2026-04-26
> 基于 V5 后续待办，聚焦架构优化主线
> 三方并行研究：核心层扫描 + 文档体系扫描 + 使用者视角分析

---

## 一、框架现状分析

### 1.1 V1~V5 成果回顾

| 版本 | 主题 | 核心成果 |
|------|------|----------|
| V1 | 初始优化 | 基础解耦启动 |
| V2 | 类型层解耦 | 核心类型提取 |
| V3 | 核心类型层 | CanUseToolFn、SpinnerMode、L1-L4分层标准 |
| V4 | 架构分层进阶 | QueryEngine UI解耦、lint:layers、engine/index.ts、LogUtil统一 |
| V5 | 核心层深度解耦 | CoreTool/UITool分离、EngineState(18字段)、HookCore(零React) |

### 1.2 当前架构分层状态

```
Layer 4: UI (REPL.tsx, components/, hooks/)        — 165个 .tsx 文件
Layer 3: Orchestration (QueryEngine.ts, query.ts)   — 与 Layer 4 双向依赖
Layer 2: Services (services/, utils/, memdir/)       — 部分 UI 耦合
Layer 1: Engine (engine/)                            — 零 UI 依赖（已验证 ✅）
Layer 0: Packages (builtin-tools/)                   — UI.tsx 可选分离
```

**积极发现：**
- `engine/` 目录完全零 React/Ink 依赖（搜索 `import React`、`import ink`、`.tsx` 均为零匹配）
- EngineState 纯 TypeScript、EventBus 发布/订阅、facade 模式设计良好
- ToolAdapter 的 CoreTool/UITool 转换机制已就绪
- 记忆系统通过 AsyncLocalStorage 实现了 per-session 隔离
- 权限核心逻辑 `hasPermissionsToUseTool()` 完全独立于 React

### 1.3 当前残余问题

经过五轮优化，以下结构性问题仍然存在：

| 问题 | 规模 | 对 SDK 的阻塞程度 |
|------|------|-------------------|
| REPL.tsx 核心逻辑与 UI 深度绑定 | 6,314行 | 间接阻塞 |
| QueryEngine 通过 AppState 回调耦合 UI | 1,317行 | 阻塞 |
| AppState 60+ 字段混合核心与 UI | 657行(Store) | 阻塞 |
| Provider 缺少统一适配器接口 | 3,483行(claude.ts) | 阻塞(多provider) |
| SDK 无法独立发布为 npm 包 | — | 直接阻塞 |
| SDKMessage 类型过于宽泛 | — | 阻塞(开发体验) |
| ISessionStore 同步签名限制 | — | 阻塞(异步存储) |
| 权限系统缺少中间路径 | — | 阻塞(生产级SDK) |

---

## 二、框架目标对齐分析

| 项目目标 | 当前进度 | 差距 | 优化关联 |
|----------|----------|------|----------|
| 嵌入业务应用、随宿主进程启动 | 70% | 无法独立 npm 包使用，必须 clone 整个仓库 | O-SDK1 |
| 承载多 Session 并发 | 80% | ISessionStore 同步签名、bootstrap/state.ts 全局单例 | O-FUNC2、O-ARCH4 |
| 支持暂停/恢复/重启 | 90% | 基本可用，pause 释放 QueryEngine 资源 | — |
| 被 CLI/Web/App/服务端复用 | 60% | SDK 类型不安全、Provider 不支持 per-session 切换 | O-FUNC1、O-ARCH2 |
| 最小改动现有代码 | ✅ 已遵循 | — | 全局约束 |
| 核心 agent loop 尽量不变 | ✅ 已遵循 | — | 全局约束 |

---

## 三、优化清单（TOP 10，按优先级排序）

### 优化 1：O-SDK1 独立包发布能力

**优化重点**：框架当前无法脱离 claude-code 完整代码树独立使用，需要构建 npm 包发布能力

**优化目标**：开发者可以通过 `npm install @anthropic/agent-engine` 安装并使用框架

**关键结果**：
- KR1：构建流水线产出 `dist/` 目录（含 `.js` + `.d.ts` + `.js.map`）
- KR2：E2E 项目可通过 npm 包名引用框架（不再需要相对路径）
- KR3：package.json 声明 `exports` 字段，支持 ESM/CJS 双格式

**预期收益**：框架可独立分发，接入成本从"clone 整个仓库"降低到"npm install"

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，纯构建层改动
- 正向影响：降低接入门槛、支持版本管理、支持语义化版本
- 负面影响：需要维护构建配置、需要处理 CC 原始代码的打包策略
- 实施风险评估：中等 — CC 原始代码树庞大（48.4万行），需要精确的 tree-shaking 或手动指定导出范围

**符合框架目标**：嵌入业务应用、降低接入成本

**依赖关系**：无前置依赖，但与 O-FUNC1（类型标准化）协同

---

### 优化 2：O-ARCH1 QueryEngine/AppState UI 依赖解耦

**优化重点**：QueryEngine 通过 `getAppState()`/`setAppState()` 回调读写包含 60+ UI 字段的 AppState 类型，是 SDK 与 UI 耦合的根源

**优化目标**：QueryEngine 仅依赖核心运行时状态（EngineState），不再接触 UI 字段

**关键结果**：
- KR1：`QueryEngineConfig` 的 `getAppState`/`setAppState` 类型收窄为仅包含核心字段（≤20个）
- KR2：REPL.tsx 中对 UI 字段的读写通过独立通道（如 useUIState hook），不再经过 QueryEngine
- KR3：SDK 模式下 QueryEngine 可在不提供任何 UI 字段的情况下正常工作

**预期收益**：SDK 模式不再需要初始化完整的 AppState，减少内存占用和依赖复杂度

**对框架的影响**：
- 是否破坏"包装不替代"原则：不破坏 — QueryEngine 本身不变，仅改变其配置接口的形状
- 正向影响：QueryEngine 可在 headless 环境下更轻量运行
- 负面影响：需要逐一审计 QueryEngine 内部对 AppState 字段的实际使用，确保核心路径不依赖 UI 字段
- 实施风险评估：高 — AppState 被约 173 个文件引用，改动影响面广

**符合框架目标**：核心 agent loop 尽量不变（通过收窄配置接口实现，不改 loop 内部）

**依赖关系**：无严格前置依赖，但建议在 EngineState 已稳定的基础上进行

---

### 优化 3：O-ARCH2 Provider 适配器统一接口

**优化重点**：当前 7 种 AI Provider（firstParty/bedrock/vertex/foundry/openai/gemini/grok）缺少统一接口，选择逻辑散布在环境变量和 if-else 链中

**优化目标**：定义 `ProviderAdapter` 统一接口，支持 per-session Provider 配置

**关键结果**：
- KR1：定义 `ProviderAdapter` 接口（query/convertMessages/convertTools/streamAdapter）
- KR2：`AgentEngineConfig` 支持 `provider` 配置项，不再仅依赖环境变量
- KR3：`createSession()` 或 `query()` 支持 per-session 的 Provider 覆盖

**预期收益**：多模型切换、A/B 测试、成本优化、fallback 策略成为可能

**对框架的影响**：
- 是否破坏"包装不替代"原则：不破坏 — 包装现有 Provider 代码，不自建 LLM 调用
- 正向影响：多 Provider 支持、per-session 灵活配置、统一的错误处理
- 负面影响：需要抽象 claude.ts（3,483行）中的核心逻辑
- 实施风险评估：中等 — 各 Provider 适配器模式基本一致（流适配器），但 claude.ts 过大

**符合框架目标**：嵌入业务应用、支持更多使用场景

**依赖关系**：建议在 O-ARCH1 后进行（AppState 解耦后 Provider 配置更清晰）

---

### 优化 4：O-ARCH3 REPL.tsx 查询编排逻辑抽取

**优化重点**：REPL.tsx 6,314行中约 500 行的查询编排逻辑（onQuery、executeUserInput、QueryGuard）与 React state 深度绑定

**优化目标**：将查询编排逻辑抽取为独立的 `REPLEngine` 类，REPL.tsx 仅保留 UI 渲染

**关键结果**：
- KR1：`REPLEngine` 类封装查询编排 + 状态管理，零 React 依赖
- KR2：REPL.tsx 通过 `useREPLEngine()` hook 与 REPLEngine 交互
- KR3：`REPLEngine` 可在非 React 环境（测试、headless）中独立使用

**预期收益**：查询编排逻辑可复用、可测试；REPL.tsx 行数减少约 500-800 行

**对框架的影响**：
- 是否破坏"包装不替代"原则：不破坏 — 查询编排逻辑本就是框架建设，不是 CC 原始能力
- 正向影响：查询编排可测试、可复用、UI 与逻辑分离
- 负面影响：60+ hooks 的调用顺序耦合使拆分风险较高
- 实施风险评估：极高 — hooks 闭包共享 ref 状态，feature-gated 条件导入增加复杂度

**符合框架目标**：核心能力解耦、支持非 CLI 宿主

**依赖关系**：建议在 O-ARCH1 后进行（AppState 解耦后查询编排的依赖更清晰）

---

### 优化 5：O-FUNC1 SDK 消息类型标准化

**优化重点**：`query()` 返回的 `SDKMessage = { type: string; [key: string]: unknown }` 过于宽泛，使用者缺乏类型安全

**优化目标**：提供类型安全的消息联合类型和便捷的消费 API

**关键结果**：
- KR1：定义 `QueryEvent` 联合类型（assistant | tool_use | tool_result | system | error），每个变体有明确的 payload 类型
- KR2：提供 `collectText()` 便捷方法，自动拼接助手回复的完整文本
- KR3：提供 `waitForResult()` 便捷方法，等待查询完成并返回最终结果

**预期收益**：SDK 使用者获得 IDE 类型提示、减少运行时类型错误、降低接入学习成本

**对框架的影响**：
- 是否破坏"包装不替代"原则：不破坏 — 纯新增类型定义
- 正向影响：开发体验大幅提升、文档可从类型自动生成
- 负面影响：无
- 实施风险评估：低 — 纯类型层改动，不影响运行时行为

**符合框架目标**：降低接入成本、API 接口清晰稳定

**依赖关系**：无前置依赖

---

### 优化 6：O-FUNC2 ISessionStore 异步接口改造

**优化重点**：`ISessionStore` 接口方法为同步签名（`save/load/delete/list`），但实际使用场景（PostgreSQL、Redis）需要异步操作

**优化目标**：`ISessionStore` 接口方法改为异步（`async save/load/delete/list`），支持异步存储后端

**关键结果**：
- KR1：`ISessionStore` 接口方法签名改为 `Promise<T>` 返回类型
- KR2：`InMemorySessionStore` 和 `SQLiteSessionStore` 适配新接口
- KR3：`SessionManager` 内部调用 `ISessionStore` 处改为 `await`
- KR4：E2E 项目的 `pg-session-store.ts` 可直接实现 `ISessionStore` 接口

**预期收益**：框架原生支持异步存储后端（PG、Redis、MongoDB），E2E 不再需要绕过框架

**对框架的影响**：
- 是否破坏"包装不替代"原则：不破坏 — 纯接口改造
- 正向影响：存储层扩展性、真实业务场景适配
- 负面影响：接口签名变更，需要确保所有调用方适配
- 实施风险评估：低 — 接口改动明确，影响面可控

**符合框架目标**：支持更多使用场景、降低接入成本

**依赖关系**：无前置依赖

---

### 优化 7：O-ARCH4 权限系统中间路径

**优化重点**：当前权限系统只有两个极端 — bypass（跳过所有检查）和交互式（弹出 UI 对话框），缺少生产级 SDK 需要的"自动决策"中间路径

**优化目标**：提供可编程的权限决策接口，SDK 使用者可注入自定义权限策略

**关键结果**：
- KR1：定义 `PermissionDelegate` 接口（`onToolAccess(toolName, input) => allow/deny/ask`）
- KR2：`AgentEngineConfig.permissions` 支持 `delegate` 配置项
- KR3：`OriginalQueryEngineBridge` 在非 bypass 模式下使用 delegate 决策，而非硬编码 allow

**预期收益**：生产级 SDK 可实现细粒度权限控制（如"只读操作自动放行、写操作自动拒绝"）

**对框架的影响**：
- 是否破坏"包装不替代"原则：不破坏 — 包装 `canUseTool` 的决策路径
- 正向影响：权限系统灵活性、安全性和易用性兼顾
- 负面影响：需要确保 delegate 的异步决策不阻塞查询循环
- 实施风险评估：中等 — 需要在 QueryEngine 的工具执行路径中插入 delegate 调用

**符合框架目标**：安全优先、支持更多使用场景

**依赖关系**：建议在 O-ARCH1 后进行（QueryEngine 配置接口收窄后更容易插入 delegate）

---

### 优化 8：O-ARCH5 engine/ 层级标准补全与文档同步

**优化重点**：engine/ 目录在分层架构标准中没有明确的层级定义，多份设计文档与代码不同步

**优化目标**：为 engine/ 建立明确的层级标准，同步文档与代码

**关键结果**：
- KR1：`architecture-layering-standard.md` 新增 engine/ 层级定义（L0.5 或独立层）
- KR2：`architecture-design.md` 中 AgentEngineConfig 的 permissions 位置与代码对齐
- KR3：为 EngineState、HookCore、CCRuntime 补充独立设计文档（至少关键设计决策记录）

**预期收益**：架构规范完整、新成员可快速理解框架设计、文档与代码一致

**对框架的影响**：
- 是否破坏"包装不替代"原则：不破坏 — 纯文档改动
- 正向影响：架构可维护性、知识传递
- 负面影响：无
- 实施风险评估：低

**符合框架目标**：清晰的架构、完善的文档

**依赖关系**：无前置依赖

---

### 优化 9：O-QUAL1 腐朽代码清理

**优化重点**：`getSettings_DEPRECATED` 在 12 个文件中使用（含 `any` 类型导出），console 替换仅完成 5/131 处

**优化目标**：清理 `getSettings_DEPRECATED` 调用链，推进 console → LogUtil 替换

**关键结果**：
- KR1：`getSettings_DEPRECATED` 调用全部迁移到 `getSettings()` 或直接删除
- KR2：console 替换进度达到 50%（66/131处）
- KR3：`export type getSettings_DEPRECATED = any` 类型导出删除

**预期收益**：减少技术债、提升类型安全性、统一日志系统

**对框架的影响**：
- 是否破坏"包装不替代"原则：不破坏 — 清理的是框架建设层代码
- 正向影响：代码质量、可维护性
- 负面影响：无
- 实施风险评估：低 — 每处改动独立，不影响核心逻辑

**符合框架目标**：提升系统稳定性和可维护性

**依赖关系**：无前置依赖

---

### 优化 10：O-QUAL2 CI/CD 与测试补全

**优化重点**：项目没有 CI/CD 配置，多个核心模块（Bridge、LogUtil、SkillLoader、HookCore）缺少测试

**优化目标**：建立基础 CI 流水线，核心模块测试覆盖率达到 80%+

**关键结果**：
- KR1：GitHub Actions 配置 `ci.yml`（typecheck + lint + test）
- KR2：OriginalQueryEngineBridge 单元测试覆盖核心桥接逻辑
- KR3：HookCore 单元测试覆盖通知/配置变更 Hook 执行路径

**预期收益**：代码质量守护、回归测试自动化、PR 合并前自动验证

**对框架的影响**：
- 是否破坏"包装不替代"原则：不破坏 — 纯工具链改动
- 正向影响：开发效率、代码质量保障
- 负面影响：CI 运行时间需要优化（CC 原始代码量大）
- 实施风险评估：低 — CI 配置是增量改动

**符合框架目标**：清晰的架构、完善的测试、规范的开发流程

**依赖关系**：无前置依赖，但 O-ARCH1 完成后 Bridge 测试更容易编写

---

## 四、优化点依赖关系

```
独立可启动：
  O-SDK1（独立包发布）     O-FUNC1（消息类型标准化）     O-FUNC2（SessionStore异步）
  O-ARCH5（文档同步）       O-QUAL1（腐朽代码清理）       O-QUAL2（CI/CD）

推荐顺序：
  O-ARCH1（AppState解耦）  ──→  O-ARCH2（Provider适配器）  ──→  O-ARCH3（REPL拆分）
                │                        │
                └──→  O-ARCH4（权限中间路径）
```

---

## 五、自我检验记录

| 检验项 | 结果 |
|--------|------|
| 是否完整阅读了所有核心文档 | ✅ project-purpose.md、architecture-design.md、architecture-layering-standard.md |
| 目标对齐分析是否有事实依据 | ✅ 基于 Agent #3 的 SDK 使用流程分析、E2E 项目痛点 |
| TOP 10 优化点是否基于实际代码问题 | ✅ 基于 3 个并行 agent 对代码库、文档体系、使用者视角的全面扫描 |
| 每个优化建议是否考虑了架构影响 | ✅ 每个优化点均评估了"包装不替代"原则、正向/负面影响、实施风险 |
| 是否有遗漏的重要问题 | 已覆盖：REPL拆分、AppState解耦、Provider适配器、SDK独立化、类型安全、存储异步、权限中间路径、文档同步、腐朽代码、CI/CD |
| 是否与 V5 后续待办对齐 | ✅ O15(REPL拆分) → O-ARCH3, O2(Provider) → O-ARCH2, O7(SessionStorage) 已由框架 SessionStore 覆盖, O8(QueryDeps) → O-ARCH1, O11(Permission) → O-ARCH4, O12(Memory) → 已基本可用 |

---

## 六、后续行动建议

### 建议执行批次

**第一批（低风险高收益，可并行）：**
- O-FUNC1 SDK 消息类型标准化
- O-FUNC2 ISessionStore 异步接口改造
- O-ARCH5 文档同步
- O-QUAL1 腐朽代码清理
- O-QUAL2 CI/CD 与测试补全

**第二批（核心架构，串行）：**
- O-ARCH1 QueryEngine/AppState UI 依赖解耦
- O-ARCH2 Provider 适配器统一接口
- O-ARCH4 权限系统中间路径

**第三批（高难度，按需）：**
- O-ARCH3 REPL.tsx 查询编排逻辑抽取
- O-SDK1 独立包发布能力

### V5 待办映射

| V5 待办 | V6 对应优化 | 状态变化 |
|---------|------------|----------|
| O15 REPL.tsx 拆分 | O-ARCH3 | 保留，风险评估为极高，调整为第三批 |
| 剩余工具 UI 分离 | — | 降为持续改进项（不影响 SDK 核心能力） |
| O2 Provider 适配器 | O-ARCH2 | 保留，升级为独立优化项 |
| O7 SessionStorage | O-FUNC2 | 由框架 SessionStore 覆盖，聚焦异步接口 |
| O8 QueryDeps 依赖注入 | O-ARCH1 | 演进为 AppState 解耦 + QueryEngine 配置收窄 |
| O11 Permission | O-ARCH4 | 保留，扩展为可编程权限决策 |
| O12 Memory | — | 已基本可用（per-session 隔离已实现），降为持续改进项 |

---

## 七、数据来源

| 数据来源 | 覆盖范围 | 关键发现 |
|----------|----------|----------|
| Agent #1 核心层扫描 | src/ 全目录（48.4万行） | 巨文件清单、engine/零UI验证、QueryEngine结构、Provider现状 |
| Agent #2 文档体系扫描 | docs/ 全目录（17个文件） | 文档与代码3处不一致、5个缺失设计文档、分层标准缺口 |
| Agent #3 使用者视角 | engine/index.ts、E2E项目、测试目录 | SDK 5大痛点、接入成本评估、功能完整性缺口 |
