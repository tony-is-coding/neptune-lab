# 全局日志体系设计文档

> **文档状态**：📋 设计中 | 创建时间：2026-04-24

## 一、功能概述

### 功能目标

收敛 `src/../` 中散落的 174 个 console 调用，构建统一的日志管理体系，提供：
- 全局统一的日志调用入口（LogUtil）
- 标准化的日志格式输出
- 可插拔的日志存储后端（LogStore Provider + Strategy）
- 与现有 EngineLogger / ObservabilityContext 的兼容集成

### 解决的问题

| 现状问题 | 目标状态 |
|---------|---------|
| 174 个 console 调用散落在 33 个文件中 | 统一通过 LogUtil 调用 |
| 无标准日志格式 | 固定格式：`{level} {time} [{file:line}] {message}: {params}` |
| 无日志持久化 | 默认写入本地文件，支持自定义 LogStore |
| 无日志级别控制 | 支持 debug/info/warn/error 级别过滤 |
| 现有 EngineLogger 仅用于 Engine 层 | LogUtil 覆盖全局，EngineLogger 作为 Engine 层适配 |

### 适用场景

1. **框架开发者**：使用 LogUtil 替代 console，获得格式化 + 持久化能力
2. **Engine 使用者**：通过 AgentEngineConfig 注入自定义 LogStore，实现日志集中收集
3. **运维排查**：通过本地日志文件回溯问题，日志格式统一便于 grep

## 二、设计目标

### 功能性目标
- 提供 `LogUtil` 全局单例，暴露 `debug/info/warn/error` 方法
- 日志输出格式：`{LEVEL} {ISO时间} [{文件:行号}] {message}; {key=value params}`
- 默认 FileLogStore 写入本地文件，路径通过环境变量 `AGENT_ENGINE_LOG_DIR` 配置
- LogStore 接口开放，用户可实现自定义存储（远程、数据库等）
- LogFormatter 接口开放，用户可替换格式化策略

### 非功能性目标
- 文件+行号获取的运行时开销可通过配置关闭
- 日志写入不阻塞主流程（异步批量写入）
- 与现有 EngineLogger 接口兼容，可作为其实现

### 约束条件
- 不修改 EngineLogger 接口定义
- 遵循项目 Provider + 接口契约模式
- 最小改动原则，优先包裹和外扩

## 三、技术方案

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│                    调用方                             │
│  (src/../ 各模块、Engine 层、测试代码)            │
└──────────────────────┬──────────────────────────────┘
                       │ LogUtil.info("msg", {k: v})
                       ▼
┌─────────────────────────────────────────────────────┐
│                   LogUtil (全局单例)                   │
│  - debug / info / warn / error                       │
│  - child(name) 创建子 logger                          │
│  - 级别过滤                                           │
│  - 调用位置捕获 (可配置)                               │
└──────┬──────────────────┬───────────────────────────┘
       │                  │
       ▼                  ▼
┌──────────────┐  ┌──────────────────┐
│ LogFormatter │  │    LogProvider    │
│  (格式化策略)  │  │   (输出通道)      │
│              │  │                  │
│ 默认实现:     │  │ ConsoleProvider  │
│ StandardFmt  │  │ (默认，输出到终端) │
└──────┬───────┘  └──────────────────┘
       │
       ▼
┌──────────────────┐
│    LogStore       │
│  (持久化策略)      │
│                   │
│ FileLogStore      │
│ (默认，写入文件)   │
│                   │
│ 用户可实现:        │
│ - RemoteLogStore  │
│ - SQLiteLogStore  │
└───────────────────┘
```

### 3.2 核心组件

#### 组件职责

| 组件 | 职责 | 默认实现 |
|------|------|---------|
| LogUtil | 全局日志入口，级别过滤，调用位置捕获 | 单例 |
| LogFormatter | 将日志记录格式化为字符串 | StandardLogFormatter |
| LogProvider | 日志输出通道（终端显示） | ConsoleLogProvider |
| LogStore | 日志持久化存储 | FileLogStore |

#### 组件关系

```
LogUtil ──uses──▶ LogFormatter (格式化)
       ──uses──▶ LogProvider  (输出到终端)
       ──uses──▶ LogStore     (持久化到文件)
