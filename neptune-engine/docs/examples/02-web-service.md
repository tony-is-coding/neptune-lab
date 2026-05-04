# 示例 2：Web 服务（Express + SSE）

本示例展示如何将 Agent Engine 集成到 Express Web 服务中，提供 REST API 和 SSE 流式响应。

## 场景

创建一个 Web 服务，提供：
1. POST /api/chat — 普通聊天接口（返回完整响应）
2. GET /api/stream — SSE 流式聊天接口
3. GET /api/sessions/:id — 获取会话信息
4. DELETE /api/sessions/:id — 删除会话

## 完整代码

创建 `examples/web-service.ts`：

```typescript
#!/usr/bin/env bun
/**
 * Web 服务示例 - Express + SSE
 *
 * 功能：
 * - REST API 聊天接口
 * - SSE 流式响应
 * - 会话管理
 * - 错误处理
 */

import { AgentEngine, collectText } from '@agent-engine/bootstrap'
import express from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'

// ============================================================
// 类型定义
// ============================================================

interface ChatRequest {
  message: string
  sessionId?: string
  systemPrompt?: string
}

interface ChatResponse {
  sessionId: string
  response: string
  timestamp: number
}

interface StreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'done'
  data: unknown
}

// ============================================================
// 配置
// ============================================================

const CONFIG = {
  port: parseInt(process.env.PORT || '3000'),
  defaultSystemPrompt: '你是一个有帮助的 AI 助手',
  workspace: './workspace/web-service'
}

// ============================================================
// 全局 Engine 实例
// ============================================================

const engine = AgentEngine.create({
  systemPrompt: CONFIG.defaultSystemPrompt,
  extensions: {
    permissions: {
      bypassPermissions: true // Web 服务默认绕过权限
    }
  },
  options: {
    workspaceRoot: CONFIG.workspace
  }
})

// ============================================================
// Express 应用
// ============================================================

const app = express()

// 中间件
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// CORS（可选）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

// ============================================================
// 路由：健康检查
// ============================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime()
  })
})

// ============================================================
// 路由：创建会话
// ============================================================

app.post('/api/sessions', async (req: Request, res: Response) => {
  try {
    const { workspace, metadata, systemPrompt } = req.body

    const sessionId = await engine.createSession({
      workspace: workspace || CONFIG.workspace,
      metadata,
      systemPrompt
    })

    res.status(201).json({
      sessionId,
      status: 'created',
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('创建会话失败:', error)
    res.status(500).json({
      error: 'Failed to create session',
      message: error instanceof Error ? error.message : String(error)
    })
  }
})

// ============================================================
// 路由：获取会话信息
// ============================================================

app.get('/api/sessions/:id', (req: Request, res: Response) => {
  try {
    const session = engine.getSession(req.params.id)

    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      })
    }

    res.json({
      sessionId: req.params.id,
      status: session.status,
      metadata: session.metadata
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get session',
      message: error instanceof Error ? error.message : String(error)
    })
  }
})

// ============================================================
// 路由：删除会话
// ============================================================

app.delete('/api/sessions/:id', async (req: Request, res: Response) => {
  try {
    await engine.destroySession(req.params.id)

    res.json({
      sessionId: req.params.id,
      status: 'destroyed',
      timestamp: Date.now()
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to destroy session',
      message: error instanceof Error ? error.message : String(error)
    })
  }
})

// ============================================================
// 路由：聊天（普通模式）
// ============================================================

const chatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  systemPrompt: z.string().optional()
})

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    // 验证请求
    const body = chatRequestSchema.parse(req.body)

    // 获取或创建会话
    let sessionId = body.sessionId
    if (!sessionId) {
      sessionId = await engine.createSession({
        workspace: CONFIG.workspace,
        systemPrompt: body.systemPrompt
      })
    }

    // 执行查询
    const messages = engine.query(sessionId, body.message)
    const response = await collectText(messages)

    // 返回结果
    const result: ChatResponse = {
      sessionId,
      response,
      timestamp: Date.now()
    }

    res.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors
      })
    }

    console.error('聊天失败:', error)
    res.status(500).json({
      error: 'Chat failed',
      message: error instanceof Error ? error.message : String(error)
    })
  }
})

// ============================================================
// 路由：聊天（SSE 流式模式）
// ============================================================

app.get('/api/stream', async (req: Request, res: Response) => {
  try {
    const { message, sessionId, systemPrompt } = req.query

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "message" query parameter'
      })
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Nginx

    // 获取或创建会话
    let sid = sessionId as string | undefined
    if (!sid) {
      sid = await engine.createSession({
        workspace: CONFIG.workspace,
        systemPrompt: systemPrompt as string | undefined
      })
    }

    // 发送会话 ID
    res.write(`data: ${JSON.stringify({
      type: 'session',
      sessionId: sid
    })}\n\n`)

    // 执行查询并流式输出
    const messages = engine.query(sid, message)

    for await (const event of messages) {
      const streamEvent: StreamEvent = {
        type: 'text',
        data: null
      }

      if (event.type === 'assistant') {
        streamEvent.type = 'text'
        streamEvent.data = event.content
      } else if (event.type === 'tool_use') {
        streamEvent.type = 'tool_use'
        streamEvent.data = {
          name: event.name,
          input: event.input
        }
      } else if (event.type === 'tool_result') {
        streamEvent.type = 'tool_result'
        streamEvent.data = {
          toolUseId: event.toolUseId,
          content: event.content
        }
      } else if (event.type === 'assistant_error' || event.type === 'error') {
        streamEvent.type = 'error'
        streamEvent.data = event.error
      }

      res.write(`data: ${JSON.stringify(streamEvent)}\n\n`)

      // 心跳保持连接
      res.write(': heartbeat\n\n')
    }

    // 发送完成事件
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
  } catch (error) {
    console.error('SSE 流失败:', error)
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Stream failed',
        message: error instanceof Error ? error.message : String(error)
      })
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        data: error instanceof Error ? error.message : String(error)
      })}\n\n`)
      res.end()
    }
  }
})

