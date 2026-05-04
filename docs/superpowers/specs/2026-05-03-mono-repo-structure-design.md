# Dara Mono-Repo 结构收敛与文档规范化设计

> 日期：2026-05-03
> 状态：评审修订中

---

## 1. 背景与目标

### 1.1 现状问题

1. **目录职责不清**：根 CLAUDE.md 同时包含全局规范和 neptune-engine 特定规范，职责混乱
2. **文档散落**：文档分布在 `docs/`、`docs_reference/`、`research-docs/`、`optimize_research/`、`docs/specs/` 等多处，无统一规范
3. **缺乏导航**：没有 mono-repo 级别的导航入口，新人/AI 助手难以快速理解仓库全景
4. **共享层缺失**：跨产品复用的类型、工具链、设计系统没有统一存放位置
5. **CLAUDE.md 风格不一致**：neptune-engine/claude-code 的 CLAUDE.md 是英文，其他是中文
6. **workspace 耦合**：neptune-engine/package.json 的 workspaces 包含 `neptune-ai/server`，engine 承担了 AI 产品 server 的依赖解析职责
7. **依赖符号链接**：neptune-cli 的 node_modules 是指向 neptune-engine/claude-code/node_modules 的符号链接，并未真正独立管理依赖

### 1.2 目标

将 dara 建设为企业级代码+知识+文档 mono-repo，实现：

- **统一规范**：所有产品线遵循相同的目录结构、文档规范、开发纪律
- **独立研发**：各产品线互不耦合，可独立构建、测试、发布
- **清晰导航**：任何人/AI 可通过 CONTEXT-MAP.md 快速理解仓库全景
- **知识沉淀**：文档按严谨性分级，避免散落和重复

### 1.3 核心原则

- 所有产品基于 neptune-engine SDK 向上生长
- 产品之间互不依赖
- engine 不依赖任何产品代码（engine 是底层，不是产品）
- shared 层被所有产品和 engine 依赖，但不依赖任何产品和 engine（纯接口/协议定义）
- neptune-buddy 是未来产品，当前只在结构中预留空位

---

## 2. 顶层目录结构

```
dara/                                 # mono-repo 根
├── CONTEXT-MAP.md                    # 仓库总览 + context 导航
├── CLAUDE.md                         # 全局 AI 助手行为指令
├── .gitignore
├── docs/                             # mono-repo 级文档
│   ├── adr/                          # 全局架构决策记录
│   │   └── 0001-mono-repo-structure.md
│   ├── references/                   # 全局共享参考文档（原 docs_reference）
│   └── governance/                   # 治理规范
│       └── repo-conventions.md       # 仓库统一规范
├── shared/                           # 跨产品共享层
│   ├── CONTEXT.md
│   ├── types/                        # 共享 TypeScript 类型/协议（见 6.2 节边界说明）
│   ├── toolchain/                    # 构建/发布/lint 工具链
│   ├── design-system/                # 设计系统 token + 品牌资源
│   └── infra/                        # 共享基础设施接口定义
├── neptune-engine/                   # Agent Engine SDK 底座
│   ├── CONTEXT.md
│   ├── CLAUDE.md                     # engine 专属 AI 指令
│   ├── claude-code/                  # 核心 SDK 源码（保留原位）
│   │   ├── CLAUDE.md                 # SDK 内部开发指令（保留，见 5.4 节语言规范）
│   │   ├── src/                      # SDK 源代码
│   │   ├── packages/                 # SDK 内部 workspace packages
│   │   └── ...
│   ├── auto-upgrade/                 # 版本升级脚本（保留原位）
│   │   ├── v1/
│   │   └── ...
│   ├── docs/
│   │   ├── adr/
│   │   ├── api/                      # SDK API 文档
│   │   ├── design/                   # 功能设计文档
│   │   └── superpowers/              # superpowers skills 体系文档
│   │       ├── plans/
│   │       └── specs/
│   ├── research-docs/                # 研究文档
│   └── ...
├── neptune-ai/                       # 企业 AI 平台产品
│   ├── CONTEXT.md
│   ├── CLAUDE.md
│   ├── docs/
│   │   ├── adr/
│   │   └── design/                   # 产品设计文档（原 specs/）
│   ├── server/                       # 子 context
│   │   └── CONTEXT.md
│   ├── desktop/                      # 子 context
│   │   └── CONTEXT.md
│   └── ...
├── neptune-cli/                      # 终端 CLI 产品
│   ├── CONTEXT.md
│   ├── CLAUDE.md
│   ├── docs/
│   │   └── adr/
│   └── ...
└── neptune-buddy/                    # 未来产品：个人智能助手（当前仅预留空目录）
    ├── CONTEXT.md
    └── docs/adr/
```

