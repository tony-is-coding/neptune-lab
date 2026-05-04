# Dara Mono-Repo 结构收敛实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 dara mono-repo 按设计文档规范收敛整理，建立统一的目录结构、文档规范和导航体系。

**Architecture:** 纯结构性重组——创建文件骨架、迁移现有文档、拆分 CLAUDE.md、解耦 workspace 依赖。不涉及业务代码改动。

**Tech Stack:** Bun (workspace 管理)、git (文件迁移)、Markdown (文档)

**Spec:** `docs/superpowers/specs/2026-05-03-mono-repo-structure-design.md`

---

## File Structure

### 新建文件

| 文件 | 职责 |
|------|------|
| `CONTEXT-MAP.md` | mono-repo 导航入口 |
| `shared/CONTEXT.md` | 共享层身份与边界 |
| `shared/types/.gitkeep` | 共享类型占位 |
| `shared/toolchain/.gitkeep` | 工具链占位 |
| `shared/design-system/.gitkeep` | 设计系统占位 |
| `shared/infra/.gitkeep` | 基础设施占位 |
| `neptune-engine/CONTEXT.md` | engine 身份与边界 |
| `neptune-engine/CLAUDE.md` | engine 专属 AI 指令 |
| `neptune-ai/CONTEXT.md` | AI 平台身份与边界 |
| `neptune-ai/server/CONTEXT.md` | server 子 context |
| `neptune-ai/desktop/CONTEXT.md` | desktop 子 context |
| `neptune-cli/CONTEXT.md` | CLI 身份与边界 |
| `neptune-cli/CLAUDE.md` | CLI 专属 AI 指令 |
| `neptune-cli/docs/adr/.gitkeep` | CLI ADR 占位 |
| `neptune-buddy/CONTEXT.md` | 未来产品预留 |
| `neptune-buddy/docs/adr/.gitkeep` | 未来产品 ADR 预留 |
| `docs/adr/0001-mono-repo-structure.md` | 全局 ADR |
| `docs/adr/template.md` | ADR 模板 |
| `docs/governance/repo-conventions.md` | 仓库统一规范 |
| `package.json` | 根 workspace 配置 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `CLAUDE.md` | 拆分：移除 engine 特定内容，保留通用规范 |
| `neptune-ai/CLAUDE.md` | 添加 desktop DESIGN.md 引用 |
| `neptune-engine/package.json` | 移除 `neptune-ai/server` workspace |
| `neptune-cli/package.json` | 补齐 engine 依赖 |
| `.gitignore` | 添加 shared 相关忽略规则 |

### 迁移文件

| 源 | 目标 |
|----|------|
| `neptune-engine/docs_reference/` → | `docs/references/` |
| `neptune-engine/optimize_research/` → | `neptune-engine/research-docs/optimization/` |
| `neptune-ai/docs/specs/` → | `neptune-ai/docs/design/` |
| `neptune-engine/docs/neptune-ai-product-specification.md` → | `neptune-ai/docs/design/neptune-ai-product-specification.md` |
| `neptune-engine/docs/neptune-ai-system-architecture.md` → | `neptune-ai/docs/design/neptune-ai-system-architecture.md` |

---

## Task 1: 创建根目录骨架

**Files:**
- Create: `CONTEXT-MAP.md`
- Create: `docs/adr/template.md`
- Create: `docs/adr/0001-mono-repo-structure.md`
- Create: `docs/governance/repo-conventions.md`

- [ ] **Step 1: 创建 docs 子目录**

注意：不要创建 `docs/references/` 空目录，Task 4 会用 `git mv` 直接迁移 `docs_reference/` 为 `docs/references/`。如果提前创建空目录，`git mv` 会产生嵌套 `docs/references/docs_reference/`。

```bash
mkdir -p docs/adr docs/governance
```

- [ ] **Step 2: 创建 ADR 模板**

Write `docs/adr/template.md`:

```markdown
# NNNN: [标题]

日期: YYYY-MM-DD

## 状态

[提议 | 已接受 | 已废弃 | 已替代]

## 背景

[描述背景和动机]

## 决策

[描述做出的决策]

## 后果

[描述决策带来的影响，正面和负面]
```

- [ ] **Step 3: 创建全局 ADR 0001**

Write `docs/adr/0001-mono-repo-structure.md`:

