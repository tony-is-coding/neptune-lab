# Neptune Engine Harness 内核剥离设计

日期：2026-05-21
关联前序设计：[`neptune-ai/docs/superpowers/specs/2026-05-20-layered-architecture-optimization-design.md`](../../../neptune-ai/docs/superpowers/specs/2026-05-20-layered-architecture-optimization-design.md)
本轮交付：**仅设计文档**。代码迁移作为下一阶段独立项目走 writing-plans。

---

## 1. 第一性原则

### 1.1 目标

把 `neptune-engine/` 里**和 agent runtime 内核无关的产品级能力**剥离到新仓 `neptune-engine-product/`，让 `neptune-engine` 收敛为 **轻量但完备的 agent harness**——能力导向，不是产品导向。

Neptune Engine 的使命是一个**轻量级执行引擎**。Claude Code 是大而全的产品，Neptune Engine 关注的是 agent runtime 必须的能力，而不是产品特性。

### 1.2 第一性问题：什么叫 "agent harness 内核"？

不是空骨架（仅 LLM 调用循环），也不是大而全产品。harness 内核 = **运行一个 agent 必须的若干类能力 + 它们的接口和最小默认实现**：tool / skill / memory / 上下文 / 提示词 / 安全 / mcp / sandbox / provider / 可扩展性。

### 1.3 判定标准（两层）

#### Layer 1 · 最低门槛（K）
> **一个文件属于 K ⇔ 在没有任何 UI、没有 Anthropic 账号体系、没有 Neptune 产品后台、没有 telemetry 上报的环境下，agent 仍然能正确完成"一次端到端 query 含工具调用"。**

这条标准定义了"运行 agent 的最小可执行集"：Provider 调用 + Tool 执行 + 单轮上下文。

#### Layer 2 · harness 必备形态（K-DEFAULT）
仅 Layer 1 的能力还不足以构成"完备的 harness"。一个生产可用的 agent harness 还必须支持以下"必备形态"，每条形态对应若干 K-DEFAULT 文件：

| 必备形态 | 为什么是必备 | 对应 K-DEFAULT |
|---|---|---|
| **多轮长会话** | agent 必须能跨 turn 累积上下文，而非单次 one-shot | SessionMemory、sessionTranscript、SessionContext (ALS) |
| **上下文压缩** | LLM 上下文窗口有限，超长会话必须可压缩 | compact、ContextCollapse、TokenBudget |
| **Skill 装载** | agent 行为定义来自 skill，必须能动态装载 | skills/loadSkillsDir、mcpSkillBuilders、SkillExtension |
| **MCP 接入** | 现代 agent 必须能接入 MCP server 扩展工具与资源 | services/mcp 核心、mcp-client 包 |
| **多 agent 协作** | sub-agent / swarm 是 agent harness 的标配能力 | tasks/LocalAgentTask、utils/swarm/{spawnInProcess, teammateInit} |
| **Memory 检索** | agent 必须能从历史记忆中检索相关信息 | memdir、findRelevantMemories、extractMemories |
| **Permission 决策** | 任何工具调用都要经过权限判定，不可绕过 | PermissionDelegate 接口 + ReadOnly/RBAC/Audit/Tenant 默认 |
| **Sandbox 隔离** | bash/file 工具的执行边界 | sandbox 接口、sandboxTypes |

**判定流程**：
1. 文件能让 agent 跑 Layer 1？→ K
2. 不能跑 Layer 1，但是某个"必备形态"的实现？→ K-DEFAULT
3. 即不属于 1 也不属于 2？→ P

凡是失去它 agent 还能跑完一次完整对话+工具调用，**且不属于任何"必备形态"**的，都是产品。

### 1.4 与前序设计的关系

[2026-05-20 分层优化设计] 完成了 Server 与 Engine 交界处的第一阶段：headless runtime + TenantPermissionDelegate。这给本轮做了铺垫——证明了 engine 内是可以做出"无头执行路径"的。

本轮把这条线推到下一站：不仅服务端运行时不依赖 UI，**整个 engine 仓本身就不再承载产品特性**。

### 1.5 本轮交付边界

* **In scope**：spec 文档（本文件）。包括能力域定义、模块分类、物理形态、迁移路径、包命名整改、后续阶段规划。
* **Out of scope**：任何代码动作（git mv、文件改写、import 修复、改名）。这些归属下一个 writing-plans 项目。

---

## 2. 能力域定义（10 大）

