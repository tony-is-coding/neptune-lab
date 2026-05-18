# CCRuntime 设计文档

> 更新时间：2026-04-26
> 状态：已实现
> 文件：`src/engine/cc-runtime/CCRuntime.ts`

---

## 一、设计目标

### 1.1 核心问题

Claude Code 原始代码中，运行时环境访问散落在各个模块：
- `src/bootstrap/state.ts`：全局单例（cwd、projectRoot）
- `src/QueryEngine.ts`：直接 import 工具列表和配置
- `src/utils/config.ts`：配置系统初始化
- 测试时难以 mock 这些依赖

### 1.2 解决方案

创建 `CCRuntime` 作为 Claude Code 运行时环境的统一抽象：
- **最小抽象**：只暴露当前需要的方法
- **接口隔离**：按职责分组方法
- **测试友好**：MockCCRuntime 可轻松替换实现
- **类型安全**：提供完整的 TypeScript 类型定义

---

## 二、架构设计

### 2.1 核心职责

CCRuntime 接口提供以下能力：

| 职责组 | 方法 | 说明 |
|--------|------|------|
| **工具相关** | `getAllBaseTools()` | 获取 CC 内置工具列表 |
| **运行时初始化** | `enableConfigs()` | 启用配置系统 |
| | `setupBootstrap()` | 设置 bootstrap 单例（cwd/projectRoot） |
| **QueryEngine 相关** | `createQueryEngine()` | 创建 QueryEngine 实例 |
| **Transcript 相关** | `loadTranscriptFromFile()` | 加载 transcript 文件 |
| **SessionContext 相关** | `getMemoryPath()` | 获取当前 Session 的记忆路径 |
| **MACRO Defines** | `injectMacroDefines()` | 注入 MACRO defines 到 globalThis |
| **状态管理** | `isInitialized()` | 检查运行时是否已初始化 |
| | `markInitialized()` | 标记运行时已初始化 |
| **多 Workspace 支持** | `runWithCwd()` | 在指定的 cwd 上下文中执行函数 |
| | `isWorkspaceInitialized()` | 检查 workspace 是否已初始化 |
| | `markWorkspaceInitialized()` | 标记 workspace 已初始化 |

### 2.2 接口定义

```typescript
interface CCRuntime {
  // ---------- 工具相关 ----------
  getAllBaseTools(): Tools

  // ---------- 运行时初始化 ----------
  enableConfigs(): void
  setupBootstrap(state: BootstrapState): void

  // ---------- QueryEngine 相关 ----------
  createQueryEngine(config: QueryEngineConfig): QueryEngineWrapper

  // ---------- Transcript 相关 ----------
  loadTranscriptFromFile(path: string): Promise<TranscriptLoadResult>

  // ---------- SessionContext 相关 ----------
  getMemoryPath(): string | undefined

  // ---------- MACRO Defines ----------
  injectMacroDefines(): void

  // ---------- 状态管理 ----------
  isInitialized(): boolean
  markInitialized(): void
  resetForTesting?(): void

  // ---------- 多 Workspace 支持 ----------
  runWithCwd<T>(cwd: string, fn: () => T): T
  isWorkspaceInitialized(workspace: string): boolean
  markWorkspaceInitialized(workspace: string): void
}
```

---

## 三、类型定义

### 3.1 BootstrapState

```typescript
interface BootstrapState {
  cwd: string           // 当前工作目录
  originalCwd: string   // 原始工作目录
  projectRoot: string   // 项目根目录
}
```

### 3.2 MacroDefines

```typescript
interface MacroDefines {
  VERSION: string              // 版本号
  BUILD_TIME: string           // 构建时间
  FEEDBACK_CHANNEL: string     // 反馈渠道
  ISSUES_EXPLAINER: string     // 问题解释
  NATIVE_PACKAGE_URL: string   // 原生包 URL
  PACKAGE_URL: string          // 包 URL
  VERSION_CHANGELOG: string    // 版本变更日志
}
```

### 3.3 QueryEngineWrapper

```typescript
interface QueryEngineWrapper {
  submitMessage: (...args: unknown[]) => AsyncGenerator<unknown, void, unknown>
}
```

### 3.4 TranscriptLoadResult

```typescript
interface TranscriptLoadResult {
  messages: unknown[]
  [key: string]: unknown
}
```

---

## 四、实现细节

### 4.1 DefaultCCRuntime

`DefaultCCRuntime` 是 `CCRuntime` 接口的默认实现，直接调用 Claude Code 原始模块：

```typescript
class DefaultCCRuntime implements CCRuntime {
  getAllBaseTools(): Tools {
    // 直接调用原始工具注册
    const { getAllBaseTools } = require('../tools')
    return getAllBaseTools()
  }

  createQueryEngine(config: QueryEngineConfig): QueryEngineWrapper {
    // 直接调用原始 QueryEngine 构造函数
    const QueryEngine = require('../QueryEngine')
    return new QueryEngine(config)
  }

  // ... 其他方法
}
```

