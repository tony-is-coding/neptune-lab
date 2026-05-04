> **文档状态**：✅ 最新 | 更新时间：2026-04-26

# Extension 模型设计 — 替代 Provider 模型

---

## 一、问题诊断

### 1.1 当前架构问题

| 问题 | 说明 |
|------|------|
| `IToolExecutor` 是错误的抽象 | 要求用户注入工具执行器，但 Engine 已有 30+ 内置工具 |
| `providers.tool` 是必填项 | 所有代码都必须创建 NoOp ToolExecutor，纯样板代码 |
| 工具定义与执行分离 | `ToolProvider` 只提供定义，`IToolExecutor` 只执行，QueryEngine 拿不到工具定义传给 LLM |
| 命名混乱 | `ToolProvider`/`SkillProvider` 暗示"提供者"，实际应该是"扩展点" |
| LLM 调用缺 tools 参数 | `ClaudeLLMProvider.streamMessage()` 没传 tools，模型不知道有工具 |

### 1.2 核心原则

- Engine 出厂自带内置工具（Claude Code builtin-tools），不需要用户配置
- 框架不包装 LLM Provider，直接复用 Claude Code 原始 API 调用链路
- Extension 是可选的扩展点，不是必须的依赖

---

## 二、当前 AgentEngineConfig

> 来源：`src/engine/AgentEngine.ts`

```typescript
interface AgentEngineConfig {
  /** 系统提示词（支持静态字符串或异步函数） */
  systemPrompt?: string | (() => Promise<string>)

  /** 可选扩展点 */
  extensions?: {
    /** 自定义工具 — 直接传入 CC 原始 Tool 类型数组 */
    tools?: Tool[]
    /** 技能扩展 — 写入 workspace/.claude/skills/ 目录 */
    skills?: SkillExtension[]
    /** 权限配置（T2 引入） */
    permissions?: PermissionConfig
  }

  /** 引擎选项 */
  options?: {
    maxConcurrentSessions?: number
    workspaceRoot?: string
  }

  /** 记忆存储根目录，用于用户级记忆隔离 */
  memoryRoot?: string
}
```

关键设计决策：
- **无 LLM Provider 字段**：框架不包装 LLM，直接复用 CC 原始 API 调用链路
- **无 observability 字段**：可观测性已统一到 `engine/log/` 模块
- **无 builtinTools 配置**：框架自带 CC 全部内置工具，通过 `getAllBaseTools()` 加载
- **permissions 为 T2 新增**：支持 `bypassPermissions` 模式用于 headless/自动化场景

---

## 三、核心接口

### 3.1 Tool（CC 原始类型）

用户通过 `extensions.tools` 传入的是 **Claude Code 原始 Tool 类型**（非自定义接口）。

框架在 `OriginalQueryEngineBridge` 中提供 `adaptToolExtension()` 辅助函数，可将简化的 `ToolExtension` 适配为 CC 原始 Tool 类型：

```typescript
/** 用户自定义工具扩展（简化接口） */
interface ToolExtension {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
  }
  execute: (params: Record<string, unknown>) => Promise<{ content: string }>
}
```

`adaptToolExtension(ext: ToolExtension): Tool` 将 ToolExtension 转换为 CC 原始 Tool，内部处理：
- Zod schema 构造（使用 `z.record` 作为宽松 fallback）
- JSON Schema 构造（API 层优先使用，跳过 `zodToJsonSchema`）
- Tool 接口方法实现（`isEnabled`, `isReadOnly`, `isConcurrencySafe`, `call` 等）

### 3.2 SkillExtension

> 来源：`src/engine/skill/SkillLoader.ts`

```typescript
interface SkillExtension {
  name: string            // 技能名称（目录名，如 'budget-analysis'）
  description: string     // 描述
  content: string         // 提示词模板（markdown body）
  whenToUse?: string      // 何时使用
  allowedTools?: string[] // 允许使用的工具列表
  model?: string          // 指定模型
}
```

SkillExtension 的加载机制：将技能写入 `workspace/.claude/skills/{name}/SKILL.md`，利用 Claude Code 原生 `loadSkillsDir()` 自动发现。框架写入的 skill 带 `source: engine-extension` 标记，销毁 session 时只清理框架写入的 skill。

### 3.3 PermissionConfig（T2 新增）

> 来源：`src/engine/bridge/OriginalQueryEngineBridge.ts`

```typescript
interface PermissionConfig {
  /** 是否绕过权限检查（用于 headless/自动化场景） */
  bypassPermissions?: boolean
}
```

权限控制逻辑在 `buildQueryEngineConfig()` 中实现：
- `bypassPermissions: true` — `canUseTool` 始终返回 `{ behavior: 'allow' }`
- 默认 — 使用 CC 原始 `hasPermissionsToUseTool()` 权限检查

---

## 四、内部实现

### 4.1 OriginalQueryEngineBridge

> 来源：`src/engine/bridge/OriginalQueryEngineBridge.ts`

Bridge 层负责将 AgentEngine 配置转换为 CC 原始 QueryEngineConfig：