```markdown
# 0001: Dara Mono-Repo 结构规范

日期: 2026-05-03

## 状态

已接受

## 背景

dara 仓库包含多个基于 neptune-engine SDK 的产品线。当前文档分散、CLAUDE.md 职责混乱、缺乏导航入口，需要建立统一的目录和文档规范。

## 决策

采用 CONTEXT.md / CONTEXT-MAP.md 驱动的文档导航体系，扁平产品线 + 顶层 shared/ 共享层结构。详细规范见 `docs/superpowers/specs/2026-05-03-mono-repo-structure-design.md`。

## 后果

- 所有产品线遵循统一的 CONTEXT.md 规范
- 文档按严谨性分级（docs/adr/、docs/design/、research-docs/）
- 各产品独立研发，通过 shared/ 共享跨产品资源
- neptune-buddy 等未来产品只需创建目录和 CONTEXT.md 即可加入
```

- [ ] **Step 4: 创建仓库统一规范**

Write `docs/governance/repo-conventions.md`:

```markdown
# Dara 仓库统一规范

## 目录规范

- 每个产品线是一个顶级目录，有独立的 `CONTEXT.md` 和 `CLAUDE.md`
- 根 `CONTEXT-MAP.md` 是仓库导航入口
- `shared/` 存放跨产品共享资源
- 各产品内部遵循相同的文档结构规范

## 文档规范

- `docs/adr/` — 架构决策记录（不可变）
- `docs/design/` — 功能设计文档（正式）
- `docs/superpowers/` — skills 体系文档（工具链管理）
- `research-docs/` — 研究笔记（过程性，可归档删除）

## 依赖规范

- engine 不依赖任何产品代码
- 产品之间互不依赖
- shared 不依赖任何产品和 engine
- 产品可以依赖 shared 和 engine

## 新增产品流程

1. 创建目录 + CONTEXT.md + CLAUDE.md
2. 创建 docs/adr/
3. 更新 CONTEXT-MAP.md
```

- [ ] **Step 5: 创建 CONTEXT-MAP.md**

Write `CONTEXT-MAP.md`:

```markdown
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

```
neptune-ai ──→ neptune-engine (SDK)
neptune-cli ──→ neptune-engine (SDK)
neptune-buddy ──→ neptune-engine (SDK) （未来）
shared ←── 所有产品 + engine（共享接口定义层）
```
```

- [ ] **Step 6: 验证**

```bash
ls CONTEXT-MAP.md docs/adr/template.md docs/adr/0001-mono-repo-structure.md docs/governance/repo-conventions.md
```

预期：所有文件存在。

- [ ] **Step 7: 提交**

```bash
git add CONTEXT-MAP.md docs/
git commit -m "$(cat <<'EOF'
chore: 创建 mono-repo 根目录骨架

添加 CONTEXT-MAP.md 导航入口、全局 ADR 目录和模板、
仓库统一规范文档。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 创建 shared/ 共享层骨架

**Files:**
- Create: `shared/CONTEXT.md`
- Create: `shared/types/.gitkeep`
- Create: `shared/toolchain/.gitkeep`
- Create: `shared/design-system/.gitkeep`
- Create: `shared/infra/.gitkeep`

- [ ] **Step 1: 创建 shared 目录结构**

```bash
mkdir -p shared/types shared/toolchain shared/design-system shared/infra
touch shared/types/.gitkeep shared/toolchain/.gitkeep shared/design-system/.gitkeep shared/infra/.gitkeep
```

- [ ] **Step 2: 创建 shared/CONTEXT.md**

Write `shared/CONTEXT.md`:

```markdown
# Shared — 跨产品共享层

## 这是什么？

dara mono-repo 中所有产品共用的类型定义、工具链、设计系统和基础设施接口。

## 为什么存在？

避免各产品重复定义相同的类型、配置和接口，统一技术标准和品牌规范。

## 边界

**负责：** 纯接口/协议定义、共享配置、品牌资源
**不负责：** 具体业务逻辑、产品特定实现

## 依赖

- 不依赖任何产品和 engine
- 被所有产品和 engine 依赖

## 关键目录

- `types/` — 共享 TypeScript 类型/协议定义
- `toolchain/` — 构建/发布/lint 共享工具链
- `design-system/` — 设计 token 和品牌资源
- `infra/` — 共享基础设施接口（认证、日志、监控）

## 当前状态

