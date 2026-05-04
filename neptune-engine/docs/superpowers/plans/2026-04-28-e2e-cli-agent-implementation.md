# e2e CLI 多用户 Agent 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 Agent Engine SDK V5 构建一个多用户、重启可恢复、UI 交互完备的终端 CLI Agent

**Architecture:** 渐进增强现有代码，新增欢迎页模块（从 PG 查询会话）、增强 REPL（readline 历史/Tab 补全/颜色）、富文本渲染（chalk + cli-highlight）、状态仪表盘、扩展命令集（Provider/Hook/EventBus 等框架特性展示）。CLI 无状态，所有状态从 PG 读取。

**Tech Stack:** TypeScript, Bun, readline, chalk, cli-highlight, Agent Engine SDK (claude-code-best), PostgreSQL

---

## Task 1: 安装新依赖 + 创建框架需求清单

**Files:**
- Modify: `package.json`
- Create: `framework-requirements.md`

- [ ] **Step 1: 安装 chalk 和 cli-highlight**

```bash
cd ~/startups/claude-not-only-code/claude_code_framework_e2e_cli
bun add chalk cli-highlight
```

Run: `bun install`
Expected: 依赖安装成功，`bun.lock` 更新

- [ ] **Step 2: 创建 framework-requirements.md**

在 `claude_code_framework_e2e_cli/` 根目录创建文件：

```markdown
# 框架需求清单

> 记录 e2e_cli 开发过程中发现的 Agent Engine SDK 不足，作为框架后续优化的输入。

| # | 需求 | 说明 | 优先级 |
|---|------|------|--------|
| FR-1 | IMemoryProvider 接口 | SDK 用户自定义记忆加载/存储策略，替代封闭的 memdir | P0 |
| FR-2 | 自定义记忆目录 | getAutoMemPath() 支持SDK级别覆盖（不依赖 feature gate） | P0 |
| FR-3 | 记忆注入钩子 | systemPrompt 构建时提供记忆注入扩展点 | P1 |
| FR-4 | 记忆变更事件 | EventBus 支持 memory:updated 事件类型 | P1 |
| FR-5 | per-session CLAUDE.md | CLAUDE.md 从 memoryPath 查找而非仅从 CWD | P2 |
| FR-6 | forkedAgent SDK 暴露 | 允许 SDK 用户运行后台记忆提取 subagent | P2 |
```

- [ ] **Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock framework-requirements.md
git commit -m "chore: 添加 chalk/cli-highlight 依赖 + 框架需求清单"
```

---

## Task 2: 增强型 REPL — readline 历史 + Tab 补全 + 彩色输出

**Files:**
- Modify: `src/cli/repl.ts`
- Modify: `src/cli/display.ts`

这是所有后续任务的基础 — 先让 REPL 本身更好用。

- [ ] **Step 1: 修改 repl.ts — 添加命令历史和 Tab 补全**

在 `src/cli/repl.ts` 中：

1. 将 `readline.createInterface` 增加配置：
   - `historySize: 100` 启用命令历史
   - `completer` 函数实现 Tab 补全，补全 `/` 开头的命令

2. completer 函数定义（在 startREPL 函数外部）：

```typescript
const COMMANDS = ['/help', '/quit', '/exit', '/login', '/logout', '/sessions',
  '/session', '/stats', '/settings', '/roles', '/resume', '/history',
  '/provider', '/events', '/compact']