| 能力域 | 内核必备 | 不属于内核（产品） |
|---|---|---|
| **Agent Loop** | submitMessage / 多轮 / 工具调用回环 / 取消 / 错误传播 | CLI 渲染、Ink 状态、coordinator 模式、proactive、autoDream |
| **Tool 系统** | Tool 接口、ToolRegistry、ToolExtension、Read/Edit/Bash/Grep/Glob/Task 等基础工具 | Tool UI 渲染、工具使用提示、PromptSuggestion、speculation、CLI 补全 |
| **Permission** | PermissionDelegate 接口、ReadOnly/RBAC/Audit/Tenant 默认实现、文件路径 normalize、bashClassifier、yoloClassifier | OAuth 登录态判断、Claude AI 订阅判断、企业 mdm 策略、远程托管设置、permissionLogging 上报 |
| **Context** | SessionContext (ALS)、TokenBudget、Compact 算法接口与默认实现、ContextCollapse、Token 估算 | telemetry 化的 compact 上报、autoDream consolidation |
| **Memory** | SessionMemory 接口、Memdir 检索 + memoryAge、memory schemas、ExtractMemories 算法 | teamMemorySync（团队跨设备同步）、memoryShapeTelemetry、langfuse 导出、远端记忆 marketplace |
| **MCP** | MCP client（@neptune/mcp-client）、MCP 工具发现/执行、MCP server 配置类型、本地/远程 server 连接管理 | MCPConnectionManager UI 弹窗、MCP marketplace、MCP install/discover 产品流、Chrome / computer-use 等捆绑 server（应作为可选 product 包） |
| **Skill / Prompt** | SkillExtension 接口、SkillLoader、本地 skill 加载、prompt 拼接、systemPrompt 管理 | 远程 skill marketplace、skillUsageTracking、PromptSuggestion、tips、bundledSkills 中产品化的部分 |
| **Provider** | ProviderAdapter 接口、Anthropic/OpenAI/Gemini/Grok/Bedrock/Vertex/Foundry 默认实现、CircuitBreaker、provider routing | Anthropic 账号 OAuth、policyLimits、referral、overageCreditGrant、ultrareviewQuota、grove、Claude AI subscriber 判断 |
| **Sandbox** | Sandbox 执行接口（隔离 bash/file 执行边界）、@anthropic-ai/sandbox-runtime 适配层 | 具体 sandbox 实现产品包（remote sandbox provider、teleport 远程环境）、sandbox 配额/计费、sandbox UI 状态 |
| **可扩展性** | EventBus、Hook 接口、Storage 接口、Observability 接口（NoOp 默认） | 自家 Langfuse 集成实现、自家 telemetry/bigqueryExporter、Sentry 集成、betaSessionTracing、tracing event mapper |

---

## 3. 分层架构 · 4 类标签

按"内核 / 产品 / 模糊 / CC fork 内部"分类。本轮 spec 不实际拆分 B 类文件，但要明确每个 B 类文件最终归属。

### 3.1 K（Kernel-Interface）

接口与极小工具，留 engine：

* `src/ToolRegistry.ts`、`src/schemas/`、`src/shared/SessionContextBridge.ts`
* `packages/agent-tools`、`packages/protocol`
* `src/utils/{model/, permissions/, memory/, git/, bash/, tokens.ts, thinking.ts, tokenBudget.ts, sessionStorage.ts, errors.ts, log.ts, json.ts, hash.ts, sleep.ts, uuid.ts, array.ts, set.ts, string*}` 等纯函数

### 3.2 K-DEFAULT（Kernel 默认实现）

内核需要的最小默认实现，留 engine：

* `src/engine/`（现 SDK 包装层全部，含 cc-runtime/HeadlessQueryEngine/HeadlessToolRegistry）
* **类型基石（带债务暂留）**：`src/Tool.ts`、`src/Task.ts`、`src/tasks.ts` —— 这些是 B 类（含产品耦合），但被 `src/engine/` 11 处直接依赖；本轮整体留 engine 作为 "K-DEFAULT 含债务"，阶段二拆净化版替代
* `packages/builtin-tools`、`packages/mcp-client`
* `src/services/api/` 留 engine 清单（**LLM 调用核心**）：
  * **Provider 适配器**：`client.ts`、`claude.ts`、`openai/`、`gemini/`、`grok/`（Provider 能力域 8 大默认实现之一）
  * **基础设施**：`withRetry.ts`、`errors.ts`、`errorUtils.ts`、`logging.ts`、`emptyUsage.ts`、`dumpPrompts.ts`、`filesApi.ts`（Files API harness 必备）、`types.ts`
* `src/services/mcp/{types 与 核心 client，不含 MCPConnectionManager.tsx}`、`src/services/{plugins/, extractMemories/, sessionTranscript/}`
* `src/services/SessionMemory/` 整体（含债务暂留，阶段二拆净化）
* `src/services/compact/` 整体（含债务暂留，阶段二拆净化）
* `src/tasks/{LocalAgentTask, LocalShellTask}`
* `src/memdir/{memdir, findRelevantMemories, memoryAge, memoryScan, paths.ts, memoryTypes.ts}`
* `src/skills/{loadSkillsDir, mcpSkillBuilders, mcpSkills}`
* `src/utils/swarm/{spawnInProcess, teammateInit}`
* `src/utils/settings/{settings.ts, settingsCache.ts, applySettingsChange.ts}`
* `src/entrypoints/sdk/{coreTypes, controlTypes, runtimeTypes}`、`src/entrypoints/agentSdkTypes.ts`、`src/entrypoints/sandboxTypes.ts`

> **K-DEFAULT 含债务**：上述加粗项与 SessionMemory/compact 是 B 类有产品耦合，但被 engine 公共 SDK 直接依赖，整体迁 product 会立即破编译。本轮接受 "engine 内含暂时债务" 这个事实，把净化拆分推到阶段二。这条政策遵循 "engine 仓必须始终可编译" 这条更高优先级原则。