骨架已创建，内容由各产品实际需要时逐步填充。
```

- [ ] **Step 3: 验证**

```bash
ls shared/CONTEXT.md shared/types/.gitkeep shared/toolchain/.gitkeep shared/design-system/.gitkeep shared/infra/.gitkeep
```

- [ ] **Step 4: 提交**

```bash
git add shared/
git commit -m "$(cat <<'EOF'
chore: 创建 shared/ 共享层骨架

添加目录结构和 CONTEXT.md，内容由各产品按需填充。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 创建各产品 CONTEXT.md

**Files:**
- Create: `neptune-engine/CONTEXT.md`
- Create: `neptune-ai/CONTEXT.md`
- Create: `neptune-ai/server/CONTEXT.md`
- Create: `neptune-ai/desktop/CONTEXT.md`
- Create: `neptune-cli/CONTEXT.md`
- Create: `neptune-cli/CLAUDE.md`
- Create: `neptune-cli/docs/adr/.gitkeep`
- Create: `neptune-buddy/CONTEXT.md`
- Create: `neptune-buddy/docs/adr/.gitkeep`

- [ ] **Step 1: 创建 neptune-engine/CONTEXT.md**

Write `neptune-engine/CONTEXT.md`:

```markdown
# Neptune Engine — Agent Engine SDK 底座

## 这是什么？

将 Claude Code 的核心 Agent 执行能力解耦为通用 SDK，可嵌入任何应用。

## 为什么存在？

为 Neptune-AI、Neptune-CLI 等产品提供统一的 Agent 执行引擎。不绑定特定的宿主环境（CLI、Web、Desktop），作为所有 AI 产品的技术底座。

## 边界

**负责：** Agent 生命周期管理、工具执行、对话管理、SDK API 导出、MCP 客户端、多模型支持
**不负责：** 产品级 UI 交互、用户管理、计费、特定业务逻辑

## 依赖

- 不依赖任何产品代码
- 被所有产品依赖（作为 SDK）
- 可选依赖 `shared/`

## 关键目录

- `claude-code/` — 核心 SDK 源码（src/、packages/、完整 bun workspace）
- `auto-upgrade/` — 版本升级脚本（v1-v21）
- `docs/` — 设计文档、API 文档
- `research-docs/` — 研究文档

## 如何开发

```bash
cd neptune-engine/claude-code
bun install          # 安装依赖
bun test             # 运行测试（2472 tests / 0 fail）
bun run dev          # 开发模式
bunx tsc --noEmit    # 类型检查
```
```

- [ ] **Step 2: 创建 neptune-ai/CONTEXT.md**

Write `neptune-ai/CONTEXT.md`:

```markdown
# Neptune AI — 企业 AI 平台

## 这是什么？

培养专属 AI 员工的企业平台。目标用户是非技术业务人员，通过配置 Agent 模板（岗位说明书）、接入企业数据，让 Agent 上岗工作。

## 为什么存在？

将 neptune-engine SDK 的能力包装为面向企业的 SaaS 产品，降低 AI Agent 的使用门槛。

## 边界

**负责：** Agent 模板管理、Session 生命周期编排、用户与权限、MCP Server 注册、用量与计费
**不负责：** Agent 如何思考（prompt）、工具如何执行（SDK）、MCP Server 运行时

## 依赖

- 依赖 `neptune-engine/`（SDK）
- 依赖 `shared/`（共享类型）

## 关键目录

- `server/` — 后端编排层（[子 context](server/CONTEXT.md)）
- `desktop/` — 前端桌面端（[子 context](desktop/CONTEXT.md)）
- `docs/` — 产品设计文档

## 如何开发

```bash
# 后端
cd neptune-ai/server
docker-compose up -d    # PostgreSQL + Redis
bun install && bun run dev

# 前端
cd neptune-ai/desktop
bun install && bun run dev
```
```

- [ ] **Step 3: 创建 neptune-ai 子 context**

Write `neptune-ai/server/CONTEXT.md`:

```markdown
# Server — 后端编排层

Bun + Fastify 编排层。管编排不管执行。Agent 是产品的一等公民，一个 Agent = 一个持续对话流。

核心技术栈：Bun 1.x、Fastify 5.x、PostgreSQL 16+ (Drizzle ORM)、Redis 7+

关键文件：
- `src/services/session.ts` — QueryDispatcher，核心调度器
- `src/services/permission-delegate.ts` — 租户权限隔离
- `src/db/schema.ts` — Drizzle ORM 全部表定义
```

