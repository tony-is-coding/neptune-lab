# Neptune Agent Chat — Claude 风格 SSE 交互设计

## 目标

为 Web 前端实现通用 Agent ChatBot 的聊天交互体验，支持思考过程、流式文本输出、工具调用展示、文档产出。使用 Mock 数据驱动，不依赖后端 SSE。

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 消息结构 | Block 数组模型 | 一条 AI 消息包含多个 Block（思考、文本、工具、文档） |
| 组件架构 | 每个 Block 独立组件 | 职责单一，可独立迭代 |
| 工具状态视觉 | 进行中=灰色，完成=绿色✅ | 用户明确要求，简洁不干扰 |
| 文档展示 | 右侧独立面板 | 类似 Claude Artifacts，聊天和文档并排 |
| 数据源 | Mock SSE 模拟 | 用 setTimeout 模拟流式效果，后续对接真实 SSE |

## 数据模型

### MessageBlock 类型

```typescript
type MessageBlock =
  | { type: 'thinking'; content: string; duration?: number }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; id: string; name: string; input?: Record<string, unknown>; status: 'running' | 'completed' | 'error' }
  | { type: 'tool_result'; toolUseId: string; output?: Record<string, unknown>; isError?: boolean }
  | { type: 'artifact'; id: string; title: string; fileType: string; content: string }
```

### ChatMessage

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  blocks: MessageBlock[]
  status: 'streaming' | 'complete'
}
```

## 组件树

```
Collaborate.tsx (页面)
├── AgentSidebar              (左侧 Agent 列表)
├── ChatPanel                 (中间聊天区)
│   ├── MessageList
│   │   ├── UserMessage
│   │   └── AssistantMessage
│   │       ├── ThinkingBlock       (可折叠思考块)
│   │       ├── TextBlock           (流式文本 + Markdown)
│   │       ├── ToolUseBlock        (工具调用卡片)
│   │       └── ArtifactBlock       (文档卡片)
│   └── ChatInput              (输入框)
└── ArtifactPanel             (右侧文档面板)
    ├── ArtifactHeader         (标题 + 类型标签 + 关闭)
    └── ArtifactRenderer       (按 fileType 渲染)
```

## 组件行为规格

### ThinkingBlock

- 收起态：显示💭图标 + 「Thought for Xs」+ 展开箭头
- 展开态：显示完整思考内容
- 流式态：显示💭 + 「Thinking...」动画

### TextBlock

- 逐字追加渲染（Mock 用 setInterval 30ms 模拟）
- 尾部闪烁光标（仅 status=streaming 时）
- 支持基础 Markdown：粗体、代码块、列表

### ToolUseBlock

- 进行中：灰色圆点 `●●●` + 工具名 + 描述文字
- 已完成：绿色 ✓ 圆点 + 工具名 + 结果摘要
- 错误：红色圆点 + 错误信息
- 可折叠：点击展开 input 参数和 output 结果

### ArtifactBlock

- 聊天内：类型标签（.xlsx / .py / .md 等）+ 文件名 + 简短描述
- 点击：在右侧 ArtifactPanel 中打开

### ArtifactPanel

- Header：文件标题 + 类型标签 + 关闭按钮
- Renderer 根据 fileType：
  - `code` / `.py` / `.ts`：代码高亮
  - `table` / `.xlsx` / `.csv`：表格渲染
  - `document` / `.md`：Markdown 渲染
  - `image`：图片展示

## 文件结构

```
src/
├── pages/
│   └── Collaborate.tsx
├── components/
│   ├── chat/
│   │   ├── ChatPanel.tsx
│   │   ├── MessageList.tsx
│   │   ├── UserMessage.tsx
│   │   ├── AssistantMessage.tsx
│   │   ├── ThinkingBlock.tsx
│   │   ├── TextBlock.tsx
│   │   ├── ToolUseBlock.tsx
│   │   ├── ArtifactBlock.tsx
│   │   └── ChatInput.tsx
│   └── artifact/
│       ├── ArtifactPanel.tsx
│       └── ArtifactRenderer.tsx
├── hooks/
│   ├── useChatMessages.ts
│   └── useResizableSidebar.ts
└── types/
    └── chat.ts
```

## Mock SSE 模拟策略

`useChatMessages` hook 负责模拟 SSE 流式体验：

1. 用户发消息 → 添加 user message
2. 800ms 后 → 创建 assistant message，先添加 thinking block（模拟 2-3s）
3. Thinking 完成 → 添加 text block 开始流式输出
4. 文本流中途 → 插入 tool_use block（灰色进行中）
5. 1-2s 后 → 更新 tool_use 为 completed + 添加 tool_result
6. 继续文本流 → 可能产出 artifact block
7. 全部完成 → status 设为 'complete'

## 验收标准

1. 一条用户消息 → AI 回复包含完整的：思考 → 文本 → 工具调用 → 文档产出流程
2. 思考块可折叠，显示思考时长
3. 文本逐字流式输出，带闪烁光标
4. 工具调用进行中=灰色，完成=绿色✅，可展开参数
5. 文档卡片可点击，右侧面板打开对应类型渲染
6. 切换 Agent 不影响其他 Agent 的聊天状态（独立 messages）