```

- LogFormatter 只负责格式化，不负责输出
- LogProvider 负责实时输出（终端），使用 LogFormatter 格式化后的字符串
- LogStore 负责持久化，独立于 LogProvider，接收结构化的 LogRecord

### 3.3 核心流程

```
调用方: LogUtil.info("MCP warmup failed", { attempt: 1, error: "No context" })
  │
  ├─ 1. 级别检查：info >= 当前级别？ → 通过
  │
  ├─ 2. 捕获调用位置（如果 includeCallSite=true）
  │     → 解析 Error().stack → "packages/opencode/src/server/server.ts:1278"
  │
  ├─ 3. 构建 LogRecord
  │     { level, timestamp, callSite?, message, attrs, loggerName }
  │
  ├─ 4. LogFormatter.format(record) → 格式化字符串
  │     → "INFO 2026-04-24T01:35:26 [server.ts:1278] MCP warmup failed; attempt=1 error=No context"
  │
  ├─ 5. LogProvider.write(formattedString, level)
  │     → console[level](formattedString)
  │
  └─ 6. LogStore.append(record)  [异步，不阻塞]
        → 写入日志文件
```

### 3.4 数据结构

```typescript
/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** 调用位置信息 */
export interface CallSite {
  file: string    // 相对路径，如 "src/server/server.ts"
  line: number    // 行号
}

/** 结构化日志记录 */
export interface LogRecord {
  level: LogLevel
  timestamp: Date
  callSite?: CallSite
  message: string
  attrs?: Record<string, unknown>
  loggerName?: string  // child logger 名称链，如 "engine:session"
}

/** 日志系统配置 */
export interface LogConfig {
  /** 最低日志级别，默认 'info' */
  level?: LogLevel
  /** 是否捕获调用位置（文件+行号），默认 true */
  includeCallSite?: boolean
  /** 自定义格式化器 */
  formatter?: LogFormatter
  /** 自定义输出通道 */
  provider?: LogProvider
  /** 自定义持久化存储 */
  store?: LogStore
  /** 日志文件根目录，默认读取环境变量 AGENT_ENGINE_LOG_DIR */
  logDir?: string
}
```

## 四、接口设计

### 4.1 LogFormatter 接口

```typescript
/** 日志格式化策略 */
export interface LogFormatter {
  /** 将 LogRecord 格式化为输出字符串 */
  format(record: LogRecord): string
}
```

**默认实现 StandardLogFormatter：**

```typescript
export class StandardLogFormatter implements LogFormatter {
  format(record: LogRecord): string {
    const level = record.level.toUpperCase().padEnd(5)
    const time = record.timestamp.toISOString()
    const site = record.callSite
      ? ` [${record.callSite.file}:${record.callSite.line}]`
      : ''
    const name = record.loggerName ? ` <${record.loggerName}>` : ''
    const attrs = record.attrs
      ? '; ' + Object.entries(record.attrs)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')
      : ''
    return `${level} ${time}${site}${name} ${record.message}${attrs}`
  }
}
```

输出示例：
```
DEBUG 2026-04-24T01:35:26.000Z [src/server/server.ts:1278] MCP warmup failed; attempt=1 error=No context found
INFO  2026-04-24T01:35:27.000Z [src/daemon/main.ts:45] <daemon:worker> Worker started; pid=12345
ERROR 2026-04-24T01:35:28.000Z [src/setup.ts:120] Authentication failed; provider=oauth
```

### 4.2 LogProvider 接口

```typescript
/** 日志输出通道 */
export interface LogProvider {
  /** 输出一条格式化后的日志 */
  write(formattedMessage: string, level: LogLevel): void
  /** 释放资源（可选） */
  dispose?(): void
}
```

**默认实现 ConsoleLogProvider：**

```typescript
export class ConsoleLogProvider implements LogProvider {
  write(formattedMessage: string, level: LogLevel): void {
    console[level](formattedMessage)
  }
}
```

### 4.3 LogStore 接口

```typescript
/** 日志持久化存储 */
export interface LogStore {
  /** 追加一条日志记录（异步） */
  append(record: LogRecord): void
  /** 刷新缓冲区，确保所有日志写入完成 */
  flush(): Promise<void>
  /** 释放资源 */
  dispose(): Promise<void>
}
```

**默认实现 FileLogStore：**

```typescript
export class FileLogStore implements LogStore {
  private buffer: string[] = []
  private readonly formatter: LogFormatter
  private readonly logDir: string
  private flushTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: {
    logDir: string
    formatter?: LogFormatter
    /** 缓冲区刷新间隔（ms），默认 1000 */
    flushInterval?: number
  }) {
    this.logDir = options.logDir
    this.formatter = options.formatter ?? new StandardLogFormatter()
    // 启动定时刷新
    const interval = options.flushInterval ?? 1000
    this.flushTimer = setInterval(() => this.flush(), interval)
  }

  append(record: LogRecord): void {
    const line = this.formatter.format(record)
    this.buffer.push(line)
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    const lines = this.buffer.splice(0)
    const fileName = this.getLogFileName()
    const filePath = path.join(this.logDir, fileName)
    await fs.appendFile(filePath, lines.join('\n') + '\n')
  }

  async dispose(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer)
    await this.flush()
  }

  /** 按日期分割日志文件：agent-engine-2026-04-24.log */
  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0]
    return `agent-engine-${date}.log`
  }
}
```

**环境变量配置：**
- `AGENT_ENGINE_LOG_DIR`：日志文件根目录，默认 `~/.agent-engine/logs/`

### 4.4 LogUtil 全局入口

```typescript
export class LogUtil implements EngineLogger {
  private static instance: LogUtil | null = null
  private readonly config: Required<LogConfig>
  private readonly names: string[]

