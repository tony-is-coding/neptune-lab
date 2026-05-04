# V18 工作总结

> 版本：V18
> 日期：2026-04-28
> 主题：状态外化 + 可观测性 + 配置归一化
> 对应 OKR：V6（M6 里程碑起始版本）

---

## 一、版本概述

V18 是 Agent Engine SDK 从单进程走向可分布式部署的奠基版本。核心改动集中在三个方向：**将 AgentEngine 的进程内状态外化到可插拔存储**、**引入 Tracing/Metrics 可观测性 Provider**、**归一化三套配置系统**。同时完成了全局单例多实例冲突解决、类型屏障补齐、存储接口扩展等架构治理工作。

**关键数据**：15 个任务全部完成，新增 6 个接口 + 6 个实现，改动 55 个文件，新增 4,882 行代码。

---

## 二、变化清单

### 新增

| 类别 | 内容 | 影响范围 |
|------|------|---------|
| 接口 | `ITracingProvider` — 链路追踪 Provider 接口 | `engine/observability/` |
| 接口 | `IMetricsProvider` — 指标采集 Provider 接口 | `engine/observability/` |
| 接口 | `IConfigProvider` — 统一配置读取接口 | `engine/config/` |
| 接口 | `IMemoryStore` — 按用户隔离的记忆存储接口 | `engine/storage/` |
| 接口 | `ISessionContentStore` — 按会话的追加写入存储接口 | `engine/storage/` |
| 类型 | `UnifiedConfig` — 三套配置归一化类型 | `engine/config/` |
| 类型 | `ConfigDiagnostics` / `ConfigSummary` — 配置诊断工具 | `engine/config/` |
| 实现 | `NoOpTracingProvider` — 零开销默认追踪实现 | `engine/observability/` |
| 实现 | `InMemoryMetricsProvider` — 内存指标采集（测试用） | `engine/observability/` |
| 实现 | `NoOpConfigProvider` — 零开销默认配置实现 | `engine/config/` |
| 实现 | `InMemoryMemoryStore` — 内存记忆存储 | `engine/storage/` |
| 实现 | `InMemorySessionContentStore` — 内存会话内容存储 | `engine/storage/` |
| 屏障 | 6 个类型屏障文件（tool/fileHistory/attribution/model/mcp/sessionHooks） | `engine/types/` |
| 诊断 | 配置决策链诊断日志 + 配置摘要输出 | `engine/config/ConfigDiagnostics.ts` |
| 注解 | `@planned` 注解标记待接入的代码（CircuitBreaker/LLMRuntime） | `engine/provider/` |

### 修改

| 类别 | 内容 | 影响范围 |
|------|------|---------|
| 重构 | `ISessionStore` 支持 write-through 持久化模式 | `engine/storage/` |
| 重构 | `SessionManager` 以 store 为主存储，启动自动恢复 | `engine/SessionManager` |
| 重构 | `AgentEngine` 全局单例迁移到实例级（TokenBudgetManager） | `engine/AgentEngine` |
| 重构 | `EngineState` DI 重构，工厂函数依赖注入 | `engine/EngineState` |
| 重构 | `CoreAppStateFactory` 消除 value import 穿透 | `engine/state/` |
| 修复 | `Session.pause/resume` 上下文保存（transcript 重新读取） | `engine/AgentEngine` |
| 重构 | `EngineFacade.sessionMetadata` 废弃，统一到 Session 实体 | `engine/EngineFacade` |
| 修改 | `engine/types/index.ts` 增加 7 个屏障文件导出 | `engine/types/` |
| 修改 | Bridge 层 `buildQueryEngineConfigFromOptions` 向后兼容 | `engine/bridge/` |
| 修改 | 6 个测试文件适配新接口和类型 | `engine/__tests__/` |

---

## 三、新增特性列表

### 特性 1：可观测性 Provider（ITracingProvider + IMetricsProvider）

