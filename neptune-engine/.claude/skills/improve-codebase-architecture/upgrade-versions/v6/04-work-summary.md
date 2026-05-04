# V6 工作总结

## 版本概述

**V6 — 核心层架构持续解耦**

在 V5 基础上继续推进 Agent Engine 框架的核心层解耦。本版本完成 8 个优化项（第一批 5 项低风险并行 + 第二批 3 项核心架构串行），新增 Provider 适配器、权限委托、CoreAppState 三大核心能力，SDK 消息类型实现标准化。33 个文件变更，+3690/-99 行。

---

## 变化清单

### 新增（11 个代码文件 + 2 个测试文件 + 1 个 CI 文件）

| 文件 | 说明 |
|------|------|
| `engine/types/query-events.ts` | QueryEvent 联合类型（5 种变体 + 类型守卫） |
| `engine/types/CoreAppState.ts` | CoreAppState 接口 + createDefaultCoreAppState() |
| `engine/helpers/collectText.ts` | collectText() / collectTextWithMeta() |
| `engine/helpers/waitForResult.ts` | waitForResult() / waitForResultWithTimeout() / waitForEventType() |
| `engine/permissions/PermissionDecision.ts` | PermissionDecision 类型 |
| `engine/permissions/PermissionDelegate.ts` | 权限委托接口 |
| `engine/permissions/ReadOnlyPermissionDelegate.ts` | 只读权限策略实现 |
| `engine/provider/ProviderAdapter.ts` | Provider 适配器接口 |
| `engine/provider/ProviderRegistry.ts` | Provider 注册中心 |
| `engine/provider/adapters/AnthropicProvider.ts` | Anthropic Provider |
| `engine/provider/index.ts` | Provider 层导出 |
| `engine/bridge/__tests__/OriginalQueryEngineBridge.test.ts` | Bridge 测试（17 用例） |
| `engine/hooks/__tests__/HookCore.test.ts` | HookCore 测试（20 用例） |
| `.github/workflows/ci.yml` | CI 流水线 |

### 修改（6 个文件）

| 文件 | 变更说明 |
|------|----------|
| `engine/bridge/OriginalQueryEngineBridge.ts` | 接入 CoreAppState、PermissionDelegate 三模式、Provider 透传 |
| `engine/SessionManager.ts` | ISessionStore 接口改为 async |
| `engine/EngineFacade.ts` | wrapSessionOperation 改为异步 |
| `engine/EngineState.ts` | console.error → LogUtil.error |
| `engine/AgentEngine.ts` | 新增 provider 配置、per-session provider 覆盖 |
| `engine/index.ts` | 四层导出（新增 SDK 便捷 API 层） |

### 删除（腐朽代码清理）

- `getSettings_DEPRECATED` 函数引用清理
- 多处 `console.log/warn/error` 替换为 `LogUtil`

### 新增文档

| 文件 | 说明 |
|------|------|
| `docs/feature-design/core-components/cc-runtime-design.md` | CCRuntime 设计文档 |
| `docs/feature-design/core-components/engine-state-design.md` | EngineState 设计文档 |
| `docs/feature-design/core-components/hook-core-design.md` | HookCore 设计文档 |

---

## 新增特性列表

### 1. Provider 适配器系统

**描述**：统一的 LLM Provider 接口，支持注册和切换不同 AI 模型后端。

**使用方式**：
```typescript
import { ProviderRegistry } from 'src/engine/provider'

// 获取单例注册中心
const registry = ProviderRegistry.getInstance()

// 注册自定义 Provider
registry.register('my-provider', new MyCustomProvider())

// per-session 指定 Provider
const engine = AgentEngine.create({
  provider: { type: 'my-provider', config: { model: 'gpt-4' } }
})
```

**影响范围**：SDK 用户可接入任意 OpenAI 兼容端点，不再被 Anthropic-only 限制。

### 2. 权限委托（PermissionDelegate）

**描述**：三模式权限决策系统，在"完全开放"和"完整交互"之间提供可编程的中间路径。

**使用方式**：
```typescript
const engine = AgentEngine.create({
  permissions: {
    // 模式一：bypass（自动化/CI 场景）
    bypassPermissions: true,

    // 模式二：自定义委托（生产级 SDK）
    delegate: {
      async onToolAccess(toolName, input) {
        if (toolName === 'BashTool') return 'deny'
        if (toolName === 'FileReadTool') return 'allow'
        return 'ask'  // 回退到 CC 原始权限检查
      }
    },

    // 模式三：默认（无配置 → CC 原始交互式权限）
  }
})
```

**影响范围**：SDK 用户可精细控制工具权限，满足企业级安全要求。

### 3. CoreAppState — 核心状态提取

**描述**：从 AppState 的 60+ 字段中提取 12 个核心字段（7 必需 + 5 可选），零 UI 依赖。

**使用方式**：
```typescript
import { createDefaultCoreAppState } from 'src/engine/types/CoreAppState'

// SDK/headless 模式下自动使用 CoreAppState 替代完整 AppState
// 无需手动创建，Bridge 内部自动处理
```

