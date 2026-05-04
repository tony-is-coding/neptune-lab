# V6 任务计划 — 核心层架构持续解耦

> 生成时间：2026-04-26
> 基于 V6 深度分析报告（01-optimizer-research.md）
> 执行范围：第一批（5项低风险并行）+ 第二批（3项核心架构串行）

---

## 一、项目概述

将 8 个优化点转化为可执行任务。目标：完善 SDK 开发体验、解耦核心架构依赖、清理技术债。

**执行约束**：
- 最小改动现有代码，核心 agent loop 不变
- 100% 向后兼容
- 第三批（REPL拆分、独立包发布）暂不纳入

---

## 二、Agent Team 组成

| 角色 | 代号 | 职责 | 能力要求 |
|------|------|------|----------|
| **team-lead** | team-lead | 协调进度、集成验证、最终验收 | 全局视角、测试验证 |
| **architect** | architect | 架构设计审核、代码 review、设计决策 | 架构评审、类型设计 |
| **dev-core** | dev-core | 核心模块开发（类型、接口、AppState、Provider、权限） | TypeScript、框架设计、CC代码理解 |
| **dev-infra** | dev-infra | 基础设施开发（文档、CI/CD、代码清理） | 文档编写、CI配置、代码重构 |

**团队规模**：4人

**协作方式**：
- team-lead 负责任务分配和进度管理
- architect 负责所有代码变更的架构审核
- dev-core 和 dev-infra 可并行工作
- 每个任务完成后由 architect 审核，team-lead 验收

---

## 三、任务阶段划分

```
阶段一（并行）— 第一批低风险优化
  T1 ─┐
  T2 ─┤
  T3 ─┼──→ 阶段一验证（architect review）
  T4 ─┤
  T5 ─┘

阶段二（串行）— 第二批核心架构
  T6 ──→ T7 ──┐
  T6 ──→ T8 ──┼──→ 阶段二验证（architect review）
               │
               └──→ T9（集成验证）
```

---

## 四、任务清单

### T1: SDK 消息类型标准化（O-FUNC1）

| 项目 | 内容 |
|------|------|
| **目标** | 为 SDK query() 提供类型安全的消息联合类型和便捷 API |
| **执行角色** | dev-core |
| **输入** | 当前 engine/types.ts 中 SDKMessage 定义、CC 原始 Message 类型 |
| **预期产出** | 1. `src/engine/types/query-events.ts` — QueryEvent 联合类型定义<br>2. `src/engine/helpers/collectText.ts` — collectText() 便捷方法<br>3. `src/engine/helpers/waitForResult.ts` — waitForResult() 便捷方法<br>4. 更新 `engine/index.ts` 导出 |
| **依赖** | 无 |
| **验收标准** | 1. QueryEvent 联合类型覆盖 assistant/tool_use/tool_result/system/error 5种变体<br>2. collectText() 可从 AsyncGenerator<QueryEvent> 中提取完整文本<br>3. waitForResult() 可等待查询完成并返回最终结果<br>4. tsc 零错误<br>5. 现有 E2E 项目不需要修改（向后兼容） |
| **优先级** | P1 |

### T2: ISessionStore 异步接口改造（O-FUNC2）

| 项目 | 内容 |
|------|------|
| **目标** | 将 ISessionStore 接口从同步改为异步，支持 PostgreSQL/Redis 等异步存储后端 |
| **执行角色** | dev-core |
| **输入** | 当前 ISessionStore 接口定义、InMemorySessionStore、SQLiteSessionStore |
| **预期产出** | 1. 修改 ISessionStore 接口为 `Promise<T>` 返回类型<br>2. 适配 InMemorySessionStore（改为 async）<br>3. 适配 SQLiteSessionStore（改为 async）<br>4. 修改 SessionManager 中所有 ISessionStore 调用为 await<br>5. 修改 EngineFacade 中相关调用 |
| **依赖** | 无 |
| **验收标准** | 1. ISessionStore 所有方法返回 Promise<br>2. InMemorySessionStore 和 SQLiteSessionStore 编译通过<br>3. SessionManager 所有调用处使用 await<br>4. 现有测试（engine-core/）全部通过<br>5. E2E 项目的 pg-session-store.ts 可实现 ISessionStore 接口 |
| **优先级** | P1 |

### T3: engine/ 层级标准补全与文档同步（O-ARCH5）

| 项目 | 内容 |
|------|------|
| **目标** | 为 engine/ 建立层级定义，同步 3 处文档与代码不一致 |
| **执行角色** | dev-infra |
| **输入** | 当前架构文档、分层标准文档、engine/ 目录实际结构 |
| **预期产出** | 1. 更新 `architecture-layering-standard.md` 新增 engine/ 层级定义<br>2. 修正 `architecture-design.md` 中 AgentEngineConfig 的 permissions 位置（从顶层移到 extensions 内）<br>3. 新增 `docs/feature-design/core-components/engine-state-design.md`（EngineState 关键设计决策）<br>4. 新增 `docs/feature-design/core-components/hook-core-design.md`（HookCore 关键设计决策）<br>5. 新增 `docs/feature-design/core-components/cc-runtime-design.md`（CCRuntime 关键设计决策） |
| **依赖** | 无 |
| **验收标准** | 1. engine/ 在分层标准中有明确的层级定义和 import 规则<br>2. architecture-design.md 中 permissions 位置与代码一致<br>3. 3 个新设计文档覆盖关键设计决策、接口说明、使用方式 |
| **优先级** | P1 |

