# Neptune Engine

通用 Agent Engine SDK 底座。将 Claude Code 的核心 Agent 执行能力解耦为可嵌入任何应用的 SDK。

## 快速开始

```typescript
import { AgentEngine } from 'claude-code-best/engine'

const engine = AgentEngine.create({
  systemPrompt: '你是一个有帮助的 AI 助手',
  provider: { type: 'anthropic', config: { apiKey: 'sk-...' } },
})

const sessionId = await engine.createSession({ workspace: '/path/to/workspace' })

for await (const event of engine.query(sessionId, '你好')) {
  console.log(event)
}
```

## 开发

```bash
bun install          # 安装依赖
bun test             # 运行测试
bunx tsc --noEmit    # 类型检查
```

## 项目结构

```
neptune-engine/
├── src/
│   ├── engine/          ← SDK 核心（详见 src/engine/README.md）
│   ├── query/           ← Claude Code 原始 QueryEngine
│   ├── services/        ← 业务服务层（analytics, MCP, tools 执行）
│   ├── utils/           ← 工具函数
│   ├── state/           ← 应用状态管理
│   ├── types/           ← 共享类型定义
│   └── entrypoints/     ← 启动入口
├── packages/
│   ├── builtin-tools/   ← 内置工具实现（Read, Edit, Bash, Grep...）
│   ├── agent-tools/     ← Agent 工具基础类型（零依赖）
│   ├── mcp-client/      ← MCP 协议客户端
│   ├── remote-control-server/ ← 远程控制 HTTP 服务
│   └── @ant/            ← 平台相关包（ink UI, computer-use 等）
└── docs/
    ├── guides/          ← 使用指南（getting-started, quick-start）
    ├── feature-design/  ← 模块设计文档（20+ 篇）
    └── ARCHITECTURE.md  ← 架构规范
```

## 阅读路径

**我是 SDK 使用者（接入方）：**
1. 本文件 → 了解项目是什么
2. `docs/guides/getting-started.md` → 接入教程
3. `src/engine/index.ts` → 公共 API 导出清单

**我是框架开发者（贡献者）：**
1. 本文件 → 了解项目是什么
2. `src/engine/README.md` → 模块地图 + 核心流程
3. `docs/feature-design/` → 具体模块的设计决策

## 核心能力

| 能力 | 说明 |
|------|------|
| Session 管理 | 创建/暂停/恢复/销毁，支持持久化存储外化 |
| 流式查询 | `engine.query()` 返回 AsyncGenerator，逐事件推送 |
| 多 Provider | Anthropic/OpenAI/Gemini/Grok/Bedrock/Vertex/Foundry |
| 权限委托 | PermissionDelegate 注入，支持 RBAC/Audit/ReadOnly/自定义 |
| 工具扩展 | ToolExtension 接口，自定义工具即插即用 |
| 存储外化 | ISessionStore / ISessionContentStore / IMemoryStore 可注入实现 |
| 事件系统 | EventBus 发布/订阅 + Hook 拦截 |
| 可观测性 | ITracingProvider + IMetricsProvider 可注入 |

## 设计原则

- **包装不替代** — 不重写 Claude Code 核心能力，只包裹和外扩
- **存储外化** — 框架定义接口，具体存储实现由接入方注入
- **权限委托** — 框架不硬编码权限策略，由宿主决定
- **事件透传** — 不自建事件模型，直接转发 CC 原始 Message
- **零 React** — engine/ 核心零 UI 依赖，可在服务端独立运行
