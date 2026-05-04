# CLAUDE.md — Neptune Engine

## 顶级规则

所有沟通过程、文档都必须使用中文。

## 项目目标

将 Claude Code 的核心执行能力从 CLI 宿主中解耦出来，沉淀为一个通用的 **Agent Engine 底座**，使其可以：

核心原则：
- 最小改动现有代码，优先包裹和外扩
- 核心 agent loop 尽量不变

核心使用场景：
- 嵌入业务应用、随宿主进程启动
- 被 CLI / Web / App 的服务端复用，提供标准的 Agent 能力

## 关键目录说明

- **src/**：核心项目框架主代码（engine/ 为 SDK 核心）
- **packages/**：workspace 子包（builtin-tools, mcp-client 等）
- **docs/**：设计文档、API 文档
- **.claude/skills/improve-codebase-architecture/**：架构优化技能及历史迭代记录

## 测试设计原则

1. 采用 TDD 开发方式：先写测试，再写实现
2. 测试编码组织遵循目录风格 claude-code-framework-test/{阶段名称}/

## 参考文档

1. claude code 关键细节设计参考 [deep-dive-claudecode](../docs/references/deep-dive-claudecode)
2. claude code 核心组件设计参考 [claude-reviews-claude](../docs/references/claude-reviews-claude)
3. claude code 学习路径 [learn](../docs/references/learn)
