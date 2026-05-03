# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指导。

## 项目概述

这是一个 **逆向工程 / 反编译** 版本的 Anthropic 官方 Claude Code CLI 工具。目标是恢复核心功能，同时裁剪次要能力。许多模块已被 stub 或通过 feature flag 关闭。强制使用 TypeScript strict 模式 —— **`bunx tsc --noEmit` 必须零错误通过**。

## Git 提交信息规范

使用 **Conventional Commits** 规范：

```
<type>: <描述>
```

常见 type：`feat`、`fix`、`docs`、`chore`、`refactor`

示例：
- `feat: 添加模型 1M 上下文切换`
- `fix: 修复初次登陆的校验问题`
- `chore: remove prefetchOfficialMcpUrls call on startup`

## 命令

```bash
# Install dependencies
bun install

# Dev mode (runs cli.tsx with MACRO defines injected via -d flags)
bun run dev

# Dev mode with debugger (set BUN_INSPECT=9229 to pick port)
bun run dev:inspect

# Pipe mode
echo "say hello" | bun run src/entrypoints/cli.tsx -p

# Build (code splitting, outputs dist/cli.js + chunk files)
bun run build

# Test
bun test                  # run all tests (2453 tests / 137 files / 0 fail)
bun test src/utils/__tests__/hash.test.ts   # run single file
bun test --coverage       # with coverage report

# Lint & Format (Biome)
bun run lint              # check only
bun run lint:fix          # auto-fix
bun run format            # format all src/

# Health check
bun run health

# Check unused exports
bun run check:unused

bun run typecheck

# Remote Control Server
bun run rcs

# Docs dev server (Mintlify)
bun run docs:dev
```

详细的测试规范、覆盖状态和改进计划见 `docs/testing-spec.md`。

## 架构

### 运行时与构建

- **Runtime**: Bun（非 Node.js）。所有导入、构建和执行均使用 Bun API。
- **Build**: `build.ts` 执行 `Bun.build()` with `splitting: true`，入口 `src/entrypoints/cli.tsx`，输出 `dist/cli.js` + chunk files。Build 默认启用 19 个 feature（见下方 Feature Flag 段）。构建后自动替换 `import.meta.require` 为 Node.js 兼容版本（产物 bun/node 都可运行）。
- **Dev mode**: `scripts/dev.ts` 通过 Bun `-d` flag 注入 `MACRO.*` defines，运行 `src/entrypoints/cli.tsx`。默认启用全部 feature。
- **Module system**: ESM (`"type": "module"`), TSX with `react-jsx` transform.
- **Monorepo**: Bun workspaces — 14 个 internal packages in `packages/` resolved via `workspace:*`。
- **Lint/Format**: Biome (`biome.json`)。`bun run lint` / `bun run lint:fix` / `bun run format`。
- **Defines**: 集中管理在 `scripts/defines.ts`。当前版本 `2.1.888`。
- **CI**: GitHub Actions — `ci.yml`（构建+测试）、`release-rcs.yml`（RCS 发布）、`update-contributors.yml`（自动更新贡献者）。

### 入口与启动

1. **`src/entrypoints/cli.tsx`** (323 行) — 真正的入口点。`main()` 函数按优先级处理多条快速路径：
   - `--version` / `-v` — 零模块加载
   - `--dump-system-prompt` — feature-gated (DUMP_SYSTEM_PROMPT)
   - `--claude-in-chrome-mcp` / `--chrome-native-host`
   - `--computer-use-mcp` — 独立 MCP server 模式
   - `--daemon-worker=<kind>` — feature-gated (DAEMON)
   - `remote-control` / `rc` / `remote` / `sync` / `bridge` — feature-gated (BRIDGE_MODE)
   - `daemon` [subcommand] — feature-gated (DAEMON)
   - `ps` / `logs` / `attach` / `kill` / `--bg` — feature-gated (BG_SESSIONS)
   - `new` / `list` / `reply` — Template job commands
   - `environment-runner` / `self-hosted-runner` — BYOC runner
   - `--tmux` + `--worktree` 组合
   - 默认路径：加载 `main.tsx` 启动完整 CLI
2. **`src/main.tsx`** (~6970 行) — Commander.js CLI definition。注册大量 subcommands：`mcp` (serve/add/remove/list...)、`server`、`ssh`、`open`、`auth`、`plugin`、`agents`、`auto-mode`、`doctor`、`update` 等。主 `.action()` 处理器负责权限、MCP、会话恢复、REPL/Headless 模式分发。
3. **`src/entrypoints/init.ts`** — 一次性初始化（telemetry、config、trust dialog）。

### 核心循环