Write `neptune-ai/desktop/CONTEXT.md`:

```markdown
# Desktop — 前端桌面端

React 19 + Vite 7 + Tailwind CSS v4 + Tauri v2 桌面端。

UI 设计系统遵循 Anthropic/Claude 设计语言（详见 `DESIGN.md`）。

核心技术栈：React 19、Vite 7、Tailwind CSS v4、Tauri v2、Zustand

关键目录：
- `src/pages/` — 页面组件（Login, AgentList, AgentChat, CreateAgent）
- `src/api/` — API 客户端（Axios + SSE）
- `src/stores/` — Zustand 状态管理
```

- [ ] **Step 4: 创建 neptune-cli/CONTEXT.md**

Write `neptune-cli/CONTEXT.md`:

```markdown
# Neptune CLI — 终端 CLI 产品

## 这是什么？

基于 neptune-engine SDK 构建的终端 CLI 宿主，提供炫酷的终端交互体验。

## 为什么存在？

为开发者提供命令行方式使用 Agent 能力的入口，是 neptune-engine SDK 在终端场景下的直接应用。

## 边界

**负责：** 终端 UI 渲染、用户输入处理、命令注册、终端交互体验
**不负责：** Agent 执行逻辑（由 engine SDK 提供）

## 依赖

- 依赖 `neptune-engine/claude-code/`（SDK）
- 可选依赖 `shared/`

## 关键目录

- `src/` — CLI 源码（命令、组件、服务）
- `src/commands/` — 丰富的命令注册
- `src/components/` — 终端 UI 组件（Ink）

## 如何开发

```bash
cd neptune-cli
bun install
bun run dev
```
```

- [ ] **Step 5: 创建 neptune-cli/CLAUDE.md**

Write `neptune-cli/CLAUDE.md`:

```markdown
# CLAUDE.md — Neptune CLI

## 顶级规则

所有沟通过程、文档都必须使用中文。

## 项目概述

Neptune CLI 是基于 neptune-engine SDK 构建的终端产品。代码源自 Claude Code CLI 的反编译/逆向工程版本，许多模块被 stub 或 feature flag 关闭。

## 开发命令

```bash
bun install           # 安装依赖
bun run dev           # 开发模式
bun test              # 运行测试
bun run build         # 构建
bunx tsc --noEmit     # 类型检查
```

## 技术栈

- 运行时：Bun（不是 Node.js）
- UI：React + Ink（终端渲染）
- 模块系统：ESM + TSX
- 构建：Bun.build with splitting
```

