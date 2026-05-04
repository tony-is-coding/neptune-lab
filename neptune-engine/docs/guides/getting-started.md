# Agent Engine SDK 快速开始指南

欢迎使用 Agent Engine SDK！本指南将帮助你快速上手，从安装到运行第一个 AI Agent 应用。

## 目录

- [前置要求](#前置要求)
- [安装](#安装)
- [基础配置](#基础配置)
- [第一个 Agent](#第一个-agent)
- [会话管理](#会话管理)
- [事件处理](#事件处理)
- [自定义工具](#自定义工具)
- [多 Provider 支持](#多-provider-支持)
- [权限控制](#权限控制)
- [下一步](#下一步)

## 前置要求

- **Node.js** >= 18.0.0
- **Bun** >= 1.0.0（推荐，用于更好的性能）
- **Anthropic API Key** — [获取 API Key](https://console.anthropic.com/)

## 安装

### 方式一：使用 workspace 依赖（开发模式）

如果你的项目与 Agent Engine 在同一个 monorepo 中：

```bash
# 在项目根目录
bun install
```

```json
// package.json
{
  "dependencies": {
    "@agent-engine/bootstrap": "workspace:*"
  }
}
```

### 方式二：本地路径依赖

```bash
# 在你的项目目录
bun add ..
```

## 基础配置

### 1. 设置 API 密钥

```bash
# 方式一：环境变量（推荐）
export ANTHROPIC_API_KEY=your-api-key

# 方式二：.env 文件
echo "ANTHROPIC_API_KEY=your-api-key" > .env
```

### 2. 创建引擎实例

```typescript
import { AgentEngine } from '@agent-engine/bootstrap'

// 创建最简引擎
const engine = AgentEngine.create({
  systemPrompt: '你是一个有帮助的 AI 助手'
})

// 创建带配置的引擎
const engineWithConfig = AgentEngine.create({
  systemPrompt: '你是一个代码助手，擅长 TypeScript',
  extensions: {
    permissions: {
      bypassPermissions: true // headless 模式绕过权限确认
    }
  },
  options: {
    workspaceRoot: './workspace',
    maxConcurrentSessions: 10
  }
})
```

## 第一个 Agent

### 基础示例

创建 `hello-agent.ts`：

```typescript
import { AgentEngine } from '@agent-engine/bootstrap'
import { collectText } from '@agent-engine/bootstrap'

async function main() {
  // 1. 创建引擎
  const engine = AgentEngine.create({
    systemPrompt: '你是一个简洁的 AI 助手'
  })

  // 2. 创建会话
  const sessionId = await engine.createSession({
    workspace: './workspace/demo'
  })

  console.log('Session ID:', sessionId)

  // 3. 发送查询
  const messages = engine.query(sessionId, '用一句话介绍你自己')

  // 4. 收集文本响应
  const response = await collectText(messages)
  console.log('Response:', response)
}

main().catch(console.error)
```

运行：

```bash
bun run hello-agent.ts
```

### 流式响应

如果需要实时处理流式输出：

```typescript
async function streamExample() {
  const engine = AgentEngine.create({})
  const sessionId = await engine.createSession()

  const messages = engine.query(sessionId, '写一首短诗')

  // 实时处理每个事件
  for await (const message of messages) {
    if (message.type === 'assistant') {
      // 文本响应
      process.stdout.write(message.content)
    } else if (message.type === 'tool_use') {
      // 工具调用
      console.log('\n[调用工具]', message.name)
    }
  }
}
```

## 会话管理

Agent Engine 支持多会话管理，每个会话独立维护上下文。

### 创建会话

```typescript
// 创建默认会话
const sessionId1 = await engine.createSession()

// 创建带元数据的会话
const sessionId2 = await engine.createSession({
  workspace: './workspace/project-a',
  metadata: {
    userId: 'user-123',
    projectName: 'Project A'
  }
})

// 创建带自定义系统提示词的会话
const sessionId3 = await engine.createSession({
  workspace: './workspace/project-b',
  systemPrompt: '你是一个 Python 专家'
})
```

### 会话生命周期

```typescript
// 获取会话信息
const session = engine.getSession(sessionId)
console.log('Session status:', session.status)

// 暂停会话
await engine.pauseSession(sessionId)

// 恢复会话
await engine.resumeSession(sessionId)

// 销毁会话
await engine.destroySession(sessionId)
```

### 多轮对话

```typescript
const sessionId = await engine.createSession()

// 第一轮
const response1 = await collectText(
  engine.query(sessionId, '我的名字是 Alice')
)
console.log('AI:', response1)

// 第二轮（会记住上下文）
const response2 = await collectText(
  engine.query(sessionId, '我叫什么名字？')
)
console.log('AI:', response2) // 输出: 你的名字是 Alice
```

## 事件处理

Agent Engine 通过事件流提供丰富的实时反馈。

### 事件类型

```typescript
import type {
  AssistantTextEvent,
  ToolUseEvent,
  ToolResultEvent,
  SystemEvent,
  ErrorEvent,
  isAssistantTextEvent,
  isToolUseEvent,
  isToolResultEvent,
  isSystemEvent,
  isErrorEvent
} from '@agent-engine/bootstrap'
```

### 事件处理示例

```typescript
async function handleEvents() {
  const engine = AgentEngine.create({})
  const sessionId = await engine.createSession()

  const messages = engine.query(sessionId, '帮我创建一个文件')

  for await (const event of messages) {
    // 使用类型守卫处理不同事件
    if (isAssistantTextEvent(event)) {
      console.log('文本:', event.content)
    } else if (isToolUseEvent(event)) {
      console.log('工具调用:', event.name, event.input)
    } else if (isToolResultEvent(event)) {
      console.log('工具结果:', event.content)
    } else if (isErrorEvent(event)) {
      console.error('错误:', event.error)
    }
  }
}
```

### 等待特定事件

```typescript
import { waitForEventType } from '@agent-engine/bootstrap'

async function waitForTool() {
  const engine = AgentEngine.create({})
  const sessionId = await engine.createSession()

  const messages = engine.query(sessionId, '当前目录有什么文件？')

  // 等待工具执行完成
  const toolResult = await waitForEventType(messages, 'tool_result')
  if (toolResult) {
    console.log('工具执行结果:', toolResult.content)
  }
}
```

### 等待查询完成

```typescript
import { waitForResult, waitForResultWithTimeout } from '@agent-engine/bootstrap'

async function checkCompletion() {
  const engine = AgentEngine.create({})
  const sessionId = await engine.createSession()

  const messages = engine.query(sessionId, '分析这个项目')

  // 等待完成
  const result = await waitForResult(messages)
  if (result.success) {
    console.log('查询成功完成')
  } else {
    console.error('查询失败:', result.error)
  }

  // 或带超时等待
  const timeoutResult = await waitForResultWithTimeout(messages, 30000)
  if (!timeoutResult.success && timeoutResult.error === 'TIMEOUT') {
    console.error('查询超时')
  }
}
```

## 自定义工具

Agent Engine 支持自定义工具扩展。

### 定义工具

```typescript
import type { ToolExtension } from '@agent-engine/bootstrap'

// 定义天气查询工具
const weatherTool: ToolExtension = {
  name: 'get_weather',
  description: '获取指定城市的天气信息',
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: '城市名称'
      },
      unit: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: '温度单位'
      }
    },
    required: ['city']
  },
  async execute(params) {
    const { city, unit = 'celsius' } = params

    // 模拟 API 调用
    const response = await fetch(`https://api.weather.example/${city}`)
    const data = await response.json()

    return {
      content: JSON.stringify({
        city,
        temperature: data.temp,
        unit,
        condition: data.condition
      })
    }
  }
}
```

### 注册工具

```typescript
const engine = AgentEngine.create({
  systemPrompt: '你可以查询天气信息',
  extensions: {
    tools: [weatherTool]
  }
})

// 现在 Agent 可以使用天气工具
const messages = engine.query(
  await engine.createSession(),
  '北京今天天气怎么样？'
)
```

### 多个工具

```typescript
const tools: ToolExtension[] = [
  weatherTool,
  {
    name: 'calculate',
    description: '执行数学计算',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: '数学表达式，如 2 + 2'
        }
      },
      required: ['expression']
    },
    async execute({ expression }) {
      try {
        // 安全的计算实现
        const result = Function('"use strict"; return (' + expression + ')')()
        return { content: String(result) }
      } catch {
        return { content: '计算失败' }
      }
    }
  }
]

const engine = AgentEngine.create({
  extensions: { tools }
})
```

## 多 Provider 支持

Agent Engine 支持多种 LLM Provider。

### Anthropic（默认）

```typescript
const engine = AgentEngine.create({
  provider: {
    type: 'anthropic',
    config: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-20250514'
    }
  }
})
```

### Bedrock

```typescript
const engine = AgentEngine.create({
  provider: {
    type: 'bedrock',
    config: {
      region: 'us-west-2',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
})
```

### Vertex

```typescript
const engine = AgentEngine.create({
  provider: {
    type: 'vertex',
    config: {
      project: 'your-project-id',
      location: 'us-central1'
    }
  }
})
```

### OpenAI

```typescript
const engine = AgentEngine.create({
  provider: {
    type: 'openai',
    config: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4'
    }
  }
})
```

### Per-Session Provider

```typescript
const engine = AgentEngine.create({
  provider: { type: 'anthropic' } // 默认
})

// 为特定会话使用不同 Provider
const sessionId = await engine.createSession({
  provider: {
    type: 'openai',
    config: { model: 'gpt-4' }
  }
})
```

## 权限控制

### Bypass 模式（Headless）

```typescript
const engine = AgentEngine.create({
  extensions: {
    permissions: {
      bypassPermissions: true // 自动批准所有工具调用
    }
  }
})
```

### 自定义权限委托

```typescript
import type { PermissionDelegate } from '@agent-engine/bootstrap'

class MyPermissionDelegate implements PermissionDelegate {
  async canUseTool(toolName: string, params: unknown): Promise<boolean> {
    // 只允许读取操作
    const readonlyTools = ['Glob', 'Grep', 'Read']
    return readonlyTools.includes(toolName)
  }

  async decision(toolName: string, params: unknown): Promise<'allow' | 'deny'> {
    return this.canUseTool(toolName, params) ? 'allow' : 'deny'
  }
}

const engine = AgentEngine.create({
  extensions: {
    permissions: {
      delegate: new MyPermissionDelegate()
    }
  }
})
```

## 下一步

恭喜！你已经掌握了 Agent Engine SDK 的基础用法。

- 查看 [API 文档](./api/) 了解完整 API
- 浏览 [示例代码](./examples/) 学习更多用法
- 阅读 [架构设计](./architecture-design.md) 了解实现细节
- 查看 [项目目标](./project-purpose.md) 了解项目愿景

有问题或建议？欢迎提交 Issue 或 PR！
