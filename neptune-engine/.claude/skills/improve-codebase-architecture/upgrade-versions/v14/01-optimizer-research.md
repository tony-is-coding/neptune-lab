# V14 优化清单：SDK 构建修复 + 测试覆盖 + API 文档 + e2e 回归

> 版本：V14
> 分析日期：2026-04-28
> 分析范围：claude-code/ SDK 构建体系、engine/ 测试覆盖、公共 API 文档、e2e_cli 适配
> 基于：V13 执行遗留 + OKR 路线图 V5 剩余 20%

---

## 一、框架现状分析

### 1.1 SDK 构建体系

**当前状态**：`build:sdk`（`tsc -p tsconfig.sdk.json`）失败。

**根因分析**：
- `tsconfig.sdk.json` 的 `include` 包含 `packages/builtin-tools/src/**/*.ts`
- `builtin-tools` 包含 153 个文件、1067 处 `from 'src/...'` 引用
- 这些引用通过 tsconfig paths（`src/*` → `./src/*`）解析到主源码目录
- 编译时 tsc 会拉入整个依赖链（包括被 exclude 排除的 CLI 文件）

**关键数据**：
| 指标 | 数值 |
|------|------|
| builtin-tools 源文件 | 153 个 |
| 对 src/ 的引用 | 1067 处 |
| .tsx UI 组件文件 | ~30 个 |
| 纯逻辑工具文件 | ~120 个 |

**构建策略问题**：
- SDK 的实际使用方式是 `import from 'claude-code-best/engine'`，Bun 直接消费 TS 源码
- `build:sdk` 的真正需求是生成 `.d.ts` 类型声明文件，供 IDE 类型提示
- 工具（builtin-tools）在运行时通过 `tools.ts` 动态加载，不需要在 SDK 构建时编译

### 1.2 测试覆盖率

**当前状态**：engine/ 有 24 个测试文件，约 446 个测试用例，覆盖率约 70%。

**模块覆盖情况**：

| 模块 | 源文件数 | 测试文件数 | 状态 |
|------|---------|-----------|------|
| engine/ (核心) | 5 | 3 | ✅ AgentEngine, EngineFacade, SessionManager |
| engine/analytics/ | 2 | 1 | ✅ NoOpAnalytics |
| engine/bootstrap/ | 3 | 0 | ❌ 无测试 |
| engine/bridge/ | 1 | 1 | ✅ OriginalQueryEngineBridge |
| engine/cc-runtime/ | 4 | 1 | ✅ CCRuntime |
| engine/compat/ | 3 | 1 | ✅ featureCompat |
| engine/context/ | 3 | 0 | ❌ 无测试 |
| engine/errors.ts | 1 | 0 | ❌ 无测试 |
| engine/events/ | 1 | 1 | ✅ EventBus |
| engine/helpers/ | 2 | 0 | ❌ 无测试 |
| engine/hooks/ | 3 | 1 | ✅ HookCore |
| engine/log/ | 11 | 4 | ✅ 完整覆盖 |
| engine/permissions/ | 6 | 0 | ❌ 无测试（3 个 Delegate） |
| engine/provider/ | 10 | 9 | ✅ Registry + 8 adapters |
| engine/session/ | 6 | 1 | ⚠️ 仅 SessionContext |
| engine/skill/ | 1 | 0 | ❌ 无测试 |
| engine/state/ | 1 | 0 | ❌ 无测试 |
| engine/storage/ | 7 | 0 | ❌ 无测试（5 个实现） |
| engine/tools/ | 1 | 1 | ✅ ToolAdapter |
| engine/types/ | 8 | N/A | 类型定义，无需测试 |

**未覆盖模块汇总**（11 个，24 个源文件）：
1. `bootstrap/` — initializeEngine, engineHelpers
2. `context/` — OffloadStrategy, DefaultOffloadStrategy
3. `errors.ts` — EngineError, EngineErrorCode
4. `helpers/` — collectText, waitForResult
5. `permissions/` — ReadOnlyPermissionDelegate, RBACPermissionDelegate, AuditPermissionDelegate
6. `session/` — TokenBudgetManager, TranscriptParser, SessionContextStorage
7. `skill/` — SkillLoader
8. `state/` — CoreAppStateFactory
9. `storage/` — InMemoryBackend, FilesystemBackend, CompositeBackend, InMemorySessionStore, SQLiteSessionStore
10. `EngineState.ts` — 引擎状态管理
11. `Session.ts` — Session 数据实体

