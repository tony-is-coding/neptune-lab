# Claude Code Framework - 快速开始指南

本指南帮助你快速上手 Claude Code Framework，构建自己的 AI Agent 应用。

## 目录

- [安装](#安装)
- [配置](#配置)
- [第一个 Agent](#第一个-agent)
- [自定义工具](#自定义工具)
- [权限控制](#权限控制)
- [进阶示例](#进阶示例)

## 安装

```bash
# 作为 npm 包安装（暂未发布到 npm，请使用 workspace 依赖）
npm install claude-code-best

# 或作为 workspace 依赖
# 在 package.json 中添加：
{
  "dependencies": {
    "claude-code-best": "workspace:*"
  }
}
```

## 配置

### 1. API 密钥配置

```typescript
// 设置 Anthropic API 密钥
process.env.ANTHROPIC_API_KEY = 'your-api-key'

// 或使用环境变量
// export ANTHROPIC_API_KEY=your-api-key
```

### 2. 基本配置

```typescript
import { createDefaultEngineConfig, initializeEngine } from 'claude-code-best'

// 创建默认配置
const config = createDefaultEngineConfig({
  // 指定模型
  model: 'claude-sonnet-4-20250514',

  // 配置日志级别
  logLevel: 'info',

  // 配置权限模式
  permissionMode: 'auto', // 'auto' | 'manual' | 'bypass'
})

// 初始化引擎
const engine = await initializeEngine(config)
```

## 第一个 Agent

### 基础示例

```typescript
import { AgentEngine } from 'claude-code-best'

// 创建 Agent 引擎
const engine = new AgentEngine({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-20250514',
})

// 运行查询
const response = await engine.query({
  messages: [
    { role: 'user', content: '你好，请介绍一下自己' }
  ]
})

console.log(response.content)
```

### 使用会话管理

```typescript
import { AgentEngine, SessionManager } from 'claude-code-best'

const engine = new AgentEngine({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-20250514',
})

const sessionManager = new SessionManager({ engine })

// 创建会话
const session = await sessionManager.createSession({
  projectId: 'my-project',
})

// 在会话中执行查询
const response = await sessionManager.query(session.sessionId, {
  messages: [
    { role: 'user', content: '帮我写一个排序函数' }
  ]
})

console.log(response.content)
```

## 自定义工具

### 定义工具

```typescript
import { Tool } from 'claude-code-best'

// 定义自定义工具
const weatherTool: Tool = {
  name: 'get_weather',
  description: '获取指定城市的天气信息',
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: '城市名称'
      }
    },
    required: ['city']
  },
  async execute(input) {
    const { city } = input

    // 模拟天气查询
    const weather = {
      city,
      temperature: 25,
      condition: '晴天',
      humidity: 60
    }

    return JSON.stringify(weather)
  }
}
```

### 注册工具

```typescript
import { AgentEngine } from 'claude-code-best'

const engine = new AgentEngine({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-20250514',
  tools: [weatherTool], // 注册自定义工具
})

// 现在 Agent 可以使用天气工具
const response = await engine.query({
  messages: [
    { role: 'user', content: '北京今天天气怎么样？' }
  ]
})
```

## 权限控制

### 使用 RBAC 权限

```typescript
import {
  RBACPermissionDelegate,
  JsonLogFormatter,
  FileLogStore
} from 'claude-code-best'

// 定义角色权限映射
const rolePermissions = {
  admin: { allow: ['*'] }, // 管理员拥有所有权限
  user: {
    allow: ['Read', 'Write', 'Bash'],
    deny: ['Delete', 'WebSearch']
  },
  readonly: { allow: ['Read', 'Grep', 'Glob'] }
}

// 创建 RBAC 权限委托
const permissionDelegate = new RBACPermissionDelegate(
  rolePermissions,
  'user' // 当前角色
)

// 使用权限委托
const engine = new AgentEngine({
  apiKey: process.env.ANTHROPIC_API_KEY,
  permissionDelegate, // 注入权限委托
})
```

### 审计日志

```typescript
import { AuditPermissionDelegate, LogUtil, FileLogStore } from 'claude-code-best'

// 配置 JSON 日志
LogUtil.initialize({
  formatter: new JsonLogFormatter(),
  store: new FileLogStore({ logDir: './logs' }),
})

// 包装权限委托，添加审计日志
const baseDelegate = new RBACPermissionDelegate(rolePermissions, 'user')
const auditDelegate = new AuditPermissionDelegate(baseDelegate)

const engine = new AgentEngine({
  apiKey: process.env.ANTHROPIC_API_KEY,
  permissionDelegate: auditDelegate,
})
```

## 进阶示例

### 1. Express 嵌入

```typescript
import express from 'express'
import { AgentEngine } from 'claude-code-best'

const app = express()
app.use(express.json())

const engine = new AgentEngine({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

app.post('/api/chat', async (req, res) => {
  const { message } = req.body

  const response = await engine.query({
    messages: [{ role: 'user', content: message }]
  })

  res.json({ response: response.content })
})

app.listen(3000)
```

### 2. SSE 流式响应

```typescript
import { AgentEngine } from 'claude-code-best'

const engine = new AgentEngine({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

app.get('/api/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')

  const stream = await engine.stream({
    messages: [{ role: 'user', content: '写一首诗' }]
  })

  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  }

  res.end()
})
```

### 3. 自定义 CLI

```typescript
#!/usr/bin/env node
import { AgentEngine } from 'claude-code-best'
import * as readline from 'readline'

const engine = new AgentEngine({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log('Claude CLI. 输入消息开始对话，Ctrl+C 退出。')

rl.on('line', async (input) => {
  const response = await engine.query({
    messages: [{ role: 'user', content: input }]
  })

  console.log('\nClaude:', response.content, '\n')
  rl.prompt()
})

rl.prompt()
```

## 更多资源

- [API 文档](./api-reference.md)
- [示例代码](../examples/)
- [贡献指南](./contributing.md)