// ============================================================
// 路由：引擎统计
// ============================================================

app.get('/api/stats', (req, res) => {
  try {
    const stats = engine.getStats()

    res.json({
      ...stats,
      timestamp: Date.now()
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : String(error)
    })
  }
})

// ============================================================
// 错误处理
// ============================================================

app.use((err: Error, req: Request, res: Response, next: unknown) => {
  console.error('未捕获的错误:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  })
})

// ============================================================
// 启动服务器
// ============================================================

async function startServer() {
  // 检查 API Key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ 错误: 请设置 ANTHROPIC_API_KEY 环境变量')
    process.exit(1)
  }

  // 启动 Express
  const server = app.listen(CONFIG.port, () => {
    console.log(`🚀 Agent Engine Web 服务已启动`)
    console.log(`   地址: http://localhost:${CONFIG.port}`)
    console.log(`   Health: http://localhost:${CONFIG.port}/health`)
    console.log(`   Chat: http://localhost:${CONFIG.port}/api/chat`)
    console.log(`   Stream: http://localhost:${CONFIG.port}/api/stream?message=hello`)
    console.log()
  })

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('SIGTERM 信号接收，正在关闭服务器...')
    server.close(() => {
      console.log('服务器已关闭')
      process.exit(0)
    })
  })
}

startServer().catch(error => {
  console.error('启动失败:', error)
  process.exit(1)
})
```

## 使用方法

### 1. 安装依赖

```bash
# 添加 express 和 zod
bun add express zod

# 添加类型定义
bun add -d @types/express
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY=your-api-key
```

### 3. 运行服务

```bash
bun run examples/web-service.ts
```

## API 使用示例

### 创建会话

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "userId": "user-123"
    }
  }'
```

响应：
```json
{
  "sessionId": "session-abc123",
  "status": "created",
  "timestamp": 1714320000000
}
```

### 普通聊天

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "你好，请介绍一下你自己"
  }'
```

响应：
```json
{
  "sessionId": "session-abc123",
  "response": "你好！我是 AI 助手...",
  "timestamp": 1714320000000
}
```

### 继续会话

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "我叫什么名字？",
    "sessionId": "session-abc123"
  }'
```

### SSE 流式聊天

```bash
curl -N http://localhost:3000/api/stream?message=写一首诗
```

或使用 JavaScript：