### 1.3 e2e_cli 适配状态

**当前状态**：e2e_cli 已基本适配 V13 API。

**使用的 API**：
- `AgentEngine.create(config)` — 使用旧格式 `extensions: { tools, skills, permissions }`
- `engine.on(eventType, handler)` — 生命周期事件
- `engine.createSession()`, `engine.loadSession()`, `engine.destroySession()`
- `engine.pauseSession()`, `engine.resumeSession()`, `engine.getSession()`
- `engine.setMemoryPath()`, `engine.getStats()`, `engine.getEventBus()`
- `engine.query(id, input, { signal })`
- `EngineError`, `loadEngineSettings`, `EngineSettingsResult`

**兼容性**：V13 的配置变更（tools/skills 提升到顶层）是向后兼容的，旧格式仍可用。e2e_cli 无需修改即可运行。

**优化空间**：可以利用 V13 的新特性（QueryEvent 类型、EngineEventMap 类型安全），但非阻塞。

### 1.4 公共 API 文档

**当前状态**：无 API 文档生成机制。

- `src/index.ts` 有良好的 TSDoc 注释和分层组织
- `engine/` 各模块有基础的 JSDoc 注释
- 缺少 TypeDoc 或类似工具的配置和生成流程
- SDK 用户无法通过文档快速了解可用 API

---

## 二、框架目标对齐分析

| 目标（project-purpose.md） | 当前状态 | 差距 | V14 可推进 |
|--------------------------|---------|------|-----------|
| 物理分离完成 | ✅ V1-V9 完成 | — | — |
| 独立发布就绪 | ⚠️ 类型声明完整，构建失败 | build:sdk 失败 | ✅ P1 修复 |
| 分层验证通过 | ✅ lint:layers 通过 | — | — |
| 回归验证通过 | ✅ CLI 功能正常 | — | — |
| 测试覆盖 ≥ 90% | ⚠️ ~70% | engine/ 11 模块无测试 | ✅ P2 提升 |
| SDK 包 < 2MB | ⚠️ 未验证 | 构建失败无法测量 | ✅ 构建后验证 |
| API 文档完整 | ❌ 无文档生成 | 无 TypeDoc | ✅ P2 补齐 |
| 接入成本 < 1 天 | ⚠️ e2e_cli 可用 | 缺文档 | ✅ 文档补齐 |

---

## 三、优化清单（按优先级排序）

### Opt 1：SDK 构建修复 — 类型声明独立生成（P1）

**优化重点**：修复 `build:sdk`，使 SDK 可以独立生成 `.d.ts` 类型声明

**优化目标**：`bun run build:sdk` 零错误通过，生成 `dist/sdk/` 类型声明

**关键结果**：
- KR1：`bun run build:sdk` 零错误通过，产出 `dist/sdk/index.d.ts`
- KR2：`dist/sdk/` 体积 < 2MB
- KR3：外部项目引用 `claude-code-best` 时 IDE 类型提示正常

**预期收益**：SDK 可独立发布，V5 门禁通过，用户获得 IDE 类型提示

**对框架的影响**：
- 不破坏"包装不替代"原则 — 只改构建配置，不改运行时代码
- 正向：SDK 独立发布能力解锁
- 负面：无
- 风险：低 — 构建配置变更，可快速回退

**符合框架目标**：独立发布就绪（project-purpose.md 六、"完成"的定义 第2条）

**实施方案**：
1. `tsconfig.sdk.json` 从 include 中移除 `packages/builtin-tools/src/**/*.ts`
2. 改为 `emitDeclarationOnly: true` — 只生成 .d.ts，不做 JS 编译
3. 缩小 include 范围到最小必须集：`engine/`, `types/`, `state/`, 关键入口文件
4. 验证 `dist/sdk/index.d.ts` 不含 React 类型

**依赖关系**：无

---

### Opt 2：SDK 构建验证与体积优化（P1）

**优化重点**：构建产物验证，确保 SDK 包干净可用

**优化目标**：SDK 构建产物可用、体积可控、依赖正确

**关键结果**：
- KR1：`dist/sdk/` 零 React/Ink/CLI 类型引用
- KR2：`dist/sdk/` 体积 < 2MB
- KR3：package.json 的 `files` 字段正确声明发布范围