### 4.2 MockCCRuntime

`MockCCRuntime` 用于测试，提供 mock 实现：

```typescript
class MockCCRuntime implements CCRuntime {
  private _initialized = false
  private _workspaces = new Set<string>()

  getAllBaseTools(): Tools {
    return [] // 返回空工具列表
  }

  createQueryEngine(): QueryEngineWrapper {
    return {
      submitMessage: async function* () {
        yield { type: 'text', text: 'Mock response' }
      }
    }
  }

  // ... 其他 mock 方法
}
```

### 4.3 全局单例访问

```typescript
// 获取全局 CCRuntime 实例
const runtime = getGlobalCCRuntime()

// 在测试中替换为 mock
setGlobalCCRuntime(new MockCCRuntime())
```

---

## 五、使用方式

### 5.1 在框架层使用

```typescript
import { getGlobalCCRuntime } from './engine/cc-runtime'

const runtime = getGlobalCCRuntime()

// 获取内置工具
const tools = runtime.getAllBaseTools()

// 创建 QueryEngine
const qe = runtime.createQueryEngine(config)

// 加载 transcript
const transcript = await runtime.loadTranscriptFromFile(path)
```

### 5.2 在测试中使用

```typescript
import { setGlobalCCRuntime, MockCCRuntime } from './engine/cc-runtime'

beforeEach(() => {
  setGlobalCCRuntime(new MockCCRuntime())
})

test('should use mock runtime', async () => {
  const runtime = getGlobalCCRuntime()
  const tools = runtime.getAllBaseTools()
  expect(tools).toEqual([])
})
```

---

## 六、多 Workspace 支持

### 6.1 AsyncLocalStorage 上下文

CCRuntime 使用 AsyncLocalStorage 管理多 workspace 并发：

```typescript
import { AsyncLocalStorage } from 'node:async_hooks'

const cwdContext = new AsyncLocalStorage<string>()

runtime.runWithCwd('/path/to/workspace', () => {
  // 在这个回调内，所有 getCwd() 调用都返回 '/path/to/workspace'
  const current = getCwd() // '/path/to/workspace'
})
```

### 6.2 Workspace 初始化状态

```typescript
// 检查 workspace 是否已初始化
if (!runtime.isWorkspaceInitialized(workspace)) {
  // 初始化 workspace
  await initializeWorkspace(workspace)
  runtime.markWorkspaceInitialized(workspace)
}
```

---

## 七、设计决策

### 7.1 为什么需要 CCRuntime 抽象？

1. **测试隔离**：框架层代码依赖 CC 运行时，抽象后可以轻松 mock
2. **接口清晰**：统一管理所有 CC 运行时访问点
3. **未来扩展**：为多进程、多 worker 支持预留接口

### 7.2 为什么不直接依赖原始模块？

直接依赖会导致：
- 测试困难：无法 mock 全局单例
- 耦合严重：散落在各处的 import 难以追踪
- 扩展受限：无法支持多进程等高级场景

### 7.3 为什么使用接口而非类？

- **灵活性**：可以有多种实现（Default、Mock、Remote）
- **类型安全**：TypeScript 接口提供完整的类型检查
- **零运行时开销**：接口在编译后不存在

---

## 八、验证标准

### 8.1 类型检查

```bash
bunx tsc --noEmit
# 必须零错误
```

### 8.2 功能测试

```typescript
import { getGlobalCCRuntime } from './engine/cc-runtime'

const runtime = getGlobalCCRuntime()

// 测试工具获取
const tools = runtime.getAllBaseTools()
console.assert(Array.isArray(tools), 'Tools should be array')

// 测试 QueryEngine 创建
const qe = runtime.createQueryEngine(config)
console.assert(typeof qe.submitMessage === 'function', 'Should have submitMessage')
```

### 8.3 Mock 测试

```typescript
const mock = new MockCCRuntime()
setGlobalCCRuntime(mock)

const runtime = getGlobalCCRuntime()
console.assert(runtime === mock, 'Should use mock runtime')
```

---

## 九、后续优化

### 9.1 RemoteCCRuntime

未来可以实现 RemoteCCRuntime，支持跨进程调用：
- 通过 IPC 调用远程 CC 运行时
- 支持多 worker 模式
- 支持分布式部署

### 9.2 缓存机制

- 缓存工具列表，避免重复计算
- 缓存 transcript 解析结果
- 缓存 workspace 初始化状态

### 9.3 错误处理增强

- 统一错误类型定义
- 提供更详细的错误信息
- 支持错误恢复策略

---

## 十、相关文档

- [架构设计文档](../../architecture.md)
- [分层架构标准](../../../architecture-layering-standard.md)
- [SessionContext 设计文档](./session-context-design.md)（待创建）
- [Bootstrap 设计文档](./bootstrap-design.md)