```javascript
const eventSource = new EventSource(
  'http://localhost:3000/api/stream?message=你好'
)

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)

  switch (data.type) {
    case 'session':
      console.log('会话 ID:', data.sessionId)
      break
    case 'text':
      process.stdout.write(data.data)
      break
    case 'tool_use':
      console.log('\n[工具调用]', data.name)
      break
    case 'error':
      console.error('\n错误:', data.data)
      break
    case 'done':
      console.log('\n[完成]')
      eventSource.close()
      break
  }
}
```

### 获取会话信息

```bash
curl http://localhost:3000/api/sessions/session-abc123
```

### 删除会话

```bash
curl -X DELETE http://localhost:3000/api/sessions/session-abc123
```

### 获取引擎统计

```bash
curl http://localhost:3000/api/stats
```

响应：
```json
{
  "totalSessions": 5,
  "activeSessions": 3,
  "pausedSessions": 1,
  "timestamp": 1714320000000
}
```

## 前端集成示例

### HTML + JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <title>Agent Engine Chat</title>
  <style>
    #messages {
      height: 400px;
      overflow-y: auto;
      border: 1px solid #ccc;
      padding: 10px;
      margin-bottom: 10px;
    }
    .message {
      margin: 5px 0;
      padding: 8px;
      border-radius: 5px;
    }
    .user { background: #e3f2fd; text-align: right; }
    .assistant { background: #f5f5f5; }
    #input { display: flex; gap: 10px; }
    #input input { flex: 1; padding: 10px; }
    #input button { padding: 10px 20px; }
  </style>
</head>
<body>
  <h1>Agent Engine Chat</h1>
  <div id="messages"></div>
  <div id="input">
    <input type="text" id="message" placeholder="输入消息..." />
    <button onclick="sendMessage()">发送</button>
  </div>

  <script>
    let sessionId = null

    async function sendMessage() {
      const input = document.getElementById('message')
      const message = input.value.trim()
      if (!message) return

      // 显示用户消息
      addMessage('user', message)
      input.value = ''

      // 发送请求
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId
        })
      })

      const data = await response.json()

      // 保存会话 ID
      if (!sessionId) {
        sessionId = data.sessionId
      }

      // 显示 AI 响应
      addMessage('assistant', data.response)
    }

    function addMessage(type, content) {
      const div = document.createElement('div')
      div.className = `message ${type}`
      div.textContent = content
      document.getElementById('messages').appendChild(div)
    }

    // 回车发送
    document.getElementById('message').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage()
    })
  </script>
</body>
</html>
```

### React 示例

```typescript
import { useState, useRef, useEffect } from 'react'

export function ChatComponent() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input
    setInput('')
    setIsLoading(true)

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId
        })
      })

      const data = await response.json()

      // 保存会话 ID
      if (!sessionId) {
        setSessionId(data.sessionId)
      }

      // 添加 AI 响应
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (error) {
      console.error('发送失败:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，发生了错误。' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {isLoading && <div className="message assistant">正在思考...</div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="输入消息..."
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
          发送
        </button>
      </div>
    </div>
  )
}
```

## 关键点说明

### 1. SSE 流式响应

```typescript
// 设置 SSE 响应头
res.setHeader('Content-Type', 'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')
res.setHeader('Connection', 'keep-alive')

// 发送事件
res.write(`data: ${JSON.stringify(event)}\n\n`)

// 心跳保持连接
res.write(': heartbeat\n\n')
```

### 2. 会话管理

```typescript
// 每个请求可以指定 sessionId
// 如果不指定，自动创建新会话
let sessionId = body.sessionId
if (!sessionId) {
  sessionId = await engine.createSession()
}
```

### 3. 错误处理

```typescript
try {
  // 处理请求
} catch (error) {
  if (error instanceof z.ZodError) {
    // 验证错误
    return res.status(400).json({ error: 'Invalid request' })
  }
  // 其他错误
  res.status(500).json({ error: 'Internal error' })
}
```

## 相关文档

- [快速开始指南](../getting-started.md)
- [API 文档](../api/)
- [示例 1：嵌入式 SDK](./01-embedded-sdk.md)
- [示例 3：CLI 工具](./03-cli-tool.md)