### T4: 腐朽代码清理（O-QUAL1）

| 项目 | 内容 |
|------|------|
| **目标** | 清理 getSettings_DEPRECATED 调用链，推进 console → LogUtil 替换 |
| **执行角色** | dev-infra |
| **输入** | console-replace-manifest.md（131处清单）、getSettings_DEPRECATED 12处使用 |
| **预期产出** | 1. getSettings_DEPRECATED 全部迁移到 getSettings() 或删除<br>2. console → LogUtil 替换达到 50%（66/131处），聚焦 engine/ 和 bridge/ 相关文件<br>3. 删除 `export type getSettings_DEPRECATED = any` 类型导出 |
| **依赖** | 无 |
| **验收标准** | 1. `grep -r "getSettings_DEPRECATED" --include="*.ts" --include="*.tsx"` 零匹配<br>2. engine/ 目录下 console 调用零匹配（全部替换为 LogUtil）<br>3. tsc 零错误<br>4. 全量测试通过 |
| **优先级** | P2 |

### T5: CI/CD 与测试补全（O-QUAL2）

| 项目 | 内容 |
|------|------|
| **目标** | 建立基础 CI 流水线，为 Bridge 和 HookCore 补充单元测试 |
| **执行角色** | dev-infra |
| **输入** | 现有测试目录结构、MockCCRuntime 实现 |
| **预期产出** | 1. `.github/workflows/ci.yml` — typecheck + lint + test<br>2. `src/engine/bridge/__tests__/OriginalQueryEngineBridge.test.ts`<br>3. `src/engine/hooks/__tests__/HookCore.test.ts` |
| **依赖** | 无 |
| **验收标准** | 1. CI 流水线在 push/PR 时自动运行<br>2. Bridge 测试覆盖核心桥接逻辑（config构建、工具适配、QueryEngine初始化）<br>3. HookCore 测试覆盖通知Hook和配置变更Hook的执行路径<br>4. CI 运行时间 < 5分钟 |
| **优先级** | P2 |

### T6: QueryEngine/AppState UI 依赖解耦（O-ARCH1）

| 项目 | 内容 |
|------|------|
| **目标** | 收窄 QueryEngine 对 AppState 的依赖范围，SDK 模式仅需核心字段 |
| **执行角色** | dev-core |
| **输入** | 当前 QueryEngineConfig、AppState 类型（60+字段）、EngineState（18字段） |
| **预期产出** | 1. `src/engine/types/CoreAppState.ts` — 核心运行时状态类型（≤20个字段）<br>2. 审计报告：QueryEngine 内部实际使用的 AppState 字段清单<br>3. 修改 QueryEngineConfig 的 getAppState/setAppState 类型为 CoreAppState<br>4. 修改 OriginalQueryEngineBridge 构造 CoreAppState<br>5. REPL.tsx 中 UI 字段读写改为独立通道 |
| **依赖** | T2（ISessionStore 异步改造完成后，AppState 相关变更更容易） |
| **验收标准** | 1. CoreAppState 类型定义清晰，≤20个字段，零 UI 依赖<br>2. QueryEngine 的核心路径（submitMessage）不依赖任何 UI 字段<br>3. SDK 模式通过 OriginalQueryEngineBridge 可在不提供 UI 字段的情况下正常工作<br>4. CLI 模式（REPL.tsx）行为 100% 不变<br>5. tsc 零错误、全量测试通过 |
| **优先级** | P0 |

### T7: Provider 适配器统一接口（O-ARCH2）

| 项目 | 内容 |
|------|------|
| **目标** | 定义 ProviderAdapter 统一接口，支持 per-session Provider 配置 |
| **执行角色** | dev-core |
| **输入** | 当前 Provider 管理（7种）、claude.ts（3483行）、环境变量选择逻辑 |
| **预期产出** | 1. `src/engine/provider/ProviderAdapter.ts` — 统一接口定义<br>2. `src/engine/provider/ProviderRegistry.ts` — Provider 注册表<br>3. `src/engine/provider/adapters/AnthropicProvider.ts` — Anthropic 适配器（包装 claude.ts）<br>4. 修改 AgentEngineConfig 支持 `provider` 配置项<br>5. 修改 OriginalQueryEngineBridge 使用 ProviderRegistry |
| **依赖** | T6（AppState 解耦后 Provider 配置更清晰） |
| **验收标准** | 1. ProviderAdapter 接口定义（query/convertMessages/convertTools/streamAdapter）<br>2. AgentEngineConfig.provider 可指定 provider 类型和参数<br>3. 现有环境变量选择逻辑保持向后兼容<br>4. CLI 模式行为 100% 不变<br>5. tsc 零错误、全量测试通过 |
| **优先级** | P0 |