### 3.3 B（Boundary-Blur）

接口/类型属于 K，实现/产品耦合属于 P。**本轮 spec 标记，不在本轮拆分**。下一阶段（writing-plans 项目）由专人拆分。

> 注：`Tool.ts`、`Task.ts`、`tasks.ts`、`SessionMemory`、`compact` 也是 B 类，但被 `src/engine/` 公共 SDK 直接依赖；按 3.2 政策"K-DEFAULT 含债务"留 engine 整体保留，阶段二拆净化。下表只列**不被 engine 直接依赖、可以整体迁 product 而不破编译**的 B 类文件。

| 文件 | 当前问题 | 最终归属 | 本轮迁移如何处置 |
|---|---|---|---|
| `commands.ts` | skill/plugin 加载（K）+ auth/订阅判断（P） | 算法 → engine；订阅判断 → product | 整体迁 product |
| `services/tools/{toolExecution, toolOrchestration, toolHooks}` | 工具执行核心 K-DEFAULT，但 toolExecution.ts 调用 getAppState() | 净化后 → engine/kernel/tool；当前实现 → product | 整体迁 product |
| `services/AgentSummary` | agent 摘要能力 K，但耦合具体 Task 类型 | 接口 → engine；实现 → product | 整体迁 product |
| `state/SessionContextBridge.ts` | ALS bridge K | engine | **留 engine**，独立挑出来 |
| `memdir/team*` | 团队记忆同步 P | product | 整体跟 services/teamMemorySync 走 product |
| `skills/bundled*` | bundled skills 中部分是 K，部分是 P | 拆分后续 | 整体迁 product |
| `plugins/` | builtinPlugins K，bundled/ 中含 P | 拆分后续 | 整体迁 product |
| `services/skillSearch/` | localSearch.ts 是 K-DEFAULT；其余是 P（marketplace）| localSearch → engine 后续；其余 → product | 整体迁 product，阶段二补回 localSearch |
| `services/api/`（产品支线） | bootstrap.ts（OAuth 初始化）、usage.ts（账号配额）、metricsOptOut.ts、promptCacheBreakDetection.ts、sessionIngress.ts、referral.ts、overageCreditGrant.ts、ultrareviewQuota.ts、adminRequests.ts、grove.ts、firstTokenDate.ts | product | 整体迁 product；3.2 已列出 api/ 中保留的核心文件清单；`services/api/src/` 是构建产物目录，不需归位 |

### 3.4 CC-FORK（不动整体迁 product/cc-runtime）

从 Claude Code 直接 fork、深度内部依赖、本轮不重写：

* `src/QueryEngine.ts`、`src/query.ts`、`src/query/`、`src/Tool.ts`、`src/ToolRegistry.ts` 实现部分
* `src/tools.ts`、`src/context.ts`、`src/cost-tracker.ts`、`src/history.ts`
* `src/bootstrap/{state.ts, bridgeConfig.ts}`
* `src/services/{toolUseSummary, analytics}`
* `src/utils/{config.ts, debug.ts}`
* `src/constants/{querySource, spinnerVerbs, turnCompletionVerbs}`
* `src/query/transitions.ts`

### 3.5 P（产品特性，全部迁 product）

* CLI 形态：`src/ui/`、`src/state/AppStateStore.ts` 等 React 状态、`src/coordinator/`、`src/assistant/`、`src/proactive/`、`src/outputStyles/`
* 产品 services：`src/services/{langfuse, autoDream, oauth, tips, PromptSuggestion, MagicDocs, teamMemorySync, policyLimits, remoteManagedSettings, settingsSync, lsp}`
* 产品 utils：`src/utils/{auth.ts, autoUpdater.ts, ide.ts, sentry.ts, telemetry/, suggestions/, ultraplan/, dxt/, teleport/, settings/{settingsSync, mdm/, pluginOnlyPolicy.ts}}`
* 产品 tasks：`src/tasks/{DreamTask, InProcessTeammateTask, LocalMainSessionTask, RemoteAgentTask, LocalWorkflowTask, MonitorMcpTask}`
* 产品 packages：`packages/remote-control-server`、`packages/@ant/{ink, computer-use-input, computer-use-mcp, computer-use-swift, claude-for-chrome-mcp}`、所有 `packages/*-napi`

---

## 4. 物理形态与迁移路径（方案 A · 重命名）

### 4.1 决策：方案 A

3 个候选方案：
* **A. 重命名（采用）** — 现 `neptune-engine/` 整体改名 `neptune-engine-product/`；新建空 `neptune-engine/`，从 product 仓挑出 K + K-DEFAULT 文件回去
* **B. 平移** — 在现 engine 仓内部挑出产品代码迁出
* **C. 双轨** — 保留 engine 仓 src/engine/ 出口不变，其余迁 product

**采用 A 的理由**：
1. 包名要从 `claude-code-best` 改为 `@neptune/engine`、neptune-ai 那边的 import 反正都要改 → 方案 C "对外 import 零修改" 的优势消失
2. 方案 A 承认 "现状 95% 是产品代码" 这个事实，新仓从空开始挑文件回去，比"在巨仓里找 5% 留下"更诚实、边界更硬
3. Git 历史保留在 product 仓（占 95% 内容），新 engine 仓 `git mv` 文件保留 history