```
AgentEngineConfig
  → BridgeOptions
    → buildQueryEngineConfig()
      → QueryEngineConfig（CC 原始类型）
```

核心函数：

| 函数 | 职责 |
|------|------|
| `initializeRuntime(cwd)` | 注入 MACRO defines、enableConfigs、bootstrap 单例 |
| `buildQueryEngineConfig(options)` | 从 BridgeOptions 构造完整的 QueryEngineConfig |
| `adaptToolExtension(ext)` | ToolExtension → CC 原始 Tool 类型适配 |

`buildQueryEngineConfig()` 内部流程：
1. 构造 AppState（复用 `getDefaultAppState()`）
2. 加载内置工具（`getAllBaseTools()`）+ 适配用户扩展工具
3. 根据 PermissionConfig 构造 `canUseTool` 函数
4. 构造 FileStateCache、AbortController
5. 返回完整的 QueryEngineConfig

### 4.2 运行时初始化

`initializeRuntime()` 是进程级单例，仅首次调用时执行：
- 注入 MACRO namespace（版本号、构建时间等编译时常量）
- 调用 `enableConfigs()` 允许配置系统读取
- 设置 bootstrap 单例（cwd、projectRoot）

> **限制**：当前仅支持单个 workspace 并发，多 session 并发场景下不同 workspace 的状态可能互相覆盖。

---

## 五、工具链路

```
AgentEngine.create(config)
  ├─ new EngineFacade()          → Session 管理
  ├─ new EventBus()              → 事件分发
  └─ 缓存 config.extensions

engine.createSession({ workspace })
  ├─ facade.createSession()      → 创建 SessionContext
  └─ loadSkillsToWorkspace()     → 写入 SkillExtension 到 .claude/skills/

engine.query(sessionId, input)
  ├─ initializeRuntime(cwd)      → 首次调用时初始化 CC 运行时
  ├─ buildQueryEngineConfig()    → 构造 QueryEngineConfig
  │   ├─ getAllBaseTools()       → 加载 30+ 内置工具
  │   ├─ adaptToolExtension()    → 适配用户扩展工具
  │   └─ canUseTool              → 根据权限配置构造
  ├─ new QueryEngine(config)     → 创建 CC 原始 QueryEngine
  └─ queryEngine.submitMessage() → 执行查询，yield 消息流
```

---

## 六、用户使用方式

```typescript
// 最简用法 — 无需 LLM Provider
const engine = AgentEngine.create({})

// 带系统提示词
const engine = AgentEngine.create({
  systemPrompt: '你是一个代码审查助手',
})

// 带工具扩展
const engine = AgentEngine.create({
  extensions: {
    tools: [{
      name: 'deploy',
      description: '部署到生产环境',
      inputSchema: {
        type: 'object',
        properties: {
          env: { type: 'string', description: '目标环境' },
        },
      },
      execute: async (params) => ({ content: `Deployed to ${params.env}` }),
    }],
    skills: [{
      name: 'code-review',
      description: '代码审查技能',
      content: '请审查以下代码变更...',
      whenToUse: '当用户提交代码审查请求时',
    }],
    permissions: {
      bypassPermissions: true,  // headless/自动化场景
    },
  },
  memoryRoot: '/path/to/memory',
})

// 创建会话并查询
const sessionId = await engine.createSession({ workspace: '/project' })
for await (const message of engine.query(sessionId, '分析这个项目')) {
  console.log(message)
}
```

---

## 七、与旧设计的差异

| 旧设计（已废弃） | 当前实现 |
|------|------|
| `llm: ILLMProvider`（必填） | 无 LLM Provider 字段，框架直接复用 CC 原始 API 链路 |
| `observability` 配置 | 已统一到 `engine/log/` 模块 |
| `engine/llm/` 目录 | 不存在 |
| `engine/extension/EngineToolExecutor.ts` | 不存在，工具加载在 Bridge 层完成 |
| `engine/query/types.ts` | 不存在，类型定义在各自的模块中 |
| `options.builtinTools` 配置 | 无此配置，框架通过 `getAllBaseTools()` 自动加载全部内置工具 |
| `ToolExtension` 是主接口 | `tools` 字段接受 CC 原始 `Tool[]`，`ToolExtension` 是 Bridge 层的辅助适配类型 |
| `options.sessionStore` | 不在 AgentEngineConfig 中 |
| 无权限控制 | T2 引入 `PermissionConfig`，支持 `bypassPermissions` |

---

## 八、关键源码文件

| 文件 | 职责 |
|------|------|
| `src/engine/AgentEngine.ts` | 引擎入口，AgentEngineConfig 定义 |
| `src/engine/bridge/OriginalQueryEngineBridge.ts` | 桥接层，运行时初始化 + 配置构造 + 工具适配 |
| `src/engine/skill/SkillLoader.ts` | SkillExtension 加载/清理 |
| `src/engine/EngineFacade.ts` | Session 管理 |
| `src/engine/events/EventBus.ts` | 事件分发 |
| `src/engine/types.ts` | 引擎通用类型 |
| `src/engine/errors.ts` | 引擎错误类型 |
| `src/engine/session/` | Session 上下文管理 |