**影响范围**：SDK/headless 模式不再依赖 React 状态树，可独立运行。

### 4. QueryEvent 消息标准化

**描述**：为 SDK `query()` 的 `AsyncGenerator` 提供类型安全的事件联合类型和便捷 API。

**使用方式**：
```typescript
import { collectText, waitForResult } from 'src/engine/helpers'

// 收集完整文本
const text = await collectText(engine.query(sessionId, 'hello'))

// 等待最终结果
const result = await waitForResult(engine.query(sessionId, 'write code'))

// 类型守卫过滤事件
for await (const event of engine.query(sessionId, 'hello')) {
  if (isToolUseEvent(event)) {
    console.log('Tool called:', event.tool_name)
  }
}
```

**影响范围**：SDK 消费者可用类型安全的方式处理流式事件。

### 5. CI/CD 流水线

**描述**：GitHub Actions 自动化 CI，覆盖 typecheck + lint + test + test-engine 四个阶段。

**使用方式**：push 到任意分支或创建 PR 时自动触发。

---

## 用户体验改进

### SDK 开发者（主要用户）

| 改进 | 之前 | 之后 |
|------|------|------|
| 权限控制 | 只有 bypass 和交互式两种选择 | 三模式可选，支持自定义策略 |
| 模型切换 | 只能用默认 Provider | 可注册任意 Provider，per-session 覆盖 |
| 事件消费 | 原始 Message 类型，无便捷 API | QueryEvent 类型安全 + collectText/waitForResult |
| 异步存储 | ISessionStore 同步签名 | 异步接口，支持 PostgreSQL/Redis |
| 状态依赖 | SDK 需要 React 状态树 | CoreAppState 零 UI 依赖 |

### 框架维护者

| 改进 | 说明 |
|------|------|
| CI 自动化 | push/PR 自动验证 typecheck + lint + test |
| 腐朽代码清理 | 移除 getSettings_DEPRECATED、console 统一为 LogUtil |
| 文档同步 | 3 个新增设计文档 + 分层标准更新 |

---

## 技术改进

### 架构层面

- **AppState 解耦**：CoreAppState 从 60+ 字段的混合体中提取 12 个核心字段，Bridge 直接使用
- **Provider 抽象**：ProviderAdapter + ProviderRegistry 单例模式，支持扩展任意 LLM 后端
- **权限中间路径**：PermissionDelegate 接口实现三模式权限决策
- **消息标准化**：QueryEvent 联合类型 + 类型守卫 + 便捷 API

### 代码质量

- **测试覆盖**：新增 37 个测试用例（Bridge 17 + HookCore 20），总测试从 2684 增至 2813
- **CI/CD**：GitHub Actions 自动化流水线
- **腐朽代码**：getSettings_DEPRECATED 清理、console → LogUtil 统一

### 架构守卫

- engine/ 目录零 React 依赖 ✅
- lint:layers 分层检查 0 违规 ✅
- tsc 严格模式零错误 ✅

---

## 已知问题和后续计划

### 待 V7 处理

| 项目 | 难度 | 说明 |
|------|------|------|
| REPL.tsx 查询编排逻辑抽取 | 高 | 6314 行，CLI 与核心逻辑最大交汇点 |
| 独立 npm 包发布能力 | 中 | 构建 dist/ + package.json exports |
| AppState → getter 方法过渡 | 中 | 架构师建议的长期方向 |
| Provider 实际对接 | 中 | AnthropicProvider 当前为 thin wrapper |
| Provider/Permission 设计文档 | 低 | 缺少 feature-design 下的设计文档 |

---

## 文档维护记录

### 更新的文档

| 文档 | 更新内容 |
|------|----------|
| `docs/architecture-design.md` | 新增 CoreAppState、ProviderAdapter/Registry、PermissionDelegate、QueryEvent、helpers 到模块清单、依赖关系图、"我们的建设"表格 |
| `docs/architecture-layering-standard.md` | L2 目录列表新增 provider/、permissions/、helpers/、types/ 四个子目录 |
| `docs/feature-design/readme.md` | 目录结构新增 engine-state-design.md、hook-core-design.md、cc-runtime-design.md |

### 清理的临时文档

| 文件 | 操作 |
|------|------|
| `.tmp_docs/v1~v6-monitor-log.md`（6个） | 删除（过期巡检日志） |
| `.tmp_docs/doc-optimization-monitor-log.md` | 删除（过期监控日志） |
| `.tmp_docs/supervisor-monitor-log.md` | 删除（过期监控日志） |
| `.tmp_docs/t6-hookcore-strategy.md` | 删除（过程文档，已沉淀到设计文档） |

### 未更新（不需要更新）

| 文档 | 原因 |
|------|------|
| `claude-code/CLAUDE.md` | 测试数量随每次运行变化，保持现有值即可 |
| V5 相关文档 | 已是历史版本，不需要修改 |