- **`src/query.ts`** — 主 API 查询函数。发送消息到 Claude API，处理流式响应，执行工具调用，管理对话轮次循环。
- **`src/QueryEngine.ts`** — 更高层的编排器，包裹 `query()`。管理对话状态、压缩、文件历史快照、归因和轮次级别的记账。供 REPL screen 使用。
- **`src/screens/REPL.tsx`** — 交互式 REPL screen（React/Ink component）。处理用户输入、消息展示、工具权限提示和键盘快捷键。

### API 层

- **`src/services/api/claude.ts`** — 核心 API client。构建请求参数（system prompt、messages、tools、betas），调用 Anthropic SDK streaming endpoint，处理 `BetaRawMessageStreamEvent` 事件。
- **7 providers**: `firstParty` (Anthropic direct)、`bedrock` (AWS)、`vertex` (Google Cloud)、`foundry`、`openai`、`gemini`、`grok` (xAI)。
- Provider 选择逻辑在 `src/utils/model/providers.ts`。优先级：modelType 参数 > 环境变量 > 默认 firstParty。

### 工具系统

- **`src/Tool.ts`** — 工具接口定义（`Tool` type）和工具函数（`findToolByName`、`toolMatchesName`）。
- **`src/tools.ts`** (387 行) — 工具注册表。组装工具列表；部分工具通过 `feature()` flags 或 `process.env.USER_TYPE` 条件加载。
- **`src/tools/<ToolName>/`** — 55 个工具目录。主要分类：
  - **文件操作**: FileEditTool, FileReadTool, FileWriteTool, GlobTool, GrepTool
  - **Shell/执行**: BashTool, PowerShellTool, REPLTool
  - **Agent 系统**: AgentTool, TaskCreateTool, TaskUpdateTool, TaskListTool, TaskGetTool
  - **规划**: EnterPlanModeTool, ExitPlanModeV2Tool, VerifyPlanExecutionTool
  - **Web/MCP**: WebFetchTool, WebSearchTool, MCPTool, McpAuthTool
  - **调度**: CronCreateTool, CronDeleteTool, CronListTool
  - **其他**: LSPTool, ConfigTool, SkillTool, EnterWorktreeTool, ExitWorktreeTool 等
- **`src/tools/shared/`** — 工具共享工具函数。

### UI 层 (Ink)

- **`src/ink.ts`** — Ink 渲染包装器，注入 ThemeProvider。
- **`packages/@ant/ink/`** — 自定义 Ink 框架（forked/internal），包含 components、core、hooks、keybindings、theme、utils。注意：不是 `src/ink/`。
- **`src/components/`** — 149 个组件目录/文件，渲染于终端 Ink 环境中。关键组件：
  - `App.tsx` — Root provider (AppState, Stats, FpsMetrics)
  - `Messages.tsx` / `MessageRow.tsx` — 对话消息渲染
  - `PromptInput/` — 用户输入处理
  - `permissions/` — 工具权限审批 UI
  - `design-system/` — 复用 UI 组件（Dialog, FuzzyPicker, ProgressBar, ThemeProvider 等）
- 组件使用 React Compiler runtime (`react/compiler-runtime`) —— 反编译产物中遍布 `_c()` memoization 调用。

### 状态管理

- **`src/state/AppState.tsx`** — 中央应用状态类型和 context provider。包含消息、工具、权限、MCP 连接等。
- **`src/state/AppStateStore.ts`** — 默认状态和 store 工厂。
- **`src/state/store.ts`** — Zustand 风格的 AppState store (`createStore`)。
- **`src/state/selectors.ts`** — 状态选择器。
- **`src/bootstrap/state.ts`** — 模块级单例，用于会话全局状态（session ID、CWD、project root、token counts、model overrides、client type、permission mode）。

### Workspace 包

| Package | 说明 |
|---------|------|
| `packages/@ant/ink/` | Forked Ink 框架（components、hooks、keybindings、theme） |
| `packages/@ant/computer-use-mcp/` | Computer Use MCP server（截图/键鼠/剪贴板/应用管理） |
| `packages/@ant/computer-use-input/` | 键鼠模拟（dispatcher + darwin/win32/linux backend） |
| `packages/@ant/computer-use-swift/` | 截图 + 应用管理（dispatcher + per-platform backend） |
| `packages/@ant/claude-for-chrome-mcp/` | Chrome 浏览器控制（通过 `--chrome` 启用） |
| `packages/remote-control-server/` | 自托管 Remote Control Server（Docker 部署，含 Web UI） |
| `packages/swarm/` | Swarm 解耦模块 |
| `packages/shell/` | Shell 抽象 |
| `packages/audio-capture-napi/` | 原生音频捕获（已恢复） |
| `packages/color-diff-napi/` | 颜色差异计算（完整实现，11 tests） |
| `packages/image-processor-napi/` | 图像处理（已恢复） |
| `packages/modifiers-napi/` | 键盘修饰键检测（stub） |
| `packages/url-handler-napi/` | URL scheme 处理（stub） |