function completer(line: string): [string[], string] {
  const hits = COMMANDS.filter(cmd => cmd.startsWith(line))
  return [hits.length ? hits : COMMANDS, line]
}
```

3. readline 创建改为：
```typescript
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  historySize: 100,
  completer,
})
```

- [ ] **Step 2: 修改 display.ts — 引入 chalk 彩色输出**

在 `src/cli/display.ts` 头部添加 `import chalk from 'chalk'`

然后逐步改造以下函数使用彩色：
- `printBanner()`: 标题用 `chalk.cyan.bold`，版本号用 `chalk.dim`
- `printHelp()`: 命令名用 `chalk.green`，描述用 `chalk.dim`
- `printSessionList()`: 会话 ID 用 `chalk.yellow`，角色用 `chalk.cyan`
- `printTokenStats()`: Token 数字用 `chalk.gray`
- `printToolCall()`: 工具名用 `chalk.blue`，详情用 `chalk.dim`
- `printToolResult()`: 成功用 `chalk.green`，失败用 `chalk.red`
- `printLifecycleEvent()`: 标签用 `chalk.magenta`
- `printInterrupted()`: 用 `chalk.yellow`

- [ ] **Step 3: 验证**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/cli/repl.ts src/cli/display.ts
git commit -m "feat: 增强型 REPL — 命令历史 + Tab 补全 + chalk 彩色输出"
```

---

## Task 3: 富文本渲染模块

**Files:**
- Create: `src/cli/rich-text.ts`
- Modify: `src/cli/repl.ts` (使用 rich-text 渲染 LLM 输出)

- [ ] **Step 1: 创建 src/cli/rich-text.ts**

实现 Markdown 基础语法 → ANSI 转换 + 代码高亮：

```typescript
import chalk from 'chalk'
import hljs from 'cli-highlight'

/**
 * 将 Markdown 文本渲染为终端 ANSI 格式
 * 支持：标题、加粗、列表、行内代码、代码块（语法高亮）
 */
export function renderMarkdown(text: string): string {
  let result = ''

  // 按代码块分割处理
  const parts = text.split(/(```[\s\S]*?```)/g)

  for (const part of parts) {
    if (part.startsWith('```')) {
      result += renderCodeBlock(part)
    } else {
      result += renderInlineMarkdown(part)
    }
  }

  return result
}

function renderCodeBlock(block: string): string {
  const match = block.match(/^```(\w*)\n([\s\S]*?)```$/)
  if (!match) return block

  const lang = match[1] || ''
  const code = match[2].trimEnd()

  const highlighted = lang
    ? hljs.highlight(code, { language: lang }).value
    : hljs.highlightAuto(code).value

  return '\n' + chalk.dim('─'.repeat(40)) + '\n' +
    highlighted + '\n' +
    chalk.dim('─'.repeat(40)) + '\n'
}

