# Dara Mono-Repo

企业级 AI 系统 mono-repo。所有产品基于 neptune-engine SDK 向上生长。

## Contexts

| Context | 位置 | 一句话描述 |
|---------|------|-----------|
| Neptune Engine | [neptune-engine/CONTEXT.md](neptune-engine/CONTEXT.md) | Agent Engine SDK 底座，提供核心 Agent 执行能力 |
| Neptune AI | [neptune-ai/CONTEXT.md](neptune-ai/CONTEXT.md) | 企业 AI 平台，培养专属 AI 员工 |
| Neptune CLI | [neptune-cli/CONTEXT.md](neptune-cli/CONTEXT.md) | 终端 CLI 宿主，炫酷交互体验 |
| Shared | [shared/CONTEXT.md](shared/CONTEXT.md) | 跨产品共享的类型、工具链、设计系统、基础设施接口 |

## 依赖关系

neptune-ai ──→ neptune-engine (SDK)
neptune-cli ──→ neptune-engine (SDK)
neptune-buddy ──→ neptune-engine (SDK) （未来）
shared ←── 所有产品 + engine（共享接口定义层）