**描述**：SDK 现在具备生产级可观测性基础。框架定义追踪和指标接口，宿主决定导出到哪里（OTLP/Prometheus/Console）。

**使用方式**：
```typescript
const engine = await AgentEngine.create({
  tracingProvider: new OTLPTracingProvider(), // 自定义实现
  metricsProvider: new PrometheusMetricsProvider(), // 自定义实现
})
```

**影响范围**：`engine/observability/` 目录。默认 NoOp 实现零开销，不影响现有用户。

---

### 特性 2：统一配置系统（UnifiedConfig + IConfigProvider）

**描述**：三套配置来源（AgentEngineConfig / EngineConfig / SettingsJson）归一化为 `UnifiedConfig`，每个配置字段的决策来源可追踪。

**使用方式**：
```typescript
// 配置诊断 — debug 模式下自动打印每个字段的决策来源
DEBUG=1 node app.js
// 输出：config resolved: model = claude-3.5-sonnet (source: agentConfig, overrides: envModel=none)
```

**影响范围**：`engine/config/` 目录。AgentEngine.create() 行为等价，但内部配置转换更清晰。

---

### 特性 3：Session 持久化支持（ISessionStore write-through）

**描述**：SessionManager 以 ISessionStore 为主存储，所有 session 操作 write-through 到存储层。进程重启后可自动恢复。

**使用方式**：
```typescript
const engine = await AgentEngine.create({
  sessionStore: new SQLiteSessionStore('./sessions.db'),
})
// 创建 session → 自动写入 store
// 进程重启 → 自动恢复全部 session
```

**影响范围**：`engine/SessionManager`、`engine/storage/`。默认 InMemory 行为不变。

---

### 特性 4：多实例安全（全局单例迁移）

**描述**：TokenBudgetManager 从全局单例迁移到 AgentEngine 实例级，多个 AgentEngine 实例可安全共存。

**使用方式**：
```typescript
const engine1 = await AgentEngine.create({ /* config1 */ })
const engine2 = await AgentEngine.create({ /* config2 */ })
// 两个引擎的 token budget 完全独立
```

**影响范围**：`engine/AgentEngine`、`engine/session/TokenBudgetManager`。保留全局 fallback 确保向后兼容。

---

### 特性 5：记忆存储与内容存储接口（IMemoryStore + ISessionContentStore）

**描述**：补齐存储层缺失的两个接口。记忆按用户隔离，会话内容支持追加写入。

**使用方式**：
```typescript
const engine = await AgentEngine.create({
  memoryStore: new RedisMemoryStore(), // 自定义实现
  sessionContentStore: new PGSessionContentStore(), // 自定义实现
})
```

**影响范围**：`engine/storage/` 目录。默认 InMemory 实现，现有行为不变。

---

### 特性 6：类型屏障文件补齐

**描述**：新增 6 个 `engine/types/` 屏障文件，消除 engine/ 向 src/ 的穿透依赖。

**影响范围**：`engine/types/` 目录。engine/ 内部 import 路径指向屏障文件，不再直接穿透到 `src/` 根文件。

---

### 特性 7：Session 暂停恢复修复

**描述**：修复 pauseSession 后恢复时对话上下文丢失的问题。pause 时保存 transcript，resume 时重新读取历史消息。

**使用方式**：
```typescript
await engine.pauseSession(sessionId)
// ... 进程可安全停止
await engine.resumeSession(sessionId)
// 恢复后对话上下文完整
```

**影响范围**：`engine/AgentEngine.pauseSession/resumeSession`。

---

## 四、用户体验改进

