# Agent Teams 设计规格

> 日期：2026-05-05
> 状态：已确认
> 范围：为 Neptune-AI 项目创建 Claude Agent Teams，用于前后端持续迭代和 BUG 修复

---

## 1. 设计目标

为 Neptune-AI 项目建立一个由 4 个 Claude Agent 组成的开发团队，通过 `/team` 命令一键启动，实现协作式的功能开发和 BUG 修复工作流。

### 核心决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 工作模式 | 协作讨论模式 | 用户提方向，团队讨论方案后分工执行 |
| 职责边界 | 主职 + 弹性边界 | 快速迭代期避免严格分工导致阻塞 |
| 协作拓扑 | 产品 + 技术双领导 | 用户定「做什么」，架构师定「怎么做」 |
| Agent 能力 | 代码读写执行 + 信息搜索研究 + Agent 间直接通信 | 全功能开发能力 |
| 启动方式 | Skill 命令触发（`/team`） | 与现有 skill 体系一致，按需启动 |
| 参与程度 | 架构师把关中间流程 | 用户只参与需求提出和结果验收 |

---

## 2. 团队角色定义

### 2.1 架构师（Architect）

**角色定位**：技术负责人，连接用户和执行团队的桥梁。

| 维度 | 内容 |
|------|------|
| 主职 | 技术方案设计、代码审查、任务拆解与分配 |
| 弹性边界 | 可写关键骨架代码、修改接口定义 |
| 核心能力 | 读项目文档 → 设计方案 → 拆解任务 → 审查代码 → 技术决策 |
| 工具权限 | 全部（Read、Write、Edit、Bash、Glob、Grep、Agent） |
| 决策权 | 技术方案选择、任务分配、代码审查通过/打回 |

**禁止事项**：
- 不直接实现完整功能（除非是关键骨架代码）
- 不跳过用户确认直接开始大规模重构

### 2.2 前端开发（Frontend Dev）

**角色定位**：`web/` 目录下的所有开发工作执行者。

| 维度 | 内容 |
|------|------|
| 主职 | React/Vite/Tailwind 开发、组件实现、SSE 集成、样式调试 |
| 弹性边界 | 可改 API 客户端类型定义、修 Playwright 测试、改接口文档 |
| 核心能力 | 组件开发、状态管理、路由、Tailwind 样式、响应式设计 |
| 工具权限 | 全部 |
| 知识范围 | `web/src/` 结构、DESIGN.md UI 规范、Tailwind token 体系（`np-` 前缀） |

**关键文件认知**：
- `web/src/pages/Collaborate.tsx` — 核心对话页（三栏布局）
- `web/src/hooks/useChatMessages.ts` — 聊天状态管理核心
- `web/src/hooks/useThreads.ts` — Thread 列表管理
- `web/src/api/threads.ts` — Thread API 客户端（SSE 流式）
- `web/src/types/chat.ts` — 前端类型定义

### 2.3 后端开发（Backend Dev）

**角色定位**：`server/` 目录下的所有开发工作执行者。

| 维度 | 内容 |
|------|------|
| 主职 | Bun/Fastify/Drizzle 开发、路由实现、Thread 管理、Engine 调度 |
| 弹性边界 | 可改 API 文档、调数据库 schema、修 shell 测试 |
| 核心能力 | 路由设计、服务层实现、数据库操作、SSE 事件流、权限控制 |
| 工具权限 | 全部 |
| 知识范围 | `server/src/` 结构、数据库 schema（6 张表）、ThreadManager + EnginePool 架构 |

**关键文件认知**：
- `server/src/services/thread-manager.ts` — 核心调度器
- `server/src/services/engine-pool.ts` — Engine 实例池
- `server/src/routes/threads.ts` — Thread 路由（7 个端点）
- `server/src/db/schema.ts` — 全部表定义
- `server/src/middleware/auth.ts` — JWT 认证中间件

### 2.4 测试工程师（Tester）

**角色定位**：质量把关者。

| 维度 | 内容 |
|------|------|
| 主职 | 测试用例设计与执行、质量把关 |
| 弹性边界 | 可写简单 bug fix、改进测试基础设施 |
| 核心能力 | bun:test 单元测试、Playwright E2E、Shell 测试、覆盖率分析 |
| 工具权限 | 全部（但不应做功能性开发） |
| 知识范围 | `server/test/`、`web/tests/`、`.claude/skills/test-neptune/` |

**测试体系认知**：
- Server：9 个 `bun:test` 测试文件（`server/test/`）
- Web：7 个 Playwright 测试（`web/tests/`）
- Shell：15 个测试用例脚本（`.claude/skills/test-neptune/test_cases/`）
- E2E：`test/e2e-smoke.sh`（15 步完整用户旅程）

---

## 3. 团队启动 Skill

### 3.1 Skill 定义

- **命令**：`/team` 或 `/team-start`
- **位置**：`.claude/skills/team/SKILL.md`
- **Agent 定义位置**：`.claude/agents/{architect,frontend,backend,tester}.md`

### 3.2 启动流程