### T8: 权限系统中间路径（O-ARCH4）

| 项目 | 内容 |
|------|------|
| **目标** | 提供可编程的权限决策接口，SDK 使用者可注入自定义权限策略 |
| **执行角色** | dev-core |
| **输入** | 当前权限系统（bypass/交互式）、canUseTool 函数、useCanUseTool hook |
| **预期产出** | 1. `src/engine/permissions/PermissionDelegate.ts` — 权限委托接口<br>2. `src/engine/permissions/PermissionDecision.ts` — 决策结果类型（allow/deny/ask）<br>3. 修改 AgentEngineConfig.permissions 支持 `delegate` 配置<br>4. 修改 OriginalQueryEngineBridge 在非 bypass 模式下使用 delegate<br>5. 内置 `ReadOnlyPermissionDelegate`（只读自动放行、写操作自动拒绝） |
| **依赖** | T6（QueryEngine 配置接口收窄后更容易插入 delegate） |
| **验收标准** | 1. PermissionDelegate 接口定义清晰<br>2. bypass 模式保持现有行为<br>3. delegate 模式下 SDK 可实现细粒度权限控制<br>4. ReadOnlyPermissionDelegate 作为内置示例可用<br>5. tsc 零错误、全量测试通过 |
| **优先级** | P1 |

### T9: 集成验证

| 项目 | 内容 |
|------|------|
| **目标** | 全量验证所有任务的集成结果 |
| **执行角色** | team-lead |
| **输入** | 所有已完成任务 |
| **预期产出** | 1. 全量测试报告<br>2. tsc 验证报告<br>3. lint:layers 验证报告<br>4. E2E 项目回归报告 |
| **依赖** | T1, T2, T3, T4, T5, T6, T7, T8 |
| **验收标准** | 1. tsc 零错误<br>2. 全量测试通过（0 fail）<br>3. lint:layers 零违规<br>4. E2E 项目正常运行<br>5. engine/ 零 React 依赖 |
| **优先级** | P0 |

---

## 五、关键路径分析

```
T1 ──────────────────────────────────────┐
T2 ──────→ T6 ──→ T7 ───────────────────┤
T3 ──────────────────────────────────────┼──→ T9
T4 ──────────────────────────────────────┤
T5 ──────────────────────────────────────┤
              T6 ──→ T8 ─────────────────┘

关键路径：T2 → T6 → T7 → T9（最长路径）
次关键路径：T2 → T6 → T8 → T9
```

**关键路径上的任务**：T6（AppState解耦）是整个计划的瓶颈，后续 T7/T8 都依赖它。

**并行窗口**：
- T1/T2/T3/T4/T5 可完全并行
- T7 和 T8 在 T6 完成后可并行
- T3/T4/T5 在阶段一完成后可释放 dev-infra

---

## 六、风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| T6 AppState 解耦影响面过大（173文件引用） | 高 | 高 | 先完成审计报告，明确实际使用范围后再动手；最小改动策略 |
| T7 Provider 适配器抽象 claude.ts（3483行）复杂 | 中 | 中 | 先定义接口，AnthropicProvider 暂为 thin wrapper，不做大规模重构 |
| T8 权限 delegate 阻塞查询循环 | 低 | 高 | delegate 决策必须为异步，设置超时保护 |
| 并行任务之间的代码冲突 | 低 | 中 | 使用独立 worktree，T1/T2 各自在独立文件上操作 |
| CI 运行时间过长 | 低 | 低 | 仅运行 claude-code 相关测试，排除 CC 原始大测试集 |

---

## 七、执行策略

### 阶段一执行（并行）

```
dev-core:   T1（消息类型）+ T2（SessionStore异步）
dev-infra:  T3（文档同步）+ T4（腐朽代码）+ T5（CI/CD）
architect:  review 所有任务产出
team-lead:  监控进度、处理阻塞
```

### 阶段一验证门禁

- T1~T5 全部完成 + architect review 通过
- tsc 零错误 + 全量测试通过
- 不通过则修复后重新验证

### 阶段二执行（串行为主）

```
dev-core:   T6（AppState解耦）→ T7（Provider）或 T8（权限）串行
architect:  review T6（关键节点）、review T7/T8
team-lead:  T9（集成验证）
dev-infra:  阶段一完成后可释放，或协助 T9
```

### 阶段二验证门禁

- T6~T8 全部完成 + architect review 通过
- tsc 零错误 + 全量测试通过 + lint:layers 零违规
- E2E 项目回归通过

---

## 八、V5 待办映射

| V5 待办 | V6 任务 | 状态 |
|---------|---------|------|
| O15 REPL.tsx 拆分 | — | 暂缓（第三批） |
| 剩余工具 UI 分离 | — | 降为持续改进项 |
| O2 Provider 适配器 | T7 | 纳入 |
| O7 SessionStorage | T2 | 由异步接口改造覆盖 |
| O8 QueryDeps 依赖注入 | T6 | 由 AppState 解耦覆盖 |
| O11 Permission | T8 | 纳入 |
| O12 Memory | — | 已基本可用，暂不纳入 |