### 2.1 neptune-engine 内部结构说明

neptune-engine 是最复杂的子项目，内部保留以下核心目录：

| 目录 | 说明 | 处置 |
|------|------|------|
| `claude-code/` | 核心 SDK 源码，含 src/、packages/、完整的 bun workspace | **保留原位**，不重组 |
| `auto-upgrade/` | 21 个版本的升级脚本 | **保留原位**，属于 engine 版本管理能力 |
| `docs/` | 设计文档、API 文档、superpowers | 按新规范重组（见 4.4 节） |
| `docs_reference/` | claude-code 深度参考 | **迁移到根 `docs/references/`** |
| `research-docs/` | 研究文档 | 保留 |
| `optimize_research/` | 优化研究 | **合并到 `research-docs/optimization/`** |

---

## 3. CONTEXT.md / CONTEXT-MAP.md 规范

### 3.1 CONTEXT-MAP.md（dara 根目录）

定位：mono-repo 的导航入口，帮助任何人快速理解仓库全景。

**格式要求：**

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

neptune-ai ──→ neptune-engine (SDK)
neptune-cli ──→ neptune-engine (SDK)
neptune-buddy ──→ neptune-engine (SDK) （未来）
shared ←── 所有产品 + engine（共享接口定义层）
```

### 3.2 CONTEXT.md（各产品/子项目）

每个 CONTEXT.md 必须回答以下 6 个问题：

1. **这是什么？** — 一句话定义
2. **为什么存在？** — 在 mono-repo 中的定位和目标
3. **边界在哪？** — 它负责什么，不负责什么
4. **依赖谁？被谁依赖？** — 上下游关系
5. **关键目录** — 内部重要目录说明
6. **如何开发？** — 构建、测试、运行命令

**子 context 规则：**
- 当产品内部有明确独立的子系统时（如 neptune-ai 的 server 和 desktop），子目录可以有自己的 CONTEXT.md
- 父 CONTEXT.md 不重复子 context 内容，只链接到子 context

### 3.3 与 CLAUDE.md 的关系

| 文件 | 目标读者 | 内容 |
|------|---------|------|
| CONTEXT.md | 人类开发者（和 AI） | 这个项目是什么、边界、依赖 |
| CLAUDE.md | AI 助手（Claude Code） | 开发指令、编码规范、做事风格 |

- CONTEXT.md 回答 "这是什么"
- CLAUDE.md 回答 "怎么开发它"
- 两者可以共存，职责不重叠

---

## 4. 文档目录统一规范

### 4.1 每个 context 的标准文档结构

```
{context}/
├── CONTEXT.md                # 项目身份与边界
├── CLAUDE.md                 # AI 开发指令（可选）
├── docs/
│   ├── adr/                  # 架构决策记录
│   │   ├── 0001-xxx.md
│   │   └── template.md       # ADR 模板
│   ├── design/               # 功能/技术设计文档
│   │   └── {feature-name}/
│   ├── superpowers/          # superpowers skills 体系文档（如使用）
│   │   ├── plans/
│   │   └── specs/
│   ├── guides/               # 开发指南（可选）
│   └── api/                  # API 文档（可选）
├── research-docs/            # 研究文档（过程性，非正式）
└── src/                      # 代码
```

**superpowers 目录说明：** superpowers 是 Claude Code skills 体系产生的文档（plans 和 specs）。它们属于正式文档但由特定工具链管理，因此独立于 `docs/design/`。目前仅 neptune-engine 和 dara 根使用 superpowers 体系。

### 4.2 文档分类原则

| 目录 | 性质 | 质量 | 版本控制 |
|------|------|------|---------|
| `docs/adr/` | 架构决策，不可变记录 | 严谨、事实 | 跟随项目 |
| `docs/design/` | 功能设计文档 | 正式、可评审 | 跟随项目 |
| `docs/superpowers/` | skills 体系文档 | 正式、工具链管理 | 跟随项目 |
| `docs/guides/` | 开发指南 | 实用为主 | 跟随项目 |
| `docs/api/` | API 文档 | 与代码同步 | 跟随项目 |
| `research-docs/` | 研究笔记、调研、过程记录 | 允许粗略 | 允许归档删除 |

### 4.3 ADR 编号规则

- mono-repo 根 `docs/adr/`：全局架构决策
- 各产品 `docs/adr/`：产品内部决策，独立编号
- 编号格式：`NNNN-简短标题.md`
- ADR 模板参考 [Michael Nygard 经典模板](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

### 4.4 现有文档迁移映射

| 当前位置 | 迁移到 | 说明 |
|---------|--------|------|
| `neptune-engine/docs/` | `neptune-engine/docs/` | 保持原位，按新规范重组子目录 |
| `neptune-engine/docs_reference/` | `docs/references/` | 提升到 mono-repo 级（claude-code 参考对所有产品有价值） |
| `neptune-engine/research-docs/` | `neptune-engine/research-docs/` | 保持原位 |
| `neptune-engine/optimize_research/` | `neptune-engine/research-docs/optimization/` | 合并到 research-docs |
| `neptune-engine/docs/superpowers/` | `neptune-engine/docs/superpowers/` | 保持原位 |
| `neptune-ai/docs/specs/` | `neptune-ai/docs/design/` | 按新规范重命名 |
| 根 `docs/superpowers/` | 根 `docs/superpowers/` | 保持原位（本设计文档所在位置） |

---

## 5. CLAUDE.md 分层策略

### 5.1 根 CLAUDE.md（dara/）

只放全局通用规则：
- 所有沟通/文档使用中文
- 做事风格（反思4问、完成后总结）
- mono-repo 级通用规范（验证原则、TDD 纪律）
- 文档管理规范（全局版）
- 指向 CONTEXT-MAP.md 作为项目导航

### 5.2 各产品 CLAUDE.md

只放该产品专属的：
- 产品级开发命令
- 技术栈说明
- 产品特定的编码规范
- 测试命令和策略
- 产品特定的文档管理补充

### 5.3 具体迁移

| 当前根 CLAUDE.md 中的内容 | 迁移到 |
|--------------------------|--------|
| "项目目标"（engine 相关描述） | `neptune-engine/CLAUDE.md` |
| "关键目录说明" | `neptune-engine/CLAUDE.md` |
| "TDD 开发纪律" | 根 CLAUDE.md 保留（通用规范） |
| "验证原则" | 根 CLAUDE.md 保留（通用规范） |
| "测试设计原则" | 根 CLAUDE.md 保留（通用规范） |
| "文档管理规范" | 根 CLAUDE.md 保留（通用规范） |
| "开发 desktop 遵循 DESIGN.md" | `neptune-ai/CLAUDE.md` |
| "参考文档" 指向 | 根 CLAUDE.md 更新为 `docs/references/` |

### 5.4 语言规范

**规则：所有 CLAUDE.md 和 CONTEXT.md 统一使用中文。**

- 当前 `neptune-engine/claude-code/CLAUDE.md` 是英文（286 行），需要在实施阶段翻译为中文
- 根 `CLAUDE.md` 和 `neptune-ai/CLAUDE.md` 已是中文，无需改动
- 翻译时保留技术术语的英文原文（如 TypeScript、Bun、SDK 等），其余内容用中文表达

---

## 6. shared/ 共享层设计

### 6.1 目录结构

```
shared/
├── CONTEXT.md
├── types/
│   ├── package.json
│   └── src/
│       ├── protocols/         # Agent 通信协议类型（消息格式、工具调用协议等）
│       ├── events/            # 跨产品事件类型
│       └── common/            # 通用工具类型
├── toolchain/
│   ├── eslint-config/         # 共享 ESLint 配置
│   ├── biome-config/          # 共享 Biome 配置
│   └── scripts/               # 共享构建/发布脚本
├── design-system/
│   ├── tokens/                # 设计 token（颜色、间距等）
│   └── assets/                # 品牌资源（logo 等）
└── infra/
    ├── auth/                  # 认证接口定义
    ├── logging/               # 日志接口定义
    └── monitoring/            # 监控接口定义
