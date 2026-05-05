---
name: team
description: 一键启动 Neptune-AI 开发团队 — 架构师、前端、后端、测试四位 Agent
---

# 启动 Neptune-AI 开发团队

你即将组建一个由 4 个 Claude Agent 组成的开发团队。

## 执行步骤

### Step 1: 前置检查

确认当前在 neptune-ai/ 项目目录下。提示用户确保基础设施已启动：

> 请确认 docker-compose 已启动（PostgreSQL :5433 + Redis :6380）。
> 如未启动，请运行: cd server && docker-compose up -d

### Step 2: 创建团队

使用 TeamCreate 创建团队：
- team_name: "neptune-dev-team"
- description: "Neptune-AI 开发团队 — 架构师、前端、后端、测试"

### Step 3: 并行 Spawn 4 个 Agent

使用 Agent 工具，为每个角色 spawn 一个 agent。所有 agent 使用：
- subagent_type: "general-purpose"
- team_name: "neptune-dev-team"
- mode: "auto"

**架构师**（首先 spawn）：
- name: "architect"
- 读取 .claude/agents/architect.md 作为 prompt 内容

**前端开发**：
- name: "frontend"
- 读取 .claude/agents/frontend.md 作为 prompt 内容

**后端开发**：
- name: "backend"
- 读取 .claude/agents/backend.md 作为 prompt 内容

**测试工程师**：
- name: "tester"
- 读取 .claude/agents/tester.md 作为 prompt 内容

每个 agent 的 prompt 构造方式：
1. 读取对应的 `.claude/agents/xxx.md` 文件获取角色定义
2. 在 prompt 开头附加以下内容：

```
你是团队 "neptune-dev-team" 的成员。你的名字是 {{name}}。

请先读取 ~/.claude/teams/neptune-dev-team/config.json 了解团队其他成员。
然后查看 TaskList 等待架构师分配任务。
```

### Step 4: 确认就绪

等待架构师发送就绪消息后，向用户确认：

> 团队已就绪！4 位成员均已上线：
> - 架构师（architect）— 等待你的指令
> - 前端开发（frontend）
> - 后端开发（backend）
> - 测试工程师（tester）
>
> 请告诉我你想做什么，我会将需求转达给架构师。

## 注意事项

- 如果 agent spawn 失败，报告错误并建议重试
- 团队仅在当前会话有效，关闭会话后团队自动解散
- 所有 agent 共享同一代码库，架构师负责协调避免文件冲突