**预期收益**：SDK 发布后用户不会拉到不需要的依赖

**对框架的影响**：
- 不破坏框架原则
- 正向：发布链路打通
- 风险：低

**符合框架目标**：独立发布就绪

**依赖关系**：依赖 Opt 1

---

### Opt 3：存储层测试补齐（P2）

**优化重点**：为 engine/storage/ 的 5 个实现补齐单元测试

**优化目标**：storage/ 模块测试覆盖率达到 90%+

**关键结果**：
- KR1：InMemoryBackend 测试 — CRUD + 边界条件
- KR2：FilesystemBackend 测试 — 文件读写 + 错误处理
- KR3：CompositeBackend 测试 — LRU 路由 + 降级
- KR4：InMemorySessionStore + SQLiteSessionStore 测试

**预期收益**：存储层可靠性保障，V5 测试覆盖率目标推进

**对框架的影响**：
- 不破坏框架原则 — 只增加测试
- 正向：代码质量提升
- 风险：极低

**符合框架目标**：测试覆盖 ≥ 90%

**依赖关系**：无

---

### Opt 4：权限委托测试补齐（P2）

**优化重点**：为 3 个 PermissionDelegate 实现补齐单元测试

**优化目标**：permissions/ 模块测试覆盖率达到 90%+

**关键结果**：
- KR1：ReadOnlyPermissionDelegate 测试 — 只读策略验证
- KR2：RBACPermissionDelegate 测试 — 角色权限映射
- KR3：AuditPermissionDelegate 测试 — 审计日志记录

**预期收益**：权限系统可靠性保障

**对框架的影响**：
- 不破坏框架原则
- 正向：安全性验证
- 风险：极低

**符合框架目标**：测试覆盖 ≥ 90%

**依赖关系**：无

---

### Opt 5：Session 核心子模块测试补齐（P2）

**优化重点**：为 engine/session/ 的未测试模块补齐测试

**优化目标**：session/ 模块测试覆盖率提升

**关键结果**：
- KR1：TokenBudgetManager 测试 — 预算计算、状态管理
- KR2：TranscriptParser 测试 — JSONL 解析、格式验证
- KR3：SessionContextStorage 测试 — AsyncLocalStorage 上下文

**预期收益**：Session 管理可靠性提升

**对框架的影响**：
- 不破坏框架原则
- 风险：极低

**依赖关系**：无

---

### Opt 6：错误体系和辅助工具测试补齐（P2）

**优化重点**：为 errors.ts、helpers/、EngineState.ts、Session.ts 补齐测试

**优化目标**：基础工具模块测试覆盖

**关键结果**：
- KR1：EngineError 测试 — cause 链、错误码分类
- KR2：collectText/waitForResult 测试 — 辅助方法
- KR3：EngineState 测试 — 状态管理
- KR4：Session 数据实体测试

**预期收益**：SDK 基础能力可靠性保障

**依赖关系**：无

---

### Opt 7：API 文档生成（TypeDoc）（P2）

**优化重点**：配置 TypeDoc，生成 SDK 公共 API 文档

**优化目标**：API 文档覆盖全部公共方法

**关键结果**：
- KR1：TypeDoc 配置完成，`bun run docs:api` 可生成文档
- KR2：engine/ 公共 API 文档覆盖率 100%
- KR3：文档输出到 `docs/api/` 目录

**预期收益**：SDK 用户有完整的 API 参考文档

**对框架的影响**：
- 不破坏框架原则 — 只增加文档工具
- 正向：DX 大幅提升
- 风险：低 — 仅添加构建工具

**符合框架目标**：API 文档完整覆盖

**依赖关系**：依赖 Opt 1（需要构建成功才能验证文档生成）

---

### Opt 8：e2e_cli 新特性适配与验证（P2）

**优化重点**：e2e_cli 利用 V13 新特性，并作为 workspace 引用验证

**优化目标**：e2e_cli 全面使用新 API 特性，作为 SDK 集成验证

**关键结果**：
- KR1：e2e_cli query 返回类型改用 QueryEvent（替换 `AsyncGenerator<any>`）
- KR2：e2e_cli 事件监听改用 EngineEventMap 类型安全
- KR3：e2e_cli 配置改用新格式（tools/skills 顶层）

**预期收益**：e2e_cli 作为 SDK 最佳实践示例

**对框架的影响**：
- 不破坏框架原则
- 正向：V5 KR4 workspace 引用验证推进
- 风险：低