### Bridge / 远程控制

- **`src/bridge/`** (~37 files) — Remote Control / Bridge 模式。feature-gated by `BRIDGE_MODE`。包含 bridge API、会话管理、JWT 认证、消息传输、权限回调等。入口：`bridgeMain.ts`。
- **`packages/remote-control-server/`** — 自托管 RCS，支持 Docker 部署，含 Web UI 控制面板。通过 `bun run rcs` 启动。
- CLI 快速路径: `claude remote-control` / `claude rc` / `claude bridge`。
- 详见 `docs/features/remote-control-self-hosting.md`。

### Daemon 模式

- **`src/daemon/`** — Daemon 模式（长驻 supervisor）。feature-gated by `DAEMON`。包含 `main.ts`（入口）和 `workerRegistry.ts`（worker 管理）。

### 上下文与系统提示

- **`src/context.ts`** — 构建 API 调用的 system/user 上下文（git status、date、CLAUDE.md contents、memory files）。
- **`src/utils/claudemd.ts`** — 从项目层级目录中发现并加载 CLAUDE.md 文件。

### Feature Flag 系统

Feature flags 控制运行时启用哪些功能。代码中统一通过 `import { feature } from 'bun:bundle'` 导入，调用 `feature('FLAG_NAME')` 返回 `boolean`。

**启用方式**: 环境变量 `FEATURE_<FLAG_NAME>=1`。例如 `FEATURE_BUDDY=1 bun run dev`。

**Build 默认 features**（19 个，见 `build.ts`）:
- 基础: `BUDDY`, `TRANSCRIPT_CLASSIFIER`, `BRIDGE_MODE`, `AGENT_TRIGGERS_REMOTE`, `CHICAGO_MCP`, `VOICE_MODE`
- 统计/缓存: `SHOT_STATS`, `PROMPT_CACHE_BREAK_DETECTION`, `TOKEN_BUDGET`
- P0 本地: `AGENT_TRIGGERS`, `ULTRATHINK`, `BUILTIN_EXPLORE_PLAN_AGENTS`, `LODESTONE`
- P1 API 依赖: `EXTRACT_MEMORIES`, `VERIFICATION_AGENT`, `KAIROS_BRIEF`, `AWAY_SUMMARY`, `ULTRAPLAN`
- P2: `DAEMON`

**Dev mode 默认**: 全部启用（见 `scripts/dev.ts`）。

**类型声明**: `src/types/internal-modules.d.ts` 中声明了 `bun:bundle` 模块的 `feature` 函数签名。

**新增功能的正确做法**: 保留 `import { feature } from 'bun:bundle'` + `feature('FLAG_NAME')` 的标准模式，在运行时通过环境变量或配置控制，不要绕过 feature flag 直接 import。

### Multi-API 兼容层

所有兼容层均采用流适配器模式：将第三方 API 格式转为 Anthropic 内部格式，下游代码完全不改。

#### OpenAI 兼容层

通过 `CLAUDE_CODE_USE_OPENAI=1` 启用，支持 Ollama/DeepSeek/vLLM 等任意 OpenAI Chat Completions 协议端点。含 DeepSeek thinking mode 支持。

