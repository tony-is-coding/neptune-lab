# Agent Engine 示例代码

本目录包含 Agent Engine SDK 的完整使用示例，帮助你快速上手各种应用场景。

## 示例列表

### 1. 嵌入式 SDK（Node.js 脚本）

**文件**: [01-embedded-sdk.md](./01-embedded-sdk.md)

展示如何在 Node.js 脚本中嵌入 Agent Engine，创建一个简单的 AI 助手。

- **场景**: 命令行脚本，回答问题、读写文件、执行命令
- **功能**: 交互式对话、单次查询、会话管理
- **适合**: 自动化脚本、批处理任务

**运行方式**:
```bash
bun run examples/embedded-agent.ts
bun run examples/embedded-agent.ts "你的问题"
```

### 2. Web 服务（Express + SSE）

**文件**: [02-web-service.md](./02-web-service.md)

展示如何将 Agent Engine 集成到 Express Web 服务中。

- **场景**: REST API 和 SSE 流式响应
- **功能**: 聊天接口、会话管理、流式输出
- **适合**: Web 应用、后端服务、API 集成

**运行方式**:
```bash
bun run examples/web-service.ts
```

**API 端点**:
- `POST /api/chat` — 普通聊天
- `GET /api/stream` — SSE 流式聊天
- `POST /api/sessions` — 创建会话
- `GET /api/sessions/:id` — 获取会话信息

### 3. CLI 工具（Headless 自动化）

**文件**: [03-cli-tool.md](./03-cli-tool.md)

展示如何创建功能完整的 CLI 工具。

- **场景**: 命令行工具，支持多种操作模式
- **功能**: 交互模式、单次查询、文件处理、批量操作
- **适合**: 开发工具、CI/CD 集成、自动化脚本

**运行方式**:
```bash
bun run examples/cli-tool.ts                    # 交互模式
bun run examples/cli-tool.ts query "问题"      # 单次查询
bun run examples/cli-tool.ts file analyze src/index.ts
bun run examples/cli-tool.ts batch queries.txt
```

## 快速导航

| 需求 | 推荐示例 |
|------|---------|
| 我想要一个简单的 AI 脚本 | 示例 1：嵌入式 SDK |
| 我想要构建 Web 应用 | 示例 2：Web 服务 |
| 我想要创建 CLI 工具 | 示例 3：CLI 工具 |
| 我需要流式响应 | 示例 2（SSE） |
| 我需要 CI/CD 集成 | 示例 3（批量处理） |
| 我需要文件处理 | 示例 1 或 3 |

## 核心概念

### Engine 创建

所有示例都使用 `AgentEngine.create()` 创建引擎实例：

```typescript
import { AgentEngine } from '@agent-engine/bootstrap'

const engine = AgentEngine.create({
  systemPrompt: '你是一个有帮助的 AI 助手',
  extensions: {
    permissions: {
      bypassPermissions: true  // headless 模式
    }
  }
})
```

### 会话管理

```typescript
// 创建会话
const sessionId = await engine.createSession({
  workspace: './workspace'
})

// 使用会话
await engine.query(sessionId, '你好')

// 清理
await engine.destroySession(sessionId)
```

### 文本收集

```typescript
import { collectText } from '@agent-engine/bootstrap'

const messages = engine.query(sessionId, '你好')
const response = await collectText(messages)
```

### 流式处理

```typescript
// 实时处理每个事件
for await (const event of engine.query(sessionId, '你好')) {
  if (event.type === 'assistant') {
    process.stdout.write(event.content)
  }
}
```

## 配置要求

所有示例都需要：

1. **Node.js** >= 18.0.0
2. **Bun** >= 1.0.0（推荐）
3. **Anthropic API Key**

```bash
export ANTHROPIC_API_KEY=your-api-key
```

## 扩展阅读

- [快速开始指南](../getting-started.md)
- [API 文档](../api/)
- [架构设计](../architecture-design.md)
- [项目目标](../project-purpose.md)