**已接受的代价**：新 engine 仓在迁移中途存在 broken state 期（半天到几天不可编译），用户已确认可接受。

### 4.2 仓库物理形态

```
neptune-lab/
├── neptune-engine/              ← 轻量 agent harness 内核（新, 从 product 仓挑回）
│   ├── src/
│   │   ├── kernel/              ← (后续阶段) harness 内核接口分组
│   │   │   ├── agent/           ← AgentLoop 接口
│   │   │   ├── tool/            ← Tool/ToolRegistry/ToolExtension 接口
│   │   │   ├── permission/      ← PermissionDelegate 接口 + 4 默认实现
│   │   │   ├── context/         ← SessionContext + TokenBudget + Compact 接口
│   │   │   ├── memory/          ← Memory 接口
│   │   │   ├── mcp/             ← MCP 接口
│   │   │   ├── skill/           ← SkillExtension + SkillLoader
│   │   │   ├── provider/        ← ProviderAdapter + 7 LLM 适配
│   │   │   ├── sandbox/         ← Sandbox 接口
│   │   │   ├── storage/         ← Storage 接口 + InMemory/SQLite 默认
│   │   │   ├── events/          ← EventBus
│   │   │   ├── hooks/           ← Hook 核心
│   │   │   ├── observability/   ← NoOp 默认 + 接口
│   │   │   └── log/             ← 日志接口 + 默认
│   │   ├── engine/              ← 现 src/engine/, 28k 行 SDK 包装层（保留出口形态）
│   │   ├── shared/              ← SessionContextBridge ALS
│   │   ├── schemas/             ← Zod schemas
│   │   ├── utils/               ← K 类纯函数子集（model/permissions/memory/git/bash/tokens/...）
│   │   └── entrypoints/sdk/     ← SDK 公共类型
│   ├── packages/
│   │   ├── agent-tools/
│   │   ├── builtin-tools/
│   │   ├── mcp-client/
│   │   └── protocol/
│   └── package.json             ← name: @neptune/engine
│
├── neptune-engine-product/      ← (现 neptune-engine 整体改名)
│   ├── src/
│   │   ├── cc-runtime/          ← Tool.ts + ToolRegistry + Task.ts + QueryEngine + query/ + tools.ts + context.ts + history.ts + cost-tracker.ts + commands.ts + tasks.ts + bootstrap/
│   │   ├── cli/                 ← ui/ + state/ + coordinator/ + assistant/ + proactive/ + outputStyles/
│   │   ├── services/            ← langfuse/ + autoDream/ + oauth/ + tips/ + PromptSuggestion/ + MagicDocs/ + teamMemorySync/ + policyLimits/ + remoteManagedSettings/ + settingsSync/ + lsp/ + skillSearch/ remote 部分 + telemetry/
│   │   ├── tasks/               ← DreamTask + InProcessTeammateTask + LocalMainSessionTask + RemoteAgentTask + LocalWorkflowTask + MonitorMcpTask
│   │   ├── memdir/team*         ← 团队记忆同步部分
│   │   └── entrypoints/         ← CLI/desktop/remote 入口
│   ├── packages/
│   │   ├── remote-control-server/
│   │   ├── @ant/                ← ink、computer-use-*、claude-for-chrome
│   │   └── *-napi/              ← audio-capture, color-diff, image-processor, modifiers, url-handler
│   └── package.json             ← name: @neptune/engine-product
│
├── neptune-ai/                  ← 既有，import path 切到 @neptune/engine
└── shared/                      ← 既有
```

依赖方向（**反向引用 = 编译失败**）：

```
neptune-ai ──────────→ @neptune/engine          (主 SDK)
neptune-ai ──────────→ @neptune/engine-product  (CLI/CC fork 运行时, 可选)
@neptune/engine-product ─→ @neptune/engine
@neptune/engine ──╳──→ @neptune/engine-product  (禁止)
```

防呆机制（具体可执行）：

1. **包依赖隔离**（首要防线）：`neptune-engine/package.json` 的 `dependencies` / `peerDependencies` / `devDependencies` 三段都不允许声明 `@neptune/engine-product*`。Node/Bun 解析未声明依赖会直接 `ERR_MODULE_NOT_FOUND`。这是最硬的防线，远比 tsconfig paths 可靠（后者无法阻止 node_modules 解析）。

2. **ESLint `no-restricted-imports`**（CI 防线）：先在 neptune-engine 仓引入 ESLint（当前仓未启用，仅有 `scripts/lint-layers.sh` 的 bash grep 实现），配置示例：
   ```js
   {
     files: ['src/**/*.ts', 'src/**/*.tsx'],
     rules: {
       'no-restricted-imports': ['error', {
         patterns: [{
           group: ['@neptune/engine-product', '@neptune/engine-product/*'],
           message: 'engine 不可反向依赖 product。引导接口下放，不要在 engine 引用 product 实现。'
         }]
       }]
     }
   }
   ```