  /** 获取全局单例 */
  static getInstance(): LogUtil { ... }

  /** 初始化配置（应用启动时调用一次） */
  static initialize(config?: LogConfig): void { ... }

  debug(msg: string, attrs?: Record<string, unknown>): void { ... }
  info(msg: string, attrs?: Record<string, unknown>): void { ... }
  warn(msg: string, attrs?: Record<string, unknown>): void { ... }
  error(msg: string, attrs?: Record<string, unknown>): void { ... }

  /** 创建子 logger，继承配置 */
  child(name: string): LogUtil { ... }

  /** 优雅关闭，刷新缓冲区 */
  static async shutdown(): Promise<void> { ... }
}
```

**使用方式：**

```typescript
// 1. 应用启动时初始化（可选，不初始化则使用默认配置）
import { LogUtil } from './log/LogUtil'
LogUtil.initialize({
  level: 'debug',
  logDir: '/var/log/agent-engine',
})

// 2. 各模块中使用
const logger = LogUtil.getInstance()
logger.info('Server started', { port: 3000 })

// 3. 创建子 logger
const daemonLogger = logger.child('daemon')
daemonLogger.info('Worker started', { pid: 12345 })
// 输出: INFO 2026-04-24T01:35:26.000Z [daemon/main.ts:45] <daemon> Worker started; pid=12345

// 4. 应用退出时关闭
await LogUtil.shutdown()
```

### 4.5 与现有 EngineLogger 的兼容

LogUtil 实现 EngineLogger 接口，可直接注入 ObservabilityContext：

```typescript
// Engine 层使用
const obsCtx = createObservabilityContext({
  logger: LogUtil.getInstance().child('engine'),
})
```

现有 ConsoleLogger 保持不动，LogUtil 是新增的全局方案，两者通过 EngineLogger 接口兼容。

## 五、实现计划

### 阶段一：核心接口 + 默认实现

1. 定义 LogRecord、LogFormatter、LogProvider、LogStore 接口
2. 实现 StandardLogFormatter
3. 实现 ConsoleLogProvider
4. 实现 FileLogStore（含异步批量写入）
5. 实现 LogUtil 全局单例
6. 实现 CallSite 捕获工具函数

### 阶段二：集成 + 替换

1. 在 `src/../` 中逐模块替换 console 调用为 LogUtil
2. 优先替换高频文件（daemon/main.ts、bridge/bridgeMain.ts 等）
3. 与 ObservabilityContext 集成

### 阶段三：测试 + 验证

1. 编写 CLI 测试工具
2. 验证日志格式输出正确
3. 验证 FileLogStore 文件写入
4. 验证自定义 Provider/Store 注入
5. 回归测试确保现有功能不受影响

## 六、测试计划

### 测试策略

按照项目 TDD 规范，测试代码放在 `claude-code-framework-test/phase-log-optimizer/`

### 核心测试用例

| 测试场景 | 验证点 |
|---------|--------|
| LogUtil 基础调用 | debug/info/warn/error 输出正确 |
| 级别过滤 | 低于配置级别的日志不输出 |
| 格式化输出 | 符合 `{LEVEL} {TIME} [{FILE:LINE}] {MSG}; {PARAMS}` |
| CallSite 捕获 | 文件路径和行号正确 |
| FileLogStore 写入 | 日志文件按日期分割，内容正确 |
| 异步批量写入 | 不阻塞主流程，flush 后数据完整 |
| 自定义 LogStore | 用户实现的 Store 被正确调用 |
| 自定义 LogFormatter | 用户实现的 Formatter 被正确使用 |
| child logger | 名称链正确传递 |
| EngineLogger 兼容 | LogUtil 可注入 ObservabilityContext |
| 环境变量配置 | AGENT_ENGINE_LOG_DIR 生效 |
| shutdown 优雅关闭 | 缓冲区数据全部写入 |

### 验收标准

1. 所有 console 调用替换为 LogUtil，无遗漏
2. 日志输出格式符合规范
3. FileLogStore 正确写入本地文件
4. 自定义 Provider/Store 可正常注入和使用
5. 现有功能回归测试通过