- **`src/services/api/openai/`** — client、消息/工具转换、流适配、模型映射
- 关键环境变量：`CLAUDE_CODE_USE_OPENAI`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`

#### Gemini 兼容层

通过 `CLAUDE_CODE_USE_GEMINI=1` 启用。独立环境变量体系。

- **`src/services/api/gemini/`** — client、模型映射、类型定义
- 关键环境变量：`GEMINI_API_KEY`（必填）、`GEMINI_MODEL`（直接指定）、`GEMINI_DEFAULT_SONNET_MODEL`/`GEMINI_DEFAULT_OPUS_MODEL`（按能力映射）
- 模型映射优先级：`GEMINI_MODEL` > `GEMINI_DEFAULT_*_MODEL` > `ANTHROPIC_DEFAULT_*_MODEL`(已废弃) > 原样返回

#### Grok 兼容层

通过 `CLAUDE_CODE_USE_GROK=1` 启用。自定义模型映射支持 xAI Grok API。

- **`src/services/api/grok/`** — client、模型映射

详见各兼容层的 docs 文档。

### 已 Stub / 已删除的模块

| Module | 状态 |
|--------|------|
| Computer Use (`@ant/*`) | 已恢复 — macOS + Windows + Linux（后端完整度不一） |
| `*-napi` packages | `audio-capture-napi`、`image-processor-napi` 已恢复；`color-diff-napi` 完整；`modifiers-napi`、`url-handler-napi` 仍为 stub |
| Voice Mode | 已恢复 — Push-to-Talk 语音输入（需 Anthropic OAuth） |
| OpenAI/Gemini/Grok 兼容层 | 已恢复 |
| Remote Control Server | 已恢复 — 自托管 RCS + Web UI |
| Analytics / GrowthBook / Sentry | 空实现 |
| Magic Docs / LSP Server | 已删除 |
| Plugins / Marketplace | 已删除 |
| MCP OAuth | 已简化 |

### 关键类型文件

- **`src/types/global.d.ts`** — 声明 `MACRO`、`BUILD_TARGET`、`BUILD_ENV` 以及 Anthropic 内部标识符。
- **`src/types/internal-modules.d.ts`** — `bun:bundle`、`bun:ffi`、`@anthropic-ai/mcpb` 的类型声明。
- **`src/types/message.ts`** — 消息类型层级（UserMessage、AssistantMessage、SystemMessage 等）。
- **`src/types/permissions.ts`** — 权限模式和结果类型。

## 测试

- **框架**: `bun:test`（内置断言 + mock）
- **当前状态**: 2472 tests / 138 files / 0 fail
- **单元测试**: 就近放置于 `src/**/__tests__/`，文件名 `<module>.test.ts`
- **集成测试**: `tests/integration/` — 4 个文件（cli-arguments, context-build, message-pipeline, tool-chain）
- **共享 mock/fixture**: `tests/mocks/`（api-responses, file-system, fixtures/）
- **命名**: `describe("functionName")` + `test("behavior description")`，英文
- **Mock 模式**: 对重依赖模块使用 `mock.module()` + `await import()` 解锁（必须内联在测试文件中，不能从共享 helper 导入）
- **包测试**: `packages/` 下各包也有独立测试（如 `color-diff-napi` 11 tests）

### 类型检查

项目使用 TypeScript strict 模式，**tsc 必须零错误**。每次修改后运行：

```bash
bunx tsc --noEmit
```

**类型规范**：
- 生产代码禁止 `as any`；测试文件中 mock 数据可用 `as any`
- 类型不匹配优先用 `as unknown as SpecificType` 双重断言，或补充 interface
- 未知结构对象用 `Record<string, unknown>` 替代 `any`
- 联合类型用类型守卫（type guard）收窄，不要强转
- `msg.request` 属性访问：`const req = msg.request as Record<string, unknown>`
- Ink `color` prop：用 `as keyof Theme` 而非 `as any`

## 在此代码库中工作

- **tsc 必须通过** — `bunx tsc --noEmit` 必须零错误，任何修改都不能引入新的类型错误。
- **Feature flags** — 默认全部关闭（`feature()` 返回 `false`）。Dev/build 各有自己的默认启用列表。不要在 `cli.tsx` 中重定义 `feature` 函数。
- **React Compiler 输出** — 组件中包含反编译的 memoization 样板代码（`const $ = _c(N)`）。这是正常的。
- **`bun:bundle` import** — `import { feature } from 'bun:bundle'` 是 Bun 内置模块，由运行时/构建器解析。不要用自定义函数替代它。**`feature()` 只能直接用在 `if` 语句或三元表达式的条件位置**（Bun 编译器限制），不能赋值给变量、不能放在箭头函数体里、不能作为 `&&` 链的一部分。正确：`if (feature('X')) {}` 或 `feature('X') ? a : b`。
- **`src/` path alias** — tsconfig maps `src/*` to `./src/*`。类似 `import { ... } from 'src/utils/...'` 的导入是合法的。
- **MACRO defines** — 集中管理在 `scripts/defines.ts`。Dev mode 通过 `bun -d` 注入，build 通过 `Bun.build({ define })` 注入。修改版本号等常量只改这个文件。
- **构建产物兼容 Node.js** — `build.ts` 会自动后处理 `import.meta.require`，产物可直接用 `node dist/cli.js` 运行。
- **Biome 配置** — 大量 lint 规则被关闭（反编译代码不适合严格 lint）。`.tsx` 文件用 120 行宽 + 强制分号；其他文件 80 行宽 + 按需分号。
- **Ink 框架在 `packages/@ant/ink/`** — 不是 `src/ink/`（该目录不存在）。Ink 相关的组件、hooks、keybindings 都在 packages 中。
- **Provider 优先级** — `modelType` 参数 > 环境变量 > 默认 `firstParty`。新增 provider 需在 `src/utils/model/providers.ts` 注册。