3. **CI 强制**：`.github/workflows/ci.yml`（或对应 CI 文件）在 neptune-engine 仓的 lint job 必须跑这条 rule。`scripts/lint-layers.sh` 同步扩展，作为 CI 兜底。

4. **`bun.lock` 校验**：CI 中 `bun install --frozen-lockfile`，并 grep 验证 neptune-engine 的 lock 段不含 product 包。

### 4.3 迁移路径（5 步）

> 实际执行不在本轮 spec 范围。这里只是 spec 必要的 happy path。

**步骤 0：依赖事实采集**（前置）
```
cd neptune-engine
bunx madge --json --ts-config ./tsconfig.json src > /tmp/madge.json
```
产出 `madge.json` 作为步骤 3 拓扑挑回的事实依据。任何与 spec 拓扑分层不一致的依赖必须在挑回前消解（要么前移到更早层、要么标记为 B 类暂留）。

**步骤 1：仓内重命名 + 包名同步 + workspaces 重声明**
```
git mv neptune-engine neptune-engine-product

# package.json 元数据全套同步
neptune-engine-product/package.json:
  name:        "claude-code-best"             →  "@neptune/engine-product"
  description: "Reverse-engineered Anthropic Claude Code CLI" → 改为对应 product 描述
  repository:  根据迁移后实际仓库地址更新
  homepage:    同上
  bugs.url:    同上
  bin:         "ccb"/"ccb-bun"/"claude-code-best" → 由 neptune-engine-product 持有（CLI 二进制属于 product）
  author:      根据团队意愿，可保留或更新

neptune-engine-product/packages/*/package.json:
  "@claude-code-best/agent-tools"  →  "@neptune/engine-tools"
  "@claude-code-best/builtin-tools" →  "@neptune/builtin-tools"
  "@claude-code-best/mcp-client"   →  "@neptune/mcp-client"
  "@anthropic/remote-control-server" → "@neptune/remote-control-server"

# packages/protocol 当前不是 workspace 包（实测无 package.json/src/），步骤 1 内补建：
neptune-engine-product/packages/protocol/package.json: 新建文件，内容
  { "name": "@neptune/protocol", "version": "0.0.0", "type": "module",
    "main": "src/index.ts", "exports": { ".": "./src/index.ts" } }
neptune-engine-product/packages/protocol/src/: 必要时新建 src 与 index.ts 占位（具体 schema 内容沿用历史定义；如历史实际已 inline 在他处则单独整理）

# 同步重声明根 workspaces（必须在 bun install 前完成，否则 install 失败）
neptune-lab/package.json workspaces:
  - neptune-engine-product
  - neptune-engine-product/packages/*
  - neptune-engine-product/packages/@ant/*
  - neptune-ai/server
  - shared
  （此时 neptune-engine 还未创建，workspaces 中暂不列出）

# 内部源码 import codemod（一次性；实测 451 处 @claude-code-best/* + 76 处 claude-code-best/*）
cd neptune-engine-product
rg -l "from ['\"](@claude-code-best/|claude-code-best/)" src packages | \
  xargs sed -i '' \
    -e "s|@claude-code-best/agent-tools|@neptune/engine-tools|g" \
    -e "s|@claude-code-best/builtin-tools|@neptune/builtin-tools|g" \
    -e "s|@claude-code-best/mcp-client|@neptune/mcp-client|g" \
    -e "s|claude-code-best/engine|@neptune/engine|g" \
    -e "s|claude-code-best/|@neptune/engine-product/|g" \
    -e "s|'claude-code-best'|'@neptune/engine-product'|g"

# sed 顺序不可调换：
# - claude-code-best/engine → @neptune/engine 必须在 claude-code-best/ → @neptune/engine-product/ 之前
#   否则 engine/ 会先被改成 engine-product/engine/
# - 'claude-code-best' 裸引用兜底放最后

# 验证 codemod 完整性
grep -rE "claude-code-best" src packages --include='*.ts' --include='*.tsx' | wc -l   # 必须为 0

# 重建 lock（此时 workspaces 已重声明，install 不会失败）
rm bun.lock && bun install
```

**步骤 2：新建空 engine 仓骨架**
```
mkdir neptune-engine
neptune-engine/package.json: { "name": "@neptune/engine", "exports": ... }
neptune-engine/tsconfig.json: 复用 product 仓的 base
neptune-engine/eslint.config.mjs: 启用步骤 4.2 第 2 条规则
neptune-engine/scripts/lint-layers.sh: 复用并扩展
```

**步骤 3：按拓扑顺序挑回 K + K-DEFAULT**

每层下面的 invariants：**本层文件不向外 import；下一层只 import 已挑回的层**。每层挑完跑 `bun test` + `bunx tsc --noEmit` + `bunx madge --circular src`，三绿才能进下一层。