```

**实施策略：**
- 当前只创建目录骨架和 CONTEXT.md
- 各子目录内容由各产品实际需要时逐步填充
- 不提前编写代码

### 6.2 shared/types/ 与 neptune-engine SDK 类型的边界

| 位置 | 存什么 | 不存什么 |
|------|--------|---------|
| `shared/types/` | 跨产品通信协议类型、事件类型、通用接口定义 | engine SDK 的内部实现类型、SDK 特有的 API 类型 |
| `neptune-engine/claude-code/src/` | SDK 的公共 API 类型（随 SDK 包导出） | 跨产品协议（应抽到 shared/types/） |

**判断标准：** 如果一个类型被两个或以上产品使用，它属于 `shared/types/`。如果只有 engine 内部使用，它留在 engine 的 src/ 中。如果它是 engine SDK 对外暴露的 API 类型，它留在 engine 的 src/ 中并通过 SDK 包导出。

---

## 7. 产品独立研发规范

### 7.1 独立性保障

| 维度 | 独立性规则 |
|------|-----------|
| 依赖管理 | 各产品有独立 `package.json`，互不耦合 |
| 构建/测试 | 各产品有独立构建和测试命令，可独立运行 |
| 版本发布 | 各产品独立版本号，独立发布节奏 |
| CI/CD | 各产品有独立 CI pipeline，只在自己的变更时触发 |
| CLAUDE.md | 各产品有独立的 AI 助手指令，开发时只看自己的 |
| CONTEXT.md | 各产品有独立的项目身份和边界定义 |

### 7.2 依赖规则

```
neptune-engine（底层 SDK，不依赖任何产品）
    ↑
    ├── neptune-ai（依赖 engine SDK）
    ├── neptune-cli（依赖 engine SDK）
    └── neptune-buddy（未来，依赖 engine SDK）