function renderInlineMarkdown(text: string): string {
  return text
    // 标题
    .replace(/^### (.+)$/gm, (_, t) => chalk.bold.cyan(`### ${t}`))
    .replace(/^## (.+)$/gm, (_, t) => chalk.bold.cyan(`## ${t}`))
    .replace(/^# (.+)$/gm, (_, t) => chalk.bold.cyan(`# ${t}`))
    // 加粗
    .replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.bold(t))
    // 行内代码
    .replace(/`([^`]+)`/g, (_, t) => chalk.yellow(t))
    // 无序列表（保持格式）
    .replace(/^(\s*[-*]) /gm, '$1 ')
}

/**
 * 渲染 LLM 输出（流式增量文本）
 * 仅对完整行做 Markdown 渲染，避免中途截断
 */
export function renderLLMOutput(text: string): string {
  return renderMarkdown(text)
}
```

- [ ] **Step 2: 在 repl.ts 的 processQuery 中使用富文本渲染**

在 `repl.ts` 中，找到 `if (text.length > lastPrintedLength)` 的增量输出部分，将：
```typescript
const newPart = text.substring(lastPrintedLength)
process.stdout.write(newPart)
```

改为：
```typescript
const newPart = text.substring(lastPrintedLength)
// 仅在最终输出时做完整渲染；流式增量直接输出（避免中途截断标记）
process.stdout.write(newPart)
```

并在最终输出（`if (fullText)` 块）时，增加可选的完整渲染：
```typescript
// 不再重复输出 fullText（流式已经输出了），只做换行
if (fullText) {
  process.stdout.write('\n')
}
```

> 注意：流式输出期间不做 Markdown 渲染（会截断标记），仅在工具调用展示等完整文本场景使用 rich-text。

- [ ] **Step 3: 验证**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/cli/rich-text.ts src/cli/repl.ts
git commit -m "feat: 富文本渲染模块 — Markdown + 代码语法高亮"
```

---

## Task 4: 状态仪表盘

**Files:**
- Create: `src/cli/status-bar.ts`
- Modify: `src/cli/display.ts` (getPrompt 集成状态栏)
- Modify: `src/config.ts` (新增 prompt 配置)

- [ ] **Step 1: 创建 src/cli/status-bar.ts**

```typescript
import chalk from 'chalk'
import { getCurrentUser } from '../auth/auth-manager.js'
import { getCurrentSessionId } from './commands.js'

interface StatusBarData {
  username?: string
  sessionTitle?: string
  turnCount: number
  totalTokens: number
  totalCost: number
  activeSessions: number
}

let statusBarData: StatusBarData = {
  turnCount: 0,
  totalTokens: 0,
  totalCost: 0,
  activeSessions: 0,
}

export function updateStatusBar(data: Partial<StatusBarData>): void {
  statusBarData = { ...statusBarData, ...data }
}

export function getStatusBarWidth(): number {
  return 80
}

export function renderStatusBar(): string {
  const user = getCurrentUser()
  if (!user) return ''

  const sid = getCurrentSessionId()
  const width = Math.min(process.stdout.columns || 80, 100)
  const innerWidth = width - 4 // 减去左右边框

  // 用户名
  const userPart = chalk.bold.cyan(user.username)
  // 会话 ID（短）
  const sessionPart = sid ? chalk.dim(`@ ${sid.substring(0, 8)}`) : chalk.dim('(无会话)')
  // 统计
  const stats = [
    `Turn: ${statusBarData.turnCount}`,
    `Token: ${formatNumber(statusBarData.totalTokens)}`,
    `Cost: $${statusBarData.totalCost.toFixed(4)}`,
    `Sessions: ${statusBarData.activeSessions}`,
  ].map(s => chalk.gray(s)).join(' ── ')

  const left = `${userPart} ${sessionPart}`
  const separator = chalk.dim('───')
  const content = `${left} ${separator} ${stats}`

  const top = chalk.dim('┌' + '─'.repeat(innerWidth) + '┐')
  const bottom = chalk.dim('└' + '─'.repeat(innerWidth) + '┘')

  return `\n${top}\n│ ${content} │\n${bottom}\n`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
```

- [ ] **Step 2: 修改 display.ts 的 getPrompt 集成状态栏**

在 `display.ts` 中修改 `getPrompt()` 函数：

```typescript
import { renderStatusBar } from './status-bar.js'

export function getPrompt(): string {
  const user = getCurrentUser()
  const sessionId = getCurrentSessionId()

  const statusBar = renderStatusBar()

  if (!user) return `${statusBar}> `
  if (!sessionId) return `${statusBar}[${user.username}] > `
  return `${statusBar}[${user.username}:${sessionId.substring(0, 8)}] > `
}
```

- [ ] **Step 3: 在 repl.ts 中更新状态栏数据**

在 `repl.ts` 的 `processQuery` 结束时（result 事件处理后），调用：

```typescript
import { updateStatusBar } from './status-bar.js'
import { getEngineStats } from '../session/session-service.js'

// 在 processQuery 的 result 事件处理中，更新统计后：
const stats = getEngineStats()
updateStatusBar({
  turnCount: currentTurnCount,
  totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
  totalCost: totalCost,
  activeSessions: stats.activeSessions,
})
```

- [ ] **Step 4: 验证**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/cli/status-bar.ts src/cli/display.ts src/cli/repl.ts
git commit -m "feat: 底部状态仪表盘 — 用户/会话/Token/费用实时展示"
```

---

## Task 5: 欢迎页模块

**Files:**
- Create: `src/welcome/welcome-ui.ts`
- Create: `src/welcome/welcome.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: 创建 src/welcome/welcome-ui.ts**

```typescript
import chalk from 'chalk'

export function printWelcomeBanner(): void {
  console.log('')
  console.log(chalk.cyan.bold('  ╔══════════════════════════════════════════════╗'))
  console.log(chalk.cyan.bold('  ║') + chalk.bold.white('       🤖 Agent Engine CLI v4.0.0           ') + chalk.cyan.bold('║'))
  console.log(chalk.cyan.bold('  ║') + chalk.dim('   基于 Agent Engine SDK (V5 特性)           ') + chalk.cyan.bold('║'))
  console.log(chalk.cyan.bold('  ╚══════════════════════════════════════════════╝'))
  console.log('')
}

export function printLoginPrompt(): void {
  console.log(chalk.yellow('  请先登录以开始使用。'))
  console.log('')
  console.log(`  输入 ${chalk.green('/login -u <用户名> -p <密码>')} 登录`)
  console.log('')
}

export function printSessionPicker(sessions: Array<{ session_id: string; title: string; turn_count: number; updated_at: Date }>): void {
  console.log('')
  console.log(chalk.bold('  最近的会话：'))
  console.log(chalk.dim('  ' + '─'.repeat(50)))

  sessions.forEach((s, i) => {
    const time = new Date(s.updated_at).toLocaleString('zh-CN')
    const num = chalk.bold(`  ${i + 1}.`)
    const title = s.title.length > 30 ? s.title.substring(0, 30) + '...' : s.title
    console.log(`  ${num} ${chalk.cyan(`[${s.session_id.substring(0, 8)}]`)} ${title} ${chalk.dim(`(${s.turn_count}轮)`)} ${chalk.dim(time)}`)
  })

  console.log('')
  console.log(chalk.dim('  ─────────────────────────────────────────────────'))
  console.log(`  输入 ${chalk.green('数字')} 恢复对应会话`)
  console.log(`  输入 ${chalk.green('/session new [标题]')} 创建新会话`)
  console.log(`  输入 ${chalk.green('/help')} 查看全部命令`)
  console.log('')
}
```

- [ ] **Step 2: 创建 src/welcome/welcome.ts**

```typescript
import * as readline from 'readline'
import { login } from '../auth/auth-manager.js'
import { getCurrentUser } from '../auth/auth-manager.js'
import { listSessions } from '../session/session-service.js'
import { printWelcomeBanner, printLoginPrompt, printSessionPicker } from './welcome-ui.js'

/**
 * 欢迎页流程：登录 → 选择/创建会话
 * 返回 REPL 需要的初始状态（是否已有活跃会话）
 */
export async function runWelcome(): Promise<void> {
  printWelcomeBanner()

  // 如果已登录（当前进程内状态），跳过登录
  const user = getCurrentUser()
  if (!user) {
    printLoginPrompt()
    return
  }

  // 已登录 → 展示会话选择
  await showSessionPicker()
}

async function showSessionPicker(): Promise<void> {
  const user = getCurrentUser()
  if (!user) return

  const sessions = await listSessions(user)
  if (sessions.length === 0) {
    console.log(chalk.dim('  暂无会话。输入 /session new [标题] 创建新会话。'))
    return
  }

  printSessionPicker(sessions.slice(0, 5))

  // 交互式选择（非阻塞，用户也可以直接输入命令）
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const answer = await new Promise<string>(resolve => {
    rl.question(chalk.green('  > '), ans => {
      rl.close()
      resolve(ans.trim())
    })
  })

  // 数字选择 → 切换到对应会话
  const num = parseInt(answer, 10)
  if (!isNaN(num) && num >= 1 && num <= Math.min(sessions.length, 5)) {
    const selected = sessions[num - 1]
    // 通过命令机制处理（让 commands.ts 统一管理状态）
    const { handleCommand } = await import('../cli/commands.js')
    await handleCommand(`/session ${selected.session_id.substring(0, 8)}`)
  } else if (answer.startsWith('/')) {
    const { handleCommand } = await import('../cli/commands.js')
    await handleCommand(answer)
  }
  // 其他输入忽略，进入 REPL 主循环
}
```

> 注意：需要在 welcome.ts 头部加 `import chalk from 'chalk'`

- [ ] **Step 3: 修改 src/main.ts 集成欢迎页**

将 `src/main.ts` 改为：

```typescript
// 映射 LLM 环境变量
if (process.env.ENGINE_LLM_API_KEY) process.env.ANTHROPIC_API_KEY = process.env.ENGINE_LLM_API_KEY
if (process.env.ENGINE_LLM_BASE_URL) process.env.ANTHROPIC_BASE_URL = process.env.ENGINE_LLM_BASE_URL
if (process.env.ENGINE_LLM_MODEL) process.env.ANTHROPIC_MODEL = process.env.ENGINE_LLM_MODEL

// 禁用 Claude Code 项目级自动记忆
process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1'

import { runWelcome } from './welcome/welcome.js'

async function main(): Promise<void> {
  await runWelcome()

  // 欢迎页完成后启动 REPL
  const { startREPL } = await import('./cli/repl.js')
  await startREPL()
}

main().catch((err) => {
  console.error('启动失败:', err)
  process.exit(1)
})
```

- [ ] **Step 4: 验证**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/welcome/welcome-ui.ts src/welcome/welcome.ts src/main.ts
git commit -m "feat: 欢迎页模块 — 登录引导 + PG 会话列表选择"
```

---

## Task 6: 会话恢复增强 — PG 消息历史加载

**Files:**
- Modify: `src/session/pg-session-store.ts` (新增 loadRecentMessages)
- Modify: `src/session/session-service.ts` (恢复时加载历史)
- Modify: `src/cli/commands.ts` (/resume 和 /history 命令)

- [ ] **Step 1: 在 pg-session-store.ts 添加 loadRecentMessages**

```typescript
/** 加载最近 N 条消息（按 turn_number 降序取，返回时升序排列） */
export async function loadRecentMessages(
  sessionId: string,
  limit: number = 20,
): Promise<Array<{ role: string; content_summary: string; turn_number: number }>> {
  const result = await query(
    `SELECT role, content_summary, turn_number
     FROM session_messages
     WHERE session_id = $1
     ORDER BY turn_number DESC
     LIMIT $2`,
    [sessionId, limit]
  )
  // 返回时反转回升序
  return result.rows.reverse() as Array<{ role: string; content_summary: string; turn_number: number }>
}
```

- [ ] **Step 2: 在 session-service.ts 增强 switchSession 的恢复逻辑**

在 `switchSession` 函数中，恢复会话后加载最近消息摘要：

```typescript
export async function getRecentMessages(sessionId: string, limit: number = 20): Promise<Array<{ role: string; content_summary: string; turn_number: number }>> {
  return loadRecentMessages(sessionId, limit)
}
```

- [ ] **Step 3: 在 commands.ts 添加 /resume 和 /history 命令**

在 `handleCommand` 的 switch 中添加：

```typescript
case '/resume':
  await handleResume(user!)
  return true

case '/history':
  await handleHistory(parts[1], user!)
  return true
```

实现：

```typescript
async function handleResume(user: NonNullable<ReturnType<typeof getCurrentUser>>): Promise<void> {
  const sessions = await listSessions(user)
  if (sessions.length === 0) {
    console.log('暂无会话。使用 /session new 创建新会话。')
    return
  }
  // 恢复最近活跃的会话
  const latest = sessions[0]
  await handleSwitchSession(latest.session_id.substring(0, 8), user)
}

async function handleHistory(limitStr: string | undefined, user: NonNullable<ReturnType<typeof getCurrentUser>>): Promise<void> {
  if (!currentSessionId) {
    console.log('当前没有活跃会话。')
    return
  }
  const limit = parseInt(limitStr || '10', 10)
  const { getRecentMessages } = await import('../session/session-service.js')
  const messages = await getRecentMessages(currentSessionId, limit)
  if (messages.length === 0) {
    console.log('暂无历史消息。')
    return
  }
  console.log('')
  console.log(chalk.bold(`  最近 ${messages.length} 条消息：`))
  console.log(chalk.dim('  ' + '─'.repeat(50)))
  for (const msg of messages) {
    const icon = msg.role === 'user' ? chalk.blue('👤') : chalk.green('🤖')
    const content = msg.content_summary.length > 60
      ? msg.content_summary.substring(0, 60) + '...'
      : msg.content_summary
    console.log(`  ${icon} [Turn ${msg.turn_number}] ${content}`)
  }
  console.log('')
}
```

> 需要导入 chalk：`import chalk from 'chalk'`

- [ ] **Step 4: 验证**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/session/pg-session-store.ts src/session/session-service.ts src/cli/commands.ts
git commit -m "feat: 会话恢复增强 — /resume 快速恢复 + /history 查看历史消息"
```

---

## Task 7: 扩展命令集 — Provider/EventBus/框架特性展示

**Files:**
- Modify: `src/cli/commands.ts`
- Modify: `src/cli/display.ts` (新增展示函数)
- Modify: `src/session/session-service.ts` (暴露更多框架 API)

- [ ] **Step 1: 在 session-service.ts 暴露 EventBus 和 Provider 相关 API**

添加导出函数：

```typescript
/** 获取引擎事件总线（展示 EventBus 特性） */
export function getEventBus() {
  return getEngine().getEventBus()
}

/** 获取最近的事件日志 */
let eventLog: Array<{ type: string; payload: unknown; time: Date }> = []
const MAX_EVENT_LOG = 50

export function startEventLogging(): void {
  const bus = getEventBus()
  const events = ['session:created', 'session:paused', 'session:resumed', 'session:destroyed', 'engine:stopped', 'error']
  for (const eventType of events) {
    bus.on(eventType, (payload: unknown) => {
      eventLog.push({ type: eventType, payload, time: new Date() })
      if (eventLog.length > MAX_EVENT_LOG) eventLog.shift()
    })
  }
}

export function getEventLog(): Array<{ type: string; payload: unknown; time: Date }> {
  return [...eventLog]
}

/** 重置事件日志（测试用） */
export function resetEventLog(): void {
  eventLog = []
}
```

- [ ] **Step 2: 在 session-service.ts 初始化时启动事件日志**

在 `getEngine()` 函数中，创建 engine 后启动事件日志：

```typescript
// 在 engine 创建后
let eventLoggingStarted = false

function getEngine(): AgentEngine {
  if (!engine) {
    engine = AgentEngine.create({ ... })
    // ... 现有的生命周期事件注册 ...
    eventLoggingStarted = false
  }
  if (!eventLoggingStarted) {
    startEventLogging()
    eventLoggingStarted = true
  }
  return engine
}
```

- [ ] **Step 3: 在 commands.ts 添加 /events 命令**

```typescript
case '/events':
  handleEvents()
  return true
```

实现：

```typescript
function handleEvents(): void {
  const { getEventLog } = require('../session/session-service.js') as typeof import('../session/session-service.js')
  const log = getEventLog()
  if (log.length === 0) {
    console.log('暂无事件记录。')
    return
  }
  console.log('')
  console.log(chalk.bold(`  事件日志（最近 ${log.length} 条）：`))
  console.log(chalk.dim('  ' + '─'.repeat(50)))
  for (const event of log) {
    const time = event.time.toLocaleTimeString('zh-CN')
    const type = chalk.magenta(event.type)
    const detail = JSON.stringify(event.payload).substring(0, 60)
    console.log(`  ${chalk.dim(time)} ${type} ${chalk.dim(detail)}`)
  }
  console.log('')
}
```

> 注意：由于项目是 ESM，不能用 require。改为在文件顶部 import `getEventLog`。

- [ ] **Step 4: 在 display.ts 添加 /events 的展示函数**

```typescript
export function printEventLog(log: Array<{ type: string; payload: unknown; time: Date }>): void {
  if (log.length === 0) {
    console.log('暂无事件记录。')
    return
  }
  console.log('')
  console.log(chalk.bold(`  事件日志（最近 ${log.length} 条）：`))
  console.log(chalk.dim('  ' + '─'.repeat(50)))
  for (const event of log) {
    const time = event.time.toLocaleTimeString('zh-CN')
    console.log(`  ${chalk.dim(time)} ${chalk.magenta(event.type)}`)
  }
  console.log('')
}
```

- [ ] **Step 5: 更新 commands.ts 的 help 输出**

在 `printHelp()` 中添加新命令：

```
  /resume                             恢复最近活跃会话
  /history [N]                        查看历史消息（默认10条）
  /events                             查看引擎事件日志
```

- [ ] **Step 6: 验证**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands.ts src/cli/display.ts src/session/session-service.ts
git commit -m "feat: 扩展命令集 — /events 事件日志 + EventBus 特性展示"
```

---

## Task 8: 密码输入遮罩 + 欢迎页交互式登录

**Files:**
- Modify: `src/welcome/welcome.ts`
- Modify: `src/cli/commands.ts` (/login 增强)

- [ ] **Step 1: 在 welcome.ts 添加交互式登录流程**

在 `runWelcome` 函数中，当用户未登录时提供交互式登录：

```typescript
if (!user) {
  printLoginPrompt()

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const username = await new Promise<string>(resolve => {
    rl.question('  用户名: ', ans => resolve(ans.trim()))
  })
  // 密码遮罩
  const password = await new Promise<string>(resolve => {
    process.stdout.write('  密码: ')
    const stdin = process.stdin
    const onData = (char: Buffer) => {
      const c = char.toString()
      if (c === '\n' || c === '\r') {
        stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(passwordBuffer)
        passwordBuffer = ''
      } else if (c === '\u007F' || c === '\b') {
        // 退格
        if (passwordBuffer.length > 0) {
          passwordBuffer = passwordBuffer.slice(0, -1)
          process.stdout.write('\b \b')
        }
      } else {
        passwordBuffer += c
        process.stdout.write('*')
      }
    }
    let passwordBuffer = ''
    stdin.on('data', onData)
  })
  rl.close()

  if (username && password) {
    const result = await login(username, password)
    if (result.success) {
      console.log(chalk.green(`\n  登录成功！欢迎, ${result.user!.display_name || result.user!.username}`))
      await showSessionPicker()
    } else {
      console.log(chalk.red(`\n  登录失败: ${result.error}`))
    }
  }
  return
}
```

- [ ] **Step 2: 验证**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/welcome/welcome.ts
git commit -m "feat: 欢迎页交互式登录 — 密码遮罩 + 会话选择"
```

---

## Task 9: 更新 Banner 版本 + 最终集成测试

**Files:**
- Modify: `src/cli/display.ts` (更新 banner 版本和特性列表)

- [ ] **Step 1: 更新 printBanner 版本**

将 banner 更新为 v4.0.0，反映新特性：

```typescript
export function printBanner(): void {
  // 不再在 REPL 启动时打印 banner（由欢迎页处理）
  // 保留函数供 /help 等场景使用
}
```

- [ ] **Step 2: 完整类型检查**

Run: `bun run typecheck`
Expected: 无错误

- [ ] **Step 3: 完整 Commit**

```bash
git add src/cli/display.ts
git commit -m "chore: 更新版本号，集成所有新特性"
```

---

## 执行顺序与依赖关系

```
Task 1 (依赖安装)
  └→ Task 2 (REPL 增强) ← 基础，所有后续依赖
       ├→ Task 3 (富文本渲染)
       ├→ Task 4 (状态仪表盘)
       ├→ Task 5 (欢迎页)
       ├→ Task 6 (会话恢复)
       ├→ Task 7 (扩展命令)
       └→ Task 8 (交互式登录)
            └→ Task 9 (最终集成)
```

Task 2 完成后，Task 3-8 可并行执行。Task 9 依赖所有前置任务。