* **第一层（零依赖）**：`packages/{agent-tools, protocol}`、`src/schemas/`、`src/shared/SessionContextBridge.ts`、`src/utils` 中纯函数子集（`errors.ts, log.ts, json.ts, hash.ts, sleep.ts, uuid.ts, array.ts, set.ts, string*`）
* **第二层**：`packages/{builtin-tools, mcp-client}`、`src/utils/{model/, permissions/, memory/, git/, bash/, tokens.ts, thinking.ts, tokenBudget.ts, sessionStorage.ts}`、`src/utils/settings/{settings.ts, settingsCache.ts, applySettingsChange.ts}`、`src/entrypoints/sdk/`、`src/entrypoints/agentSdkTypes.ts`、`src/entrypoints/sandboxTypes.ts`
* **第三层（含债务暂留的类型基石）**：`src/Tool.ts`、`src/Task.ts`、`src/tasks.ts` —— 这些是 B 类含债务，但被 engine 公共 SDK 直接依赖，整体留 engine
* **第四层**：`src/services/api/{client.ts, claude.ts, withRetry.ts, errors.ts, openai/, gemini/, types.ts}`、`src/services/{mcp 核心, plugins/, extractMemories/, sessionTranscript/, SessionMemory/, compact/}`、`src/memdir/{核心}`、`src/skills/{loadSkillsDir, mcpSkillBuilders, mcpSkills}`、`src/tasks/{LocalAgentTask, LocalShellTask}`、`src/utils/swarm/{spawnInProcess, teammateInit}`
* **第五层**：`src/engine/`（28k 行 SDK 包装层整体）

**步骤 4：workspace 追加 engine + 外部 import 修复**
```
# 步骤 1 已重声明 product 部分。本步只追加 engine 部分：
neptune-lab/package.json workspaces 追加:
  - neptune-engine
  - neptune-engine/packages/*

# 最终 workspaces 应为:
  - neptune-engine
  - neptune-engine/packages/*
  - neptune-engine-product
  - neptune-engine-product/packages/*
  - neptune-engine-product/packages/@ant/*
  - neptune-ai/server
  - shared

neptune-ai/server: 8 处 import 'claude-code-best/engine*' → '@neptune/engine*'
neptune-ai/server/package.json: "claude-code-best": "workspace:*" → "@neptune/engine": "workspace:*"

# CI 校验：neptune-ai 仓 grep 'claude-code-best' 必须为 0
```

**步骤 5：周边文件归位**

下列周边文件按用途归仓：

| 文件 / 目录 | 归仓 | 理由 |
|---|---|---|
| `vendor/` | product | 历史 fork 引入的 vendored 依赖 |
| 根级 `shared/`（neptune-lab/shared） | 不动 | 已是顶级 workspace 包 |
| `tsconfig.sdk.json`、`tsconfig.dts-gen.json` | engine | SDK 类型导出配置 |
| `vite.config.ts`、`build.ts` | product | 当前用于 CLI 构建 |
| `bunfig.toml` | 两仓各持一份 | bun 运行时配置 |
| `biome.json`、`knip.json` | 两仓各持一份 | 代码质量工具 |
| `typedoc.json` | engine | API 文档生成（engine SDK 是文档对象） |
| `mint.json`、`docs.json` | product | 当前文档站属产品形态 |

### 4.4 收敛后的预期形态

| 指标 | 当前 neptune-engine | 迁移后 neptune-engine（本轮稳态）| 阶段二完成后 neptune-engine | 迁移后 neptune-engine-product |
|---|---|---|---|---|
| TS 行数 | ~33 万 | ~3.5 万（其中 src/engine/ SDK 包装 28k + 类型基石与 K-DEFAULT 含债务 ~5k + utils 子集 ~2k）| ~5-6 万（B 类拆分后的净化版补回）| ~30 万（含 cc-runtime 高保真 fork）|
| 真正 kernel 内容 | 不可统计 | ~2 万（不含 SDK 包装层，且仍含债务）| ~3 万（净化）| n/a |
| 顶层目录数 | 24 | 6（kernel/ 仅占位 + engine + shared + schemas + utils 子集 + entrypoints/sdk）| 7（kernel/ 启用）| 5（cc-runtime + cli + services + tasks + entrypoints）|
| packages 数 | 11 | 4 | 4 | 7 |
| 主包名 | `claude-code-best` | `@neptune/engine` | `@neptune/engine` | `@neptune/engine-product` |
| 对外 SDK 出口 | `claude-code-best/engine/*` | `@neptune/engine/*` | `@neptune/engine/*` | n/a |

> **关于"完备性不足"**：本轮稳态的 engine 仓中，去掉 SDK 包装层后真正的 kernel 内容只有 ~2 万行，且其中仍含债务（Tool.ts 等 K-DEFAULT 含债务文件）。"轻量但完备"中"完备"一项要等阶段二 B 类拆分、净化版补回后才真正达成。本轮可接受这种"完备性渐进达成"，因为继续等待会拖慢边界落地。