| 改进项 | 改进前 | 改进后 |
|--------|--------|--------|
| 配置诊断 | 三套配置冲突无法定位 | debug 模式下可查看每个字段的决策来源和覆盖链 |
| Session 持久化 | 进程重启 Session 全部丢失 | 支持可插拔存储，重启自动恢复 |
| 多实例部署 | 全局单例导致状态污染 | 多个 AgentEngine 实例独立运行 |
| Session 暂停恢复 | 恢复后上下文丢失 | 恢复后对话历史完整 |
| 可观测性 | 无链路追踪、无指标 | Provider 模式，可对接 OTLP/Prometheus |
| 配置使用 | 三套配置来源混乱 | 统一为 AgentEngineConfig，内部自动归一化 |

---

## 五、技术改进

### 架构层面

| 改进 | 描述 |
|------|------|
| 状态外化 | AgentEngine 从持有 7 个进程内 Map 改为通过 ISessionStore write-through 模式 |
| 配置归一化 | 三套配置 → UnifiedConfig，消除 `as any` 类型断言 |
| Provider 模式 | 可观测性采用与 LogProvider 一致的 Provider 模式 |
| 依赖注入 | EngineState/CoreAppStateFactory 改为 DI，消除 value import 穿透 |
| 类型屏障 | engine/types/ 从 5/12+ 覆盖提升到 11/12+ |

### 代码质量

| 指标 | 改进前 | 改进后 |
|------|--------|--------|
| engine/ 穿透依赖 | 88 条 | ~62 条（6 个屏障文件消除 22 条 type import + DI 消除若干） |
| 全局单例冲突 | 4 个 | 1 个（保留 getGlobalCCRuntime 作为 fallback） |
| 配置系统套数 | 3 套 | 1 套 UnifiedConfig + 2 套标记 deprecated |
| 死代码标记 | 500+ 行零调用无标记 | 全部标记 @planned 注解 |

---

## 六、OKR V6 对齐情况

| KR | 描述 | 优先级 | V18 状态 | 说明 |
|----|------|--------|---------|------|
| KR1 | TracingProvider + MetricsProvider | P1 | ✅ 已实现 | 接口 + NoOp/InMemory 默认实现 |
| KR2 | IConfigProvider 配置归一化 | P0 | ✅ 已实现 | UnifiedConfig + 诊断日志 |
| KR3 | AgentEngine 无界 Map → StorageProvider | P0 | ✅ 已实现 | ISessionStore write-through |
| KR4 | IMemoryStore + ISessionContentStore | P2 | ✅ 已实现 | 接口 + InMemory 实现 |
| KR5 | engine/ 穿透依赖 < 10 处 | P1 | ⚠️ 部分达成 | 从 88 条降至 ~62 条，目标需持续推进 |
| — | 全局单例多实例冲突 | P0 | ✅ 已实现 | TokenBudgetManager 实例化 |
| — | 死代码清理 | P1 | ✅ 已实现 | @planned 注解标记 |
| — | Session 暂停恢复修复 | P2 | ✅ 已实现 | transcript 上下文保存 |
| — | Metadata 双重存储统一 | P2 | ✅ 已实现 | Session 实体直接存储 |

### 执行中新增 KR（V18 研究发现）

| 新 KR | 描述 | 优先级 | 状态 |
|--------|------|--------|------|
| Provider 运行时接入 | AgentEngine 走 ProviderAdapter 调用链 | P1 | ⏳ 延后 V19 |
| CircuitBreaker 启用 | 熔断器接入 Provider 层 | P1 | ⏳ 延后 V19 |
| LLMRuntime 统一 | 与 ProviderAdapter 合并 | P2 | ⏳ 延后 V19 |

---

## 七、已知问题和后续计划

### 遗留问题

1. **Provider 运行时接入**（V19 重点）：当前 7 个 ProviderAdapter 已实现但运行时未调用，AgentEngine 仍走 CC 内部路径
2. **穿透依赖未达目标**：KR5 目标 < 10 处，当前 ~62 处，需持续推进
3. **预存编译错误**：`waitForResult.ts`、`SessionContextStorage.test.ts` 等非 V18 引入的错误未修复
4. **Bridge 层 `as any`**：部分类型桥接仍使用 `as unknown as` 双重断言