- [ ] **Step 6: 创建 neptune-cli/docs/adr/**

```bash
mkdir -p neptune-cli/docs/adr
touch neptune-cli/docs/adr/.gitkeep
```

- [ ] **Step 7: 创建 neptune-buddy 预留**

```bash
mkdir -p neptune-buddy/docs/adr
touch neptune-buddy/docs/adr/.gitkeep
```

Write `neptune-buddy/CONTEXT.md`:

```markdown
# Neptune Buddy — 个人智能助手（未来产品）

## 这是什么？

主打个人终端智能助手的产品线，当前仅预留目录结构。

## 状态

未启动开发。当需要启动时，创建 CLAUDE.md 和 src/ 目录，更新根 CONTEXT-MAP.md。
```

- [ ] **Step 8: 验证**

```bash
for f in neptune-engine/CONTEXT.md neptune-ai/CONTEXT.md neptune-ai/server/CONTEXT.md neptune-ai/desktop/CONTEXT.md neptune-cli/CONTEXT.md neptune-cli/CLAUDE.md neptune-cli/docs/adr/.gitkeep neptune-buddy/CONTEXT.md neptune-buddy/docs/adr/.gitkeep; do
  [ -f "$f" ] && echo "OK: $f" || echo "MISSING: $f"
done
```

- [ ] **Step 9: 提交**

```bash
git add neptune-engine/CONTEXT.md neptune-ai/CONTEXT.md neptune-ai/server/CONTEXT.md neptune-ai/desktop/CONTEXT.md neptune-cli/CONTEXT.md neptune-cli/CLAUDE.md neptune-cli/docs/ neptune-buddy/
git commit -m "$(cat <<'EOF'
chore: 创建各产品 CONTEXT.md 和 neptune-buddy 预留

为 neptune-engine、neptune-ai、neptune-cli 创建 CONTEXT.md，
为 neptune-ai/server、neptune-ai/desktop 创建子 context，
创建 neptune-cli/CLAUDE.md，预留 neptune-buddy 未来产品目录。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 迁移文档

**Files:**
- Move: `neptune-engine/docs_reference/` → `docs/references/`
- Move: `neptune-engine/optimize_research/` → `neptune-engine/research-docs/optimization/`
- Move: `neptune-ai/docs/specs/` → `neptune-ai/docs/design/`
- Move: `neptune-engine/docs/neptune-ai-product-specification.md` → `neptune-ai/docs/design/`
- Move: `neptune-engine/docs/neptune-ai-system-architecture.md` → `neptune-ai/docs/design/`

- [ ] **Step 1: 迁移 docs_reference 到全局 references**

如果 Task 1 意外创建了空 `docs/references/` 目录，先删除它再执行 git mv：
```bash
rmdir docs/references 2>/dev/null; git mv neptune-engine/docs_reference docs/references
```

- [ ] **Step 2: 迁移 optimize_research 到 research-docs/optimization**

```bash
git mv neptune-engine/optimize_research neptune-engine/research-docs/optimization
```

- [ ] **Step 3: 迁移 neptune-ai specs → design**

```bash
git mv neptune-ai/docs/specs neptune-ai/docs/design
```

- [ ] **Step 4: 迁移误放在 engine 下的 AI 产品文档**

```bash
git mv neptune-engine/docs/neptune-ai-product-specification.md neptune-ai/docs/design/
git mv neptune-engine/docs/neptune-ai-system-architecture.md neptune-ai/docs/design/
```

- [ ] **Step 5: 更新 neptune-ai/CLAUDE.md 中的文档路径引用**

现有 `neptune-ai/CLAUDE.md` 引用了 `docs/specs/`，迁移后需要更新为 `docs/design/`：

在 `neptune-ai/CLAUDE.md` 中，将 `产品设计文档：\`docs/specs/\`` 改为 `产品设计文档：\`docs/design/\``。

- [ ] **Step 6: 重组 neptune-engine/docs/ 内部结构**

将 engine docs 下散落的文档按新规范归类：

```bash
# 创建新子目录
mkdir -p neptune-engine/docs/guides

# 归类：入门指南
git mv neptune-engine/docs/getting-started.md neptune-engine/docs/guides/
git mv neptune-engine/docs/quick-start.md neptune-engine/docs/guides/
git mv neptune-engine/docs/cli-usage.md neptune-engine/docs/guides/
```

以下文件保留在 `neptune-engine/docs/` 根目录（属于全局性文档）：
- `architecture-design.md` — 架构设计
- `project-purpose.md` — 项目目标
- `okr-roadmap.md` — OKR 路线图
- `sdk-event-types.md` — SDK 事件类型定义
- `feature-design/` — 功能设计目录（保留）
- `api/` — API 文档目录（保留）
- `examples/` — 示例目录（保留）
- `superpowers/` — superpowers 目录（保留）

- [ ] **Step 7: 验证迁移结果**

```bash
echo "=== 应存在 ==="
ls docs/references/deep-dive-claudecode/ 2>/dev/null && echo "OK: references"
ls neptune-engine/research-docs/optimization/ 2>/dev/null && echo "OK: optimization"
ls neptune-ai/docs/design/ 2>/dev/null && echo "OK: design"
ls neptune-engine/docs/guides/getting-started.md 2>/dev/null && echo "OK: guides"
echo "=== 应不存在 ==="
ls neptune-engine/docs_reference/ 2>&1 | grep -q "No such" && echo "OK: docs_reference 已删除" || echo "WARN: docs_reference 仍存在"
ls neptune-engine/optimize_research/ 2>&1 | grep -q "No such" && echo "OK: optimize_research 已删除" || echo "WARN: optimize_research 仍存在"
ls neptune-ai/docs/specs/ 2>&1 | grep -q "No such" && echo "OK: specs 已删除" || echo "WARN: specs 仍存在"
echo "=== 路径引用检查 ==="
grep "docs/design" neptune-ai/CLAUDE.md && echo "OK: AI CLAUDE.md 已更新路径"
```

- [ ] **Step 8: 提交**

```bash
git add docs/references/ neptune-engine/research-docs/optimization/ neptune-ai/docs/design/ neptune-ai/CLAUDE.md neptune-engine/docs/guides/ neptune-engine/docs/getting-started.md neptune-engine/docs/quick-start.md neptune-engine/docs/cli-usage.md
git commit -m "$(cat <<'EOF'
chore: 迁移文档到新规范体系

- docs_reference → docs/references（提升到全局）
- optimize_research → research-docs/optimization（合并到 research-docs）
- specs → design（neptune-ai 设计文档）
- 误放文档回归：engine 下的 AI 产品文档移到 neptune-ai/docs/design/
- engine docs 重组：入门/使用指南归入 guides/

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 重构 CLAUDE.md 分层（根 + engine，一个 commit）

**Files:**
- Modify: `CLAUDE.md`
- Create: `neptune-engine/CLAUDE.md`
- Modify: `neptune-ai/CLAUDE.md`

这两个操作是同一件事的两面（从根移出 engine 内容、写入 engine CLAUDE.md），必须在一个 commit 中完成，避免中途中断导致内容丢失。

- [ ] **Step 1: 重写根 CLAUDE.md**

将根 CLAUDE.md 精简为只包含全局通用规则。移除 engine 特定内容（项目目标、关键目录说明、测试设计原则中 engine 特定的部分）、desktop 相关的注意。

Write `CLAUDE.md`（完整替换）：

```markdown
## 顶级规则
1、所有沟通过程、文档都必须使用中文

### 做事风格
在你做事前，需要反思，每一步都必须有足够的思考
1、你为什么要做这个, 一定要深度思考用户目标;
2、你的用户是谁? 用户会怎么使用你的产品?
3、你的用户/验收者、你的leader 如何在不了解你怎么做的情况下？能够验收你做的事情?
4、你当前在做的事情，是否遵循来项目长期目标、是否遵循你任务本身的目标?
5、一旦判断上下文接近上限了，触发/compact 压缩命令，避免系统死机
6、一定要确保所有细节都澄清后才开始干活，不要直接上来就写代码或者写文档

### 完成任何事情之后总结
1、你做了什么工作?
2、有什么新的feature加入了? 改变在哪里？
3、用户/我  要如何进行测试？

---

## 项目导航

项目全景见 [CONTEXT-MAP.md](CONTEXT-MAP.md)，各产品独立规范见各自的 CLAUDE.md。

---

## 全局开发规范

### 渐进式改造原则

每阶段都必须满足：
1. **结构验证**：代码结构是否朝目标边界移动
2. **行为验证**：现有能力是否仍可用
3. **目标验证**：新抽象是否真能支撑下一阶段

每阶段必须产出：
- 阶段内测试通过
- 旧能力回归通过
- 下一阶段准入门禁满足
- 失败时的回退建议

### TDD 开发纪律

1. 先写测试，再写实现
2. 按照阶段进行开发，先思考这个阶段目标，设计阶段测试用例
3. 不为了"未来可能用到"增加额外抽象
4. 任何新增类型都以当前测试需要为准

### 验证原则

不接受"感觉没问题"，可接受的验证结论必须来自：
- 自动化测试结果
- 可重复的人工验收步骤
- 明确的阶段门禁结论

### 文档管理规范

*文档是最宝贵的资源，千万不要在乱放、乱写，必须严谨，讲究事实，可靠*

- 全局架构决策：`docs/adr/`
- 全局共享参考：`docs/references/`
- 各产品文档：各产品目录下的 `docs/`
- 研究文档/过程文档：各产品目录下的 `research-docs/`
- 仓库规范：`docs/governance/`
```

- [ ] **Step 2: 创建 neptune-engine/CLAUDE.md**

从原根 CLAUDE.md 中提取 engine 特定内容（项目目标、关键目录说明、参考文档），写入 neptune-engine/CLAUDE.md。

Write `neptune-engine/CLAUDE.md`:

```markdown
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

- **claude-code**：核心项目框架主代码，对外提供 SDK
- **auto-upgrade**：版本升级脚本（v1-v21）
- **docs**：设计文档、API 文档
- **research-docs**：研究文档

## 测试设计原则

1. 采用 TDD 开发方式：先写测试，再写实现
2. 测试编码组织遵循目录风格 claude-code-framework-test/{阶段名称}/

## 参考文档

1. claude code 关键细节设计参考 [deep-dive-claudecode](../docs/references/deep-dive-claudecode)
2. claude code 核心组件设计参考 [claude-reviews-claude](../docs/references/claude-reviews-claude)
3. claude code 学习路径 [learn](../docs/references/learn)
```

- [ ] **Step 3: 更新 neptune-ai/CLAUDE.md 添加 desktop 引用**

在现有 neptune-ai/CLAUDE.md 的 "项目目标" 之前添加：

```markdown
## 注意

在开发 [desktop](desktop) 这个项目的时候，一定要遵循 [DESIGN.md](desktop/DESIGN.md) 的规范要求，UI 规范要求。

---
```

- [ ] **Step 4: 验证**

```bash
# 根 CLAUDE.md 不包含产品特定内容
grep -c "neptune-engine\|claude-code\|desktop.*DESIGN\|项目目标\|关键目录说明" CLAUDE.md
```

预期：0。

```bash
# engine CLAUDE.md 包含迁移的内容
grep "项目目标" neptune-engine/CLAUDE.md && echo "OK: engine 目标存在"
grep "关键目录" neptune-engine/CLAUDE.md && echo "OK: 目录说明存在"
grep "参考文档" neptune-engine/CLAUDE.md && echo "OK: 参考文档存在"
```

```bash
# AI CLAUDE.md 有 desktop 引用
grep "desktop.*DESIGN" neptune-ai/CLAUDE.md
```

- [ ] **Step 5: 提交（根 + engine + AI 在一个 commit）**

```bash
git add CLAUDE.md neptune-engine/CLAUDE.md neptune-ai/CLAUDE.md
git commit -m "$(cat <<'EOF'
chore: 重构 CLAUDE.md 分层

根 CLAUDE.md 精简为全局通用规则，移除 engine 特定内容。
engine 特定内容写入 neptune-engine/CLAUDE.md。
desktop DESIGN.md 引用移到 neptune-ai/CLAUDE.md。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 解耦 workspace 配置

**Files:**
- Create: `package.json`（根目录）
- Modify: `neptune-engine/package.json`
- Modify: `neptune-cli/package.json`

**风险提示：**
- `neptune-cli/node_modules` 符号链接已断裂（指向 `../claude-code/node_modules`，但 `dara/claude-code/` 不存在），删除不会影响功能
- 嵌套 workspace（根 → engine → claude-code）需要 bun 支持，解耦后需要验证 `bun install`
- `neptune-ai/desktop` 有独立 `package.json` 和 `bun.lock`，不纳入根 workspace，保持完全独立管理

- [ ] **Step 1: 创建根 package.json**

Write `package.json`（根目录）：

```json
{
  "name": "dara-monorepo",
  "private": true,
  "workspaces": [
    "neptune-engine/claude-code",
    "neptune-engine/claude-code/packages/*",
    "neptune-engine/claude-code/packages/@ant/*",
    "neptune-ai/server",
    "neptune-cli"
  ]
}
```

- [ ] **Step 2: 从 engine package.json 移除 neptune-ai/server**

在 `neptune-engine/package.json` 中，将 workspaces 数组从：

```json
"workspaces": [
    "claude-code",
    "claude-code/packages/*",
    "claude-code/packages/@ant/*",
    "neptune-ai/server"
]
```

改为：

```json
"workspaces": [
    "claude-code",
    "claude-code/packages/*",
    "claude-code/packages/@ant/*"
]
```

- [ ] **Step 3: 为 neptune-cli 补齐 engine 依赖**

重要：engine SDK 的实际包名是 `claude-code-best`（不是 `claude-code`）。

将 `neptune-cli/package.json` 替换为：

```json
{
  "name": "neptune-cli",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "bun run src/main.tsx",
    "dev": "bun run --watch src/main.tsx"
  },
  "dependencies": {
    "claude-code-best": "workspace:*"
  }
}
```

- [ ] **Step 4: 删除 neptune-cli 断裂的符号链接**

```bash
rm neptune-cli/node_modules
```

- [ ] **Step 5: 在根目录运行 bun install 验证依赖解析**

```bash
bun install
```

预期：安装成功，无报错。如果 bun 不支持嵌套 workspace（根 → engine → claude-code），需要回退并调整策略（保持 engine 的 workspace 不变，只将 neptune-ai/server 提升到根）。

- [ ] **Step 6: 验证各子项目**

```bash
# 验证 engine 不再引用 AI server
cat neptune-engine/package.json | grep "neptune-ai/server" && echo "FAIL: engine 仍引用 AI server" || echo "OK: engine 已解耦"

# 验证 CLI 依赖正确
grep "claude-code-best" neptune-cli/package.json && echo "OK: CLI 使用正确的包名"

# 验证 engine 测试仍通过
cd neptune-engine/claude-code && bun test --timeout 30s 2>&1 | tail -5
```

- [ ] **Step 7: 提交**

```bash
git add package.json neptune-engine/package.json neptune-cli/package.json
git commit -m "$(cat <<'EOF'
chore: 解耦 workspace 配置

- 创建根 package.json 统一管理 workspace
- engine package.json 移除对 neptune-ai/server 的引用
- neptune-cli 补齐 workspace 依赖声明（claude-code-best）
- 删除 neptune-cli/node_modules 断裂的符号链接

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 更新 .gitignore 和清理

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 更新 .gitignore**

在 `.gitignore` 末尾添加：

```
# Shared layer - no build artifacts committed
shared/**/node_modules
shared/**/dist
```

- [ ] **Step 2: 检查所有 CONTEXT.md 和 CLAUDE.md 中的链接**

```bash
echo "=== 检查 CONTEXT-MAP.md 链接 ==="
for link in neptune-engine/CONTEXT.md neptune-ai/CONTEXT.md neptune-cli/CONTEXT.md shared/CONTEXT.md; do
  [ -f "$link" ] && echo "OK: $link" || echo "BROKEN: $link"