### 4.5 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| **新 engine 仓中途 broken**（已接受）| 半天到几天不可编译 | 步骤 0 madge 采集 + 步骤 3 拓扑挑回 + 每层 invariants + 每层 test/typecheck/madge 三绿门禁；不通过不准提交；迁移期临时分支隔离 |
| **product 反向引用 engine 出现循环依赖** | 编译卡死或运行时未定义 | 包依赖隔离（首要）+ ESLint `no-restricted-imports` + CI lint:layers + bun.lock grep；详见 4.2 防呆 4 条 |
| **engine 初期完备性不足** | 部分能力（如 compact 净化、tool 净化）暂时降级 | 接受 "完备性渐进达成"；阶段二完成前 product 通过 SDK 出口反向暴露能力；spec 4.4 注解明示 |
| **Git 历史 follow 失效** | 后续考古困难 | 步骤 1 用 `git mv neptune-engine neptune-engine-product` 保留 product 仓全部历史；步骤 3 用 `git mv` 在 engine 仓内保留挑回历史；**跨仓 follow 不可用**——明示 2026-05-21 之前的 product 历史在 neptune-engine-product 仓查阅，engine 仓 history 始于挑回那一刻 |
| **包名 codemod 误伤** | 内部 import 改坏运行时报错 | 步骤 1 codemod 后立即 `bun install` + `bunx tsc --noEmit`；准备 `git revert` 逃生通道；编写 codemod 测试样例（含 dist 产物文件名是否更名的决策） |
| **neptune-ai 同时改 import 容易遗漏** | 编译/运行时报错 | 一次性 `find/sed` 全仓替换；workspace 起作用前 `bun install` 重建 lockfile；CI 在 neptune-ai 仓 grep `claude-code-best` 必须为 0 |

---

## 5. 包命名整改

### 5.1 现状

| 包 | 当前 name | 角色 |
|---|---|---|
| 主包 | `claude-code-best` | engine 主 SDK 包 |
| 子包 | `@claude-code-best/agent-tools` | Tool 基础类型 |
| 子包 | `@claude-code-best/builtin-tools` | Read/Edit/Bash/Grep 等 |
| 子包 | `@claude-code-best/mcp-client` | MCP 协议层 |
| 子包 | `packages/protocol`（无 npm name） | protocol schemas |
| 子包 | `@anthropic/remote-control-server` | 远程控制服务 |
| 子包 | `@anthropic/ink`、`@ant/*` | UI/平台相关 |

`claude-code-best` 这个名字是当年 fork Claude Code CLI 时直接沿用的 npm 包名，README 里也写着 "Reverse-engineered Anthropic Claude Code CLI"。它在系统里承担：
1. neptune-engine 整包的 npm 包名
2. monorepo workspace 依赖锚点
3. 3 个内部子包的 scope 前缀

### 5.2 决策：切换到 `@neptune/*` 命名空间

**与剥离同步进行**（即步骤 1 的原子动作之一）。理由：

1. **语义错位**：剥离后 engine 的使命是"Neptune 的 agent harness 内核"，名字叫 `claude-code-best` 既不准确也容易误解
2. **命名一致性**：`neptune-engine` / `neptune-engine-product` / `neptune-ai` 已经统一命名空间，再多一个 `claude-code-best` 是历史包袱
3. **本轮无额外成本**：neptune-ai 那 8 处 import 反正都要因为方案 A 改

### 5.3 命名标准

应用以下标准统一决策：

> **改名条件**：包名包含"`claude-code-best`"且当前仓将其作为 Neptune 资产持有的，全部改名到 `@neptune/*`。
>
> **保名条件**：包名包含"`@anthropic/`、`@ant/`"且其内容是 Anthropic 直接 fork 未做实质改动的，**保留原名**以诚实标注来源。

按此标准，逐包决策：

| 现 name | 新 name | 决策依据 |
|---|---|---|
| `claude-code-best` | `@neptune/engine` | engine 主包，符合改名条件 |
| (新建) | `@neptune/engine-product` | 主包剥离后的产品仓 |
| `@claude-code-best/agent-tools` | `@neptune/engine-tools` | Neptune 资产，改名 |
| `@claude-code-best/builtin-tools` | `@neptune/builtin-tools` | Neptune 资产，改名 |
| `@claude-code-best/mcp-client` | `@neptune/mcp-client` | Neptune 资产，改名 |
| `packages/protocol`（无 name） | `@neptune/protocol` | Neptune 资产，新增 name |
| `@anthropic/remote-control-server` | `@neptune/remote-control-server` | **改名**——已被 Neptune 重写而非纯 fork，符合改名条件 |
| `@anthropic/ink` | `@anthropic/ink` | 保留——Anthropic fork Ink，未做实质改动 |
| `@ant/computer-use-input` | `@ant/computer-use-input` | 保留——Anthropic 平台特性 fork |
| `@ant/computer-use-mcp` | `@ant/computer-use-mcp` | 保留 |
| `@ant/computer-use-swift` | `@ant/computer-use-swift` | 保留 |
| `@ant/claude-for-chrome-mcp` | `@ant/claude-for-chrome-mcp` | 保留 |
| `audio-capture-napi` 等 napi 包 | 保留原名 | 平台原生绑定，无 scope 前缀 |

### 5.4 原子性

包名切换 = 步骤 1 仓内重命名的一部分，**与方案 A 同一原子动作**。不允许"先剥离不改名、后改名"——会出现 product 仓里既有新名空间又有旧 `claude-code-best` 名的混乱中间态。

### 5.5 import 兼容期

不做 npm 别名兼容。本仓 monorepo 内全部 workspace path 解析，一次性切换；外部目前没有 npm 公开消费者。

---