### V19 建议

1. **Provider 运行时接入**：让 AgentEngine 的 LLM 调用真正走 ProviderAdapter → CircuitBreaker → executeWithRetry
2. **穿透依赖持续推进**：继续消除 value import 穿透，目标 < 30 处
3. **补充集成测试**：Session 暂停恢复端到端测试
4. **Bridge 层类型改善**：减少 `as unknown as` 使用，增强类型安全

---

## 八、文档维护记录

### 核心文档状态

| 文档 | 状态 | 已更新 |
|------|------|--------|
| `docs/okr-roadmap.md` | ✅ 已更新 | V6 状态更新为"V18 已实现"，KR 状态标记 |
| `docs/architecture-design.md` | ⏳ 待更新 | engine/ 文件数 55→110；缺少 config/observability/compat 模块；版本号过时 |
| `claude-code/ARCHITECTURE.md` | ⏳ 待更新 | Provider 目录结构变化 |

### 文档扫描完整结果（背景 Agent 审计）

#### P0 — 严重过时（需尽快更新）

| 文档 | 主要不一致 |
|------|-----------|
| `architecture-design.md` | engine/ 文件数 55→110；缺少 config/, observability/, compat/ 等新模块；AgentEngineConfig 字段不完整；版本号 V16→V18 |
| `project-purpose.md` | engine/ 文件数过时；组件架构图缺少新模块；版本号 V10 |
| `okr-roadmap.md` | ✅ 已更新（V6 状态、KR 状态已标记） |

#### P1 — 功能描述过时

| 文档 | 主要不一致 |
|------|-----------|
| `session-manager-design.md` | 缺少 write-through、auto-recover、store 降级描述 |
| `session-store-design.md` | 缺少 IMemoryStore、ISessionContentStore 接口；write-through 模式未描述 |
| `bootstrap-design.md` | AgentEngineConfig 过时；缺少配置诊断步骤；缺少 Session 恢复步骤 |
| `engine-state-design.md` | DI 重构未反映；CoreAppStateFactory 未提及；屏障文件未提及 |
| `extension-model-design.md` | AgentEngineConfig 过时；UnifiedConfig 未提及 |

#### P2 — 轻微过时

| 文档 | 主要不一致 |
|------|-----------|
| `memory-and-session-content-design.md` | 立场冲突（文档说不需要 ISessionContentStore，但已实现） |
| `engine-facade-design.md` | EngineConfig 类型过时；缺少 dispose 方法 |
| `data-flow-design.md` | QueryEngine 创建流程过时 |
| `v6-architecture.md` | 7 层架构缺少新模块；版本历史不完整 |
| `feature-design/readme.md` | 缺少新模块的设计文档索引 |

#### 无需更新

`event-bus-design.md`、`session-design.md`、`cc-runtime-design.md`、`hook-core-design.md`、`query-engine-design.md`、`context-compactor-design.md`、`serialization-protocol-design.md` — 基本一致。

### 文档维护建议

1. **优先更新 P0 文档**：`architecture-design.md` 和 `project-purpose.md` 影响新用户对项目的理解
2. **P1 文档可在 V19 前更新**：随 Provider 接入一并调整
3. **P2 文档渐进更新**：不影响开发，可在后续版本迭代时顺手更新

---

## 九、产物清单

| 产物 | 路径 |
|------|------|
| 需求文档 | `auto-upgrade/v18/00-user-requirement.md` |
| 研究报告 | `auto-upgrade/v18/01-optimizer-research.md` |
| 任务计划 | `auto-upgrade/v18/02-task-plan.md` |
| 执行报告 | `auto-upgrade/v18/03-execution-report.md` |
| 工作总结 | `auto-upgrade/v18/04-work-summary.md` |
| 执行记录 | `auto-upgrade/v18/00-execution-record.md` |
| 详细记录 | `auto-upgrade/v18/multi-phase-execute-record.md` |