```
用户输入: /team
  │
  ├─ 1. 前置检查
  │     ├─ 确认在 neptune-ai/ 项目目录下
  │     └─ 提示基础设施状态（docker-compose 是否运行）
  │
  ├─ 2. TeamCreate("neptune-dev-team")
  │     └─ 创建团队 + 共享 TaskList
  │
  ├─ 3. 并行 Spawn 4 个 Agent
  │     ├─ architect:  .claude/agents/architect.md
  │     ├─ frontend:   .claude/agents/frontend.md
  │     ├─ backend:    .claude/agents/backend.md
  │     └─ tester:     .claude/agents/tester.md
  │
  ├─ 4. 架构师发送就绪消息
  │     └─ 确认团队成员状态，等待用户指令
  │
  └─ 5. 进入待命状态
```

### 3.3 关键设计决策

- **所有 agent 用 `general-purpose` 类型**——需要完整的文件读写和执行能力
- **架构师首先被 spawn**——由它负责接收用户指令并协调其他 agent
- **无 Worktree 隔离**——团队共享同一代码库，通过文件级协调避免冲突
- **架构师负责任务拆分时不让两个 agent 同时改同一个文件**

---

## 4. 任务流转机制

### 4.1 功能开发流程

```
用户提出需求
  │
  ▼
架构师分析需求
  ├─ 研究现有代码
  ├─ 输出设计方案（markdown，含前后端改动点）
  └─ 向用户展示方案，等待确认
  │
用户确认方案
  │
  ▼
架构师拆解任务到共享 TaskList:
  ├─ Task #1: [backend] 具体任务 (owner: backend)
  ├─ Task #2: [frontend] 具体任务 (owner: frontend)
  ├─ Task #3: [backend] 具体任务 (owner: backend)
  ├─ Task #4: [frontend] 具体任务 (owner: frontend, blockedBy: #3)
  └─ Task #5: [test] 具体任务 (owner: tester, blockedBy: #1, #2)
  │
  ▼
Agent 各自认领任务，并行开发
  ├─ backend: 完成 → SendMessage 给架构师 → 认领下一个
  ├─ frontend: 完成 → SendMessage 给架构师 → 认领下一个
  └─ tester: 等待依赖完成 → 编写测试
  │
  ▼
架构师审查
  ├─ 审查代码质量
  ├─ 确认前后端接口对齐
  └─ 问题打回修改 / 通过
  │
  ▼
架构师向用户汇报结果
```

### 4.2 BUG 修复流程（简化版）

```
用户报告 BUG
  │
  ▼
架构师分析定位
  ├─ 纯前端 bug → 直接指派 frontend
  ├─ 纯后端 bug → 直接指派 backend
  ├─ 跨端 bug → 拆解任务，先修后端再修前端
  └─ tester 跟进编写回归测试
```

**简化规则**：简单 bug 可跳过设计阶段，架构师直接分配。

### 4.3 协作规则

1. **任务分配权在架构师**——前端/后端/测试不主动抢任务
2. **阻塞依赖通过 TaskList 管理**——`blockedBy` 确保执行顺序
3. **架构师审查所有代码**——确保质量和接口对齐
4. **简单 bug 可跳过设计阶段**——架构师直接分配
5. **完成后主动汇报**——agent 完成任务后向架构师发送消息

---

## 5. 通信协议

### 5.1 通信矩阵

| 通信方向 | 方式 | 内容 |
|---------|------|------|
| 用户 → 架构师 | 直接对话 | 需求、方向、反馈 |
| 架构师 → 用户 | SendMessage | 方案展示、结果汇报、阻塞上报 |
| 架构师 → 前端/后端/测试 | SendMessage + TaskUpdate | 任务分配、代码审查反馈 |
| 前端/后端/测试 → 架构师 | SendMessage | 任务完成、阻塞求助 |
| 前端 ↔ 后端 | SendMessage | 接口对齐、数据格式确认 |
| 测试 ↔ 前端/后端 | SendMessage | Bug 报告、测试需求澄清 |

### 5.2 消息格式

- 所有通信使用自然语言（中文）
- 方案输出使用 markdown 格式
- 任务状态通过 TaskUpdate 管理，不在消息中重复

---

## 6. 文件结构

```
.claude/
├── agents/
│   ├── architect.md          # 架构师角色定义
│   ├── frontend.md           # 前端开发角色定义
│   ├── backend.md            # 后端开发角色定义
│   └── tester.md             # 测试工程师角色定义
└── skills/
    └── team/
        └── SKILL.md          # /team 启动命令
```

每个 agent 定义文件结构：
```markdown
---
name: {{role-name}}
description: {{one-line description}}
---

# 角色描述
# 知识范围（关键文件、文档引用）
# 工作规则（任务认领、汇报、协作）
# 禁止事项
# 项目上下文引用
```

---

## 7. 非目标（明确排除）

- **不实现持久化团队**——每次会话重新组建（Claude Code 限制）
- **不实现 CI/CD 集成**——手动触发测试
- **不实现自动代码合并**——需要用户确认后手动操作
- **不实现 Agent 学习/记忆**——角色定义静态，不随使用演化
- **不实现跨会话状态**——任务状态仅存在于当前会话

---

## 8. 验收标准

1. 用户输入 `/team` 后，4 个 agent 成功启动并发送就绪消息
2. 架构师能正确接收用户需求，输出设计方案并拆解任务
3. 前端/后端 agent 能认领任务并完成代码实现
4. 测试 agent 能基于开发完成的功能编写测试
5. 架构师能审查代码并给出反馈
6. 整个流程无需用户手动配置 agent 角色