## 6. 后续阶段（不在本轮 spec）

### 阶段顺序与依赖

```
本轮（2026-05-21 spec + writing-plans 项目）→ 阶段二 → 阶段三 → 阶段四 → 阶段五
```

**阶段二（B 类拆分）必须先于阶段三（CC fork 重写）**。理由：
- product/cc-runtime/ 中的 `QueryEngine.ts` 同时持有 `Tool.ts`/`Task.ts` 这套类型基石，阶段三若要用 engine kernel 重写 query loop，必须先有"engine 内净化版的 Tool/Task 接口"作为重写目标——这正是阶段二产出
- 否则阶段三会陷入"product `QueryEngine` 同时实现两套 Tool 类型"的撕裂状态，重构成本翻倍

**阶段四（可选 product 解耦）可与阶段二并行**。`cli/` 独立成 `@neptune/engine-cli` 不依赖 B 类拆分，是 product 仓内部细分。

### 阶段二：B 类文件拆分

把 spec 3.3 表中的 B 类文件 + 3.2 中"K-DEFAULT 含债务"项按"接口去 engine、实现留 product"拆分：
* `Tool.ts`、`Task.ts`、`tasks.ts` —— 最关键，阶段二第一批
* `commands.ts`
* `services/tools/{toolExecution, toolOrchestration, toolHooks}`（净化版补回 engine）
* `services/compact`、`services/SessionMemory`（净化版补回 engine）
* `services/AgentSummary`
* `services/skillSearch/localSearch.ts` 补回 engine

每个 B 类文件按"提取接口 → product 依赖反转 → engine 提供默认实现 → product 消费 engine 接口"四步推进。每个文件单独走 plan-phase。

### 阶段三：CC fork 重写

把 product/cc-runtime/ 中的高保真 CC fork 用 `@neptune/engine/kernel/*` 重写：
* `QueryEngine.ts` → engine 内置轻量 query loop（基于 ProviderAdapter + ToolRegistry）
* `query/transitions.ts`、`query/deps.ts` → engine kernel 状态机
* `tools.ts`、`context.ts` → engine kernel
* `bootstrap/state.ts` 全局状态 → engine kernel 提供 ALS-based 替代

完成后 `product/cc-runtime/` 收敛为薄层适配（仅保留 CLI 特性需要的 hook 点），或彻底废弃。

### 阶段四：可选 product 解耦（可与阶段二并行）

`neptune-engine-product/` 内部继续分化：
* `cli/` 部分独立成 `@neptune/engine-cli`（终端形态）
* `services/observability/{langfuse, sentry}` 独立成 `@neptune/engine-observability`
* `packages/@ant/*` 独立成各自仓（可选）

让 neptune-ai 按需 pick，不再被迫吞下整个 product 包。

### 阶段五：内核接口稳定化

`@neptune/engine` 1.0 release 前完成：
* SemVer 公开版本号
* 接口契约文档
* 向后兼容承诺
* 给第三方 agent 产品提供接入指南

---

## 7. 验收标准

本轮 spec 视为完成的标准：

1. 本文档存在于 `docs/superpowers/specs/2026-05-21-neptune-engine-harness-extraction-design.md` 且已 commit
2. 文档第 2 节"能力域定义"覆盖 10 大能力域，每域明确"内核必备"和"不属于内核"
3. 文档第 3 节"4 类标签"对应到 src/ 实际目录，每个目录有归属
4. 文档第 4 节给出方案 A 的物理形态、迁移路径、风险缓解
5. 文档第 5 节明确 `claude-code-best` → `@neptune/engine` 的改名映射
6. 文档第 6 节给出后续阶段规划（B 类拆分 / CC fork 重写 / 可选解耦 / 接口稳定化）
7. 通过 spec-document-reviewer 子代理评审
8. 用户审核通过

下一阶段（writing-plans 项目）的验收：

1. `cd neptune-engine && bun test` 全绿
2. `cd neptune-engine && bunx tsc --noEmit` 通过
3. `cd neptune-engine-product && bun test` 全绿
4. `cd neptune-engine-product && bunx tsc --noEmit` 通过
5. `cd neptune-ai/server && bun test` 全绿
6. `bun run lint:layers` 检测无反向依赖
7. neptune-engine 目录代码量 ≤ 5 万行
8. neptune-ai server 中所有 `claude-code-best/*` import 已切换到 `@neptune/engine/*`

---

## 8. 非目标

* **本轮不做任何代码动作**（git mv / 文件改写 / import 修复）
* **本轮不实际拆分 B 类文件**——只标记最终归属
* **本轮不重写 CC fork 的 QueryEngine**——整体 fork 进 product/cc-runtime/
* **本轮不重新设计 SDK 公共 API**——`src/engine/index.ts` 4 层导出形态保留
* **本轮不引入新的运行时能力**——只挪位置不增功能

判断本轮 spec 是否正确，不看文档写了多少，而看：
* 边界标准是否第一性（凭"agent 能否端到端跑通"一条规则判任何文件）
* 物理形态是否与边界标准一致
* 后续阶段是否有清晰演化路径
* 当前实现的债务是否被诚实标注（B 类、CC-FORK 类）