**依赖关系**：无（e2e_cli 当前已可用，这是增强）

---

### Opt 9：SDK 依赖优化 — Provider SDK 可选化（P2）

**优化重点**：将 Provider 相关的 SDK 依赖移到 optionalDependencies

**优化目标**：SDK 安装时只拉取用户实际使用的 Provider 依赖

**关键结果**：
- KR1：@anthropic-ai/bedrock-sdk、@anthropic-ai/vertex-sdk、@anthropic-ai/foundry-sdk 移到 optionalDependencies
- KR2：SDK 安装后体积下降可测量
- KR3：各 Provider 优雅降级（未安装时 clear error message）

**预期收益**：SDK 轻量化，用户按需安装

**对框架的影响**：
- 不破坏框架原则
- 正向：安装体验提升
- 风险：中 — 需要确保 import 时优雅降级

**依赖关系**：无

---

### Opt 10：engine/bootstrap/ 和 engine/skill/ 测试补齐（P2）

**优化重点**：为 bootstrap 初始化流程和 SkillLoader 补齐测试

**优化目标**：启动和技能加载流程有测试保障

**关键结果**：
- KR1：initializeEngine 测试 — 配置验证、组件初始化
- KR2：SkillLoader 测试 — 技能加载、目录创建

**预期收益**：SDK 启动流程可靠性保障

**依赖关系**：无

---

## 四、优化点依赖关系

```
Opt 1 (SDK构建) ──→ Opt 2 (构建验证) ──→ Opt 7 (API文档)
                                            ↑
Opt 3 (存储测试) ─┐                        │
Opt 4 (权限测试) ─┤                        │
Opt 5 (Session测试)├──→ 覆盖率统计 ──→ V5 门禁
Opt 6 (错误测试) ─┤
Opt 8 (e2e适配) ──┘
Opt 9 (依赖优化) ────→ 独立
Opt 10 (启动测试) ───→ 独立
```

**关键路径**：Opt 1 → Opt 2 → Opt 7（SDK 构建打通 → 验证 → 文档生成）

**可并行**：Opt 3-6、8-10 之间无依赖，可并行执行

---

## 五、执行策略建议

### 阶段 A：SDK 构建修复（Opt 1 + Opt 2）

**目标**：`build:sdk` 通过，类型声明可用

**关键改动**：
1. `tsconfig.sdk.json`：移除 `packages/builtin-tools/src/**/*.ts`，改为 `emitDeclarationOnly`
2. 缩小 include 范围到 SDK 核心
3. 验证产物干净（零 React、零 CLI）

### 阶段 B：测试覆盖提升（Opt 3-6 + Opt 10）

**目标**：engine/ 测试覆盖率从 ~70% 提升到 90%+

**并行分配**：
- developer-1：Opt 3（存储）+ Opt 5（Session）
- developer-2：Opt 4（权限）+ Opt 6（错误/辅助）+ Opt 10（启动/技能）

### 阶段 C：文档与验证（Opt 7 + Opt 8 + Opt 9）

**目标**：API 文档生成、e2e_cli 增强、依赖优化

---

## 六、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| SDK 构建移除 builtin-tools 后类型不完整 | SDK 用户缺少工具类型 | 工具类型由运行时动态加载，不影响核心 SDK |
| TypeDoc 与 Bun TS 兼容性 | 文档生成失败 | 使用 TypeDoc 0.26+ 支持 ESM |
| Provider SDK 可选化后 import 报错 | 运行时崩溃 | try/catch 动态 import + clear error message |
| 测试补齐工作量大 | 阶段 B 延期 | 优先覆盖核心路径，非核心可渐进 |

---

## 七、OKR 对齐更新

本次 V14 执行完成后，OKR 路线图预期进度：

| KR | 描述 | 当前进度 | V14 后预期 |
|----|------|---------|-----------|
| KR8 | SDK 构建（build:sdk）修复 | 未开始 | ✅ 完成 |
| KR10 | API 文档（TypeDoc） | 未开始 | ✅ 完成 |
| KR11 | engine/ 测试覆盖率 | ~70% | ~90% |
| KR12 | e2e_cli 适配 | 部分兼容 | ✅ 完成 |
| KR9 | Provider LLMRuntime | 未开始 | ⏳ 不在 V14 范围 |
| V5 整体 | 交付验收 | ~80% | ~95% |