shared/（横向共享接口定义层，被所有产品和 engine 依赖，但不依赖任何一方）
```

**规则：**
1. engine 不依赖任何产品代码
2. 产品之间互不依赖
3. shared 不依赖任何产品和 engine
4. 产品可以依赖 shared 和 engine
5. engine 可以依赖 shared（使用共享接口定义）
6. 任何跨产品的需求，先考虑是否应该放到 shared 或 engine

### 7.3 现有耦合问题及解耦方案

#### 问题 1：workspace 耦合

**现状：** `neptune-engine/package.json` 的 workspaces 包含 `"neptune-ai/server"`，engine 承担了 AI 产品 server 的依赖解析。

**解耦方案：** 在 dara 根目录建立统一的 Bun workspace 配置（`workspaces` 字段），由根 `package.json` 管理所有子项目的 workspace 关系。neptune-engine 的 package.json 移除对 `neptune-ai/server` 的引用。

#### 问题 2：符号链接耦合

**现状：** `neptune-cli/node_modules` 是指向 `neptune-engine/claude-code/node_modules` 的符号链接，neptune-cli 未真正独立管理依赖。

**解耦方案：** 为 neptune-cli 补齐独立的 `package.json` dependencies，删除符号链接，让 neptune-cli 通过正常的 workspace 依赖引用 neptune-engine。

### 7.4 新增产品线流程

1. 创建目录 `{product-name}/`
2. 写 `{product-name}/CONTEXT.md`
3. 写 `{product-name}/CLAUDE.md`
4. 创建 `docs/adr/` 目录
5. 更新根 `CONTEXT-MAP.md` 添加新条目
6. 如果需要依赖 engine，在 package.json 中声明 workspace 依赖

---

## 8. 实施计划

本设计只定义规范和目标结构，不涉及业务代码改动。实施分为以下阶段，每个阶段独立提交。

### 阶段 1：创建骨架结构

**目标：** 创建所有新的目录和文件骨架，不改动任何现有文件。

具体操作：
- 创建根 `docs/adr/` 目录和 ADR 模板
- 创建根 `docs/references/` 目录
- 创建根 `docs/governance/` 目录
- 创建 `shared/` 目录骨架（CONTEXT.md + 各子目录）
- 为 neptune-engine、neptune-ai、neptune-cli 创建 `CONTEXT.md`
- 为 neptune-ai/server、neptune-ai/desktop 创建子 `CONTEXT.md`
- 创建根 `CONTEXT-MAP.md`
- 为 neptune-cli 创建 `docs/adr/` 目录

**验证：** 所有新文件和目录存在，现有代码和构建不受影响。

### 阶段 2：迁移文档

**目标：** 按映射表（4.4 节）迁移现有文档。

具体操作：
- `neptune-engine/docs_reference/` → `docs/references/`（git mv）
- `neptune-engine/optimize_research/` → `neptune-engine/research-docs/optimization/`（git mv）
- `neptune-ai/docs/specs/` → `neptune-ai/docs/design/`（git mv）
- 重组 `neptune-engine/docs/` 内部结构（创建 design/、api/ 等子目录，将现有文档归类）

**验证：** 旧路径下无残留文件，新路径下所有文件可正常访问，各 CLAUDE.md 中的文档链接更新指向正确。

### 阶段 3：重构 CLAUDE.md

**目标：** 按分层策略（5.3 节）拆分和迁移 CLAUDE.md 内容。

具体操作：
- 将根 CLAUDE.md 中的 engine 特定内容迁移到 `neptune-engine/CLAUDE.md`
- 将 "desktop 遵循 DESIGN.md" 迁移到 `neptune-ai/CLAUDE.md`
- 更新根 CLAUDE.md 中的参考文档链接
- 翻译 `neptune-engine/claude-code/CLAUDE.md` 为中文

**验证：** 根 CLAUDE.md 只包含通用规则，各产品 CLAUDE.md 包含各自专属内容，所有 CLAUDE.md 使用中文。

### 阶段 4：解耦 workspace 和依赖

**目标：** 解决 7.3 节中描述的两个耦合问题。

具体操作：
- 在 dara 根目录创建 `package.json`，配置统一 workspace
- 从 `neptune-engine/package.json` 移除对 `neptune-ai/server` 的 workspace 引用
- 为 neptune-cli 补齐独立 `package.json` dependencies
- 删除 `neptune-cli/node_modules` 符号链接
- 让 neptune-cli 通过 workspace 依赖引用 neptune-engine

**验证：**
- `cd neptune-engine/claude-code && bun install && bun test` 通过
- `cd neptune-ai/server && bun install && bun run dev` 正常启动
- `cd neptune-cli && bun install && bun run dev` 正常启动

### 阶段 5：清理

**目标：** 删除迁移后的空目录和冗余文件。

具体操作：
- 删除迁移后变空的旧目录
- 更新 `.gitignore` 确保新结构正确忽略
- 检查所有内部链接（CLAUDE.md、CONTEXT.md 中的相对路径引用）指向正确

**验证：** `git status` 显示干净，无孤立文件，所有链接可访问。
