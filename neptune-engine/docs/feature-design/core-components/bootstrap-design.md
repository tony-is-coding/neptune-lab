> **文档状态**：✅ 最新 | 更新时间：2026-04-25

# Bootstrap 设计文档

---

## 一、功能概述

### 1.1 核心定位

Bootstrap 是 Agent Engine 框架的启动流程，其实现就是 `AgentEngine.create(config)` 静态工厂方法。该方法负责将配置对象转化为可运行的引擎实例。

### 1.2 职责边界

Bootstrap 只做三件事：
1. 创建 EventBus（事件总线）
2. 创建 EngineFacade（Session 管理门面）
3. 组装并返回 AgentEngine 实例

框架出厂自带 Claude Code 全部内置能力（55+ 工具、LLM 调用、权限系统），用户无需配置 Provider，只需按需注入扩展点。

### 1.3 适用场景

- CLI 应用启动时初始化引擎
- Web 服务启动时创建引擎实例
- 测试环境中创建轻量引擎
- 多租户场景下动态创建引擎

---

## 二、启动流程

### 2.1 流程图

```
AgentEngine.create(config)
    │
    ├─ 1. new EventBus()
    │     创建事件总线实例（发布/订阅）
    │
    ├─ 2. new EngineFacade({ sessionManager: { ... } })
    │     │
    │     └─ new SessionManager({ maxConcurrentSessions })
    │          创建 Session 注册表（纯数据管理）
    │
    └─ 3. new AgentEngine(facade, eventBus, config)
          组装引擎实例，返回给调用者
          │
          └─ Engine 就绪，可接受 createSession / query / on 调用
```

### 2.2 对应源码

```typescript
// src/engine/AgentEngine.ts
static create(config: AgentEngineConfig): AgentEngine {
  const eventBus = new EventBus()
  const facade = new EngineFacade({
    sessionManager: {
      maxConcurrentSessions: config.options?.maxConcurrentSessions,
      workspaceRoot: config.options?.workspaceRoot,
    },
  })
  return new AgentEngine(facade, eventBus, config)
}
```

构造函数为 private，外部只能通过 `create()` 创建实例：

```typescript
private constructor(
  facade: EngineFacade,
  eventBus: EventBus,
  config: AgentEngineConfig
) {
  this.facade = facade
  this.eventBus = eventBus
  this.config = config
}
```

### 2.3 启动时序说明

| 步骤 | 组件 | 说明 |
|------|------|------|
| 1 | EventBus | 事件总线，纯内存数据结构，无 I/O，零开销 |
| 2 | SessionManager | 被 EngineFacade 内部创建，纯注册表，无 I/O |
| 3 | EngineFacade | 封装 SessionManager，提供业务层 API |
| 4 | AgentEngine | 持有上述组件的引用，对外暴露统一 API |

整个启动流程为纯同步操作，无异步 I/O，启动时间可忽略不计。

---

## 三、配置结构

### 3.1 AgentEngineConfig

```typescript
interface AgentEngineConfig {
  /** 系统提示词（可选，支持字符串或异步函数） */
  systemPrompt?: string | (() => Promise<string>)

  /** 可选扩展点 */
  extensions?: {
    tools?: ToolExtension[]      // 用户自定义工具
    skills?: SkillExtension[]    // 用户自定义技能
  }

  /** 引擎选项 */
  options?: {
    maxConcurrentSessions?: number   // 最大并发 Session 数
    workspaceRoot?: string           // 工作空间根目录
  }

  /** 记忆存储根目录（用户级记忆隔离） */
  memoryRoot?: string
}
```

### 3.2 设计决策

| 决策 | 理由 |
|------|------|
| 不需要配置 LLM Provider | LLM 调用由 Claude Code 原始机制管理（环境变量配置 API Key），框架不包装 |
| 不需要配置内置工具 | 55+ 内置工具由 Claude Code 原始 `tools.ts` 自动加载 |
| extensions.tools 可选 | 用户按需注入自定义工具，会被 Bridge 适配为 CC Tool 类型后合并 |
| extensions.skills 可选 | 用户按需注入 Skill，会被写入 workspace/.claude/skills/ |
| systemPrompt 可选 | 支持字符串或异步函数，per-session 可覆盖 |

---

## 四、使用示例

### 4.1 最小启动

```typescript
import { AgentEngine } from '@agent-engine/core'

const engine = AgentEngine.create({})
```

### 4.2 完整配置启动

```typescript
const engine = AgentEngine.create({
  systemPrompt: '你是一个代码助手',
  extensions: {
    tools: [myCustomTool],
    skills: [{ name: 'my-skill', content: '...' }],
  },
  options: {
    maxConcurrentSessions: 10,
    workspaceRoot: '/path/to/project',
  },
  memoryRoot: '/path/to/memory',
})

// 启动后即可使用
const sessionId = await engine.createSession({ workspace: '/path/to/project' })
for await (const message of engine.query(sessionId, '分析这个文件')) {
  console.log(message)
}
```

### 4.3 测试环境

```typescript
const engine = AgentEngine.create({})  // 无需任何 Provider 配置
const sessionId = await engine.createSession({ workspace: '/tmp/test' })
```

---

## 五、错误处理

`AgentEngine.create()` 本身不执行 I/O，不会抛出业务异常。运行时错误通过 `EngineError` 统一管理：

| 错误码 | 触发场景 |
|--------|----------|
| `SESSION_NOT_FOUND` | 操作不存在的 Session |
| `SESSION_WORKSPACE_CONFLICT` | workspace 已被其他 Session 占用 |
| `SESSION_LIMIT_EXCEEDED` | 超过 maxConcurrentSessions 限制 |
| `SESSION_ALREADY_DESTROYED` | 操作已销毁的 Session |
| `EXECUTION_ERROR` | Query 执行失败或引擎已销毁 |

---

## 六、与旧设计的对比

| 维度 | 旧设计（已废弃） | 当前实现 |
|------|------------------|----------|
| 启动入口 | `bootstrap(config)` 独立函数 | `AgentEngine.create(config)` 静态工厂 |
| Provider 机制 | ProviderFactory + 注册表 + 创建 + 初始化 | 无，直接使用 Claude Code 原始能力 |
| 依赖注入容器 | ExecutionContext（6 种 Provider） | AgentEngine 持有 EventBus + EngineFacade |
| 配置结构 | AgentConfig（含 providers 声明） | AgentEngineConfig（仅 extensions + options） |
| 启动步骤 | 6 步（注册→加载→创建→初始化→注入→Engine） | 3 步（EventBus→Facade→Engine） |
| 异步操作 | Provider 异步初始化 + 健康检查 | 纯同步，无 I/O |

---

## 七、相关文档

- [架构设计](../../architecture-design.md) — 整体架构分层与模块职责
- [Engine Facade 设计](engine-facade-design.md) — Session 管理门面详细设计
- [Event Bus 设计](event-bus-design.md) — 事件总线详细设计
- [Extension 模型设计](extension-model-design.md) — Tool/Skill 扩展点设计
