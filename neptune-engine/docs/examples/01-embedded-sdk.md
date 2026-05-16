# 示例 1：嵌入式 SDK（Node.js 脚本）

本示例展示如何在 Node.js 脚本中嵌入 Agent Engine SDK，创建一个简单的 AI 助手。

## 场景

创建一个命令行脚本，能够：

1. 回答问题
2. 读取文件
3. 写入文件
4. 执行简单命令

## 完整代码

创建 `examples/embedded-agent.ts`：

```typescript
#!/usr/bin/env bun
/**
 * 嵌入式 AI Agent 示例
 *
 * 功能：
 * - 回答问题
 * - 读取文件
 * - 写入文件
 * - 执行命令
 */

import { AgentEngine, collectText } from '@agent-engine/bootstrap'
import * as readline from 'readline'

// ============================================================
// 配置
// ============================================================

const CONFIG = {
  systemPrompt: `你是一个高效的 AI 助手，可以帮助用户：
1. 回答问题
2. 读取和编辑文件
3. 执行命令

请简洁、准确地完成任务。`,

  workspace: './workspace/embedded-agent',

  // 绕过权限确认（headless 模式）
  bypassPermissions: true
}

// ============================================================
// Agent Engine 初始化
// ============================================================

async function createAgent() {
  const engine = AgentEngine.create({
    systemPrompt: CONFIG.systemPrompt,
    extensions: {
      permissions: {
        bypassPermissions: CONFIG.bypassPermissions
      }
    },
    options: {
      workspaceRoot: CONFIG.workspace
    }
  })

  // 创建会话
  const sessionId = await engine.createSession({
    workspace: CONFIG.workspace
  })

  console.log('✓ Agent 已初始化')
  console.log('  Session ID:', sessionId)
  console.log('  Workspace:', CONFIG.workspace)
  console.log()

  return { engine, sessionId }
}

// ============================================================
// 交互循环
// ============================================================

function createREPL() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return {
    question(prompt: string): Promise<string> {
      return new Promise(resolve => {
        rl.question(prompt, resolve)
      })
    },
    close() {
      rl.close()
    }
  }
}

async function runInteractiveLoop(engine: AgentEngine, sessionId: string) {
  const repl = createREPL()

  console.log('🤖 嵌入式 AI Agent 已就绪')
  console.log('输入你的问题或指令，输入 "exit" 退出')
  console.log('=' .repeat(50))
  console.log()

  try {
    while (true) {
      const input = await repl.question('👤 你: ')

      // 退出命令
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log('👋 再见！')
        break
      }

      // 空输入跳过
      if (!input.trim()) {
        continue
      }

      // 执行查询
      console.log()
      console.log('🤖 AI: ')

      try {
        const messages = engine.query(sessionId, input)
        const response = await collectText(messages)

        console.log(response)
        console.log()
      } catch (error) {
        console.error('❌ 错误:', error)
        console.log()
      }
    }
  } finally {
    repl.close()
  }
}

// ============================================================
// 单次执行模式
// ============================================================

async function runSingleQuery(engine: AgentEngine, sessionId: string, query: string) {
  console.log('🤖 AI: ')

  try {
    const messages = engine.query(sessionId, query)
    const response = await collectText(messages)

    console.log(response)
    return response
  } catch (error) {
    console.error('❌ 错误:', error)
    throw error
  }
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  const args = process.argv.slice(2)

  // 检查 API Key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ 错误: 请设置 ANTHROPIC_API_KEY 环境变量')
    console.error('   export ANTHROPIC_API_KEY=your-key')
    process.exit(1)
  }

  // 创建 Agent
  const { engine, sessionId } = await createAgent()

  // 单次查询模式
  if (args.length > 0) {
    const query = args.join(' ')
    await runSingleQuery(engine, sessionId, query)

    // 清理
    await engine.destroySession(sessionId)
    process.exit(0)
  }

  // 交互模式
  await runInteractiveLoop(engine, sessionId)

  // 清理
  await engine.destroySession(sessionId)
}

// ============================================================
// 启动
// ============================================================

main().catch(error => {
  console.error(' Fatal error:', error)
  process.exit(1)
})
```

## 使用方法

### 1. 安装依赖

```bash
bun install
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY=your-api-key
```

### 3. 运行

**交互模式**：

```bash
bun run examples/embedded-agent.ts
```

**单次查询模式**：

```bash
bun run examples/embedded-agent.ts "帮我分析当前目录的文件结构"
```

## 示例对话

```
🤖 嵌入式 AI Agent 已就绪
输入你的问题或指令，输入 "exit" 退出
==================================================

👤 你: 当前目录有什么文件？

🤖 AI: 当前目录包含以下文件和文件夹：
- src/ (源代码目录)
- package.json
- tsconfig.json
- README.md

👤 你: 创建一个名为 hello.txt 的文件，内容是 "Hello World"

🤖 AI: 已创建文件 hello.txt，内容为 "Hello World"。

👤 你: 读取 hello.txt 的内容

🤖 AI: hello.txt 的内容是：
Hello World

👤 你: exit

👋 再见！
```

## 关键点说明

### 1. Engine 创建

```typescript
const engine = AgentEngine.create({
  systemPrompt: CONFIG.systemPrompt,
  extensions: {
    permissions: {
      bypassPermissions: true  // 自动批准工具调用
    }
  }
})
```

### 2. 会话管理

```typescript
// 创建会话
const sessionId = await engine.createSession({
  workspace: './workspace'
})

// 使用会话进行多轮对话
await engine.query(sessionId, '第一轮')
await engine.query(sessionId, '第二轮') // 上下文保留

// 清理
await engine.destroySession(sessionId)
```

### 3. 文本收集

```typescript
import { collectText } from '@agent-engine/bootstrap'

// collectText 会消费整个流，返回完整文本
const messages = engine.query(sessionId, '你好')
const response = await collectText(messages)
```

### 4. 错误处理

```typescript
try {
  const messages = engine.query(sessionId, input)
  const response = await collectText(messages)
  console.log(response)
} catch (error) {
  // EngineError 或其他错误
  console.error('查询失败:', error)
}
```

## 扩展建议

### 添加历史记录

```typescript
// 保存对话历史
const history: Array<{ role: string; content: string }> = []

// 在查询前保存用户输入
history.push({ role: 'user', content: input })

// 在响应后保存 AI 回复
history.push({ role: 'assistant', content: response })

// 持久化到文件
await Bun.write('./history.json', JSON.stringify(history, null, 2))
```

### 添加自定义工具

```typescript
import type { ToolExtension } from '@agent-engine/bootstrap'

const currentTimeTool: ToolExtension = {
  name: 'get_current_time',
  description: '获取当前时间',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  async execute() {
    return {
      content: new Date().toISOString()
    }
  }
}

const engine = AgentEngine.create({
  extensions: {
    tools: [currentTimeTool]
  }
})
```

### 添加流式输出

```typescript
// 替代 collectText，实时输出
async function streamOutput(engine: AgentEngine, sessionId: string, input: string) {
  const messages = engine.query(sessionId, input)

  for await (const message of messages) {
    if (message.type === 'assistant') {
      process.stdout.write(message.content)
    } else if (message.type === 'tool_use') {
      console.log(`\n[工具: ${message.name}]`)
    }
  }
  console.log()
}
```

## 相关文档

- [快速开始指南](../getting-started.md)
- [API 文档](../api/)
- [示例 2：Web 服务](./02-web-service.md)
- [示例 3：CLI 工具](./03-cli-tool.md)