done

echo "=== 检查 engine CLAUDE.md 参考文档链接 ==="
[ -d docs/references/deep-dive-claudecode ] && echo "OK: deep-dive-claudecode" || echo "BROKEN"
[ -d docs/references/claude-reviews-claude ] && echo "OK: claude-reviews-claude" || echo "BROKEN"
[ -d docs/references/learn ] && echo "OK: learn" || echo "BROKEN"
```

- [ ] **Step 3: 提交**

```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
chore: 更新 .gitignore 添加 shared 层忽略规则

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 翻译 neptune-engine/claude-code/CLAUDE.md 为中文

**Files:**
- Modify: `neptune-engine/claude-code/CLAUDE.md`

- [ ] **Step 1: 阅读当前英文 CLAUDE.md**

Read `neptune-engine/claude-code/CLAUDE.md`（当前为 286 行英文）。

- [ ] **Step 2: 翻译为中文**

保留技术术语的英文原文（TypeScript、Bun、SDK、React、Ink 等），其余内容翻译为中文。保留所有代码块、命令、文件路径不变。

关键翻译要点：
- 标题和描述性文字 → 中文
- 技术名词 → 保留英文
- 代码块和命令 → 不变
- 表格中的说明 → 中文

**注意：此步骤由 AI 执行翻译，翻译完成后需要人工审查翻译质量。** 同时检查文件中是否有相对路径引用需要更新（如 `docs/testing-spec.md` 等路径在文档迁移后是否仍有效）。

- [ ] **Step 3: 验证**

```bash
# 确认文件不为空且包含中文
wc -l neptune-engine/claude-code/CLAUDE.md
grep -c "##" neptune-engine/claude-code/CLAUDE.md
```

- [ ] **Step 4: 提交**

```bash
git add neptune-engine/claude-code/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: 翻译 neptune-engine/claude-code/CLAUDE.md 为中文

保留技术术语英文原文，描述性内容统一为中文。

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## 任务依赖关系

```
Task 1 (根骨架) ─────┐
Task 2 (shared 骨架) ─┤
Task 3 (CONTEXT.md) ──┼──→ Task 4 (迁移文档) ──→ Task 5 (重构 CLAUDE.md 分层)
                      │
                      └──→ Task 6 (解耦 workspace) ──→ Task 7 (清理)
                      └──→ Task 8 (翻译 CLAUDE.md)
```

Task 1/2/3 可并行。Task 4 依赖 Task 1。Task 5 依赖 Task 4（需要迁移后的路径）。Task 6 依赖 Task 1/2/3。Task 7/8 可并行，依赖前面的任务。
