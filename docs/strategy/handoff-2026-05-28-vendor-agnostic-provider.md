# Handoff — v6.0 P0.3 Provider 配置 Vendor-Agnostic 化（收尾记录）

**交付时间**：2026-05-28
**工作分支**：`codex/engine-decoupling-cleanup`
**Worktree**：`/Users/terrence_tan/.codex/worktrees/9536/neptune-lab`
**前任 agent**：Claude（Kiro，因用户决定切给 codex 接手而暂停）
**接手 agent**：codex
**当前状态**：验证闭环与资源文档更新已完成，代码与文档待 commit / ff merge

---

## 0. TL;DR — 当前事实层

1. **examples + scripts 的 vendor-agnostic provider 改造已完成**：vendor 知识全部从代码分支抽到 env 配置，核心抽象是 `AUTH_MODE` / `API_KEY|AUTH_TOKEN` / `BASE_URL+MODEL`。
2. **守门已全绿**：`bun test src/engine` 1306/0、`bun run tsc --noEmit` 0 errors、scripted smoke 3/3、verify-workspace-independent 11/11、verify-substrate-v2 42/42。
3. **真 API smoke 已 3/3 通过**：本地协议转换代理 `127.0.0.1:15721` + `x-api-key` 路径验证了 in-process、FileRunStore 状态外化、HTTP + SSE 端到端。
4. **v6.0 资源文档已同步**：`docs/neptune-engine-v6.0.md` 5.3 / 7.x / roadmap 已去 vendor-default 化，DeepSeek/OpenRouter/Powapi 不再作为默认路径或代码规则出现。
5. **API key 只允许 inline env**：本文件不保存密钥；不要把测试 key 写入仓库、commit message、临时文件或 stdout 全量日志。

---

## 1. 当前 Git 状态（事实层）

```
Branch:    codex/engine-decoupling-cleanup
HEAD:      0215cbc refactor(engine): P0.5.D — package.json exports 严格白名单制 (删 wildcard)
develop:   同 0215cbc（已 ff 同步过）
upstream:  ccb94f0（晚于本分支 -- 不需要 rebase，因为 develop 本地已含 0215cbc）
```

**未 commit 的代码改动**：

```
 M neptune-engine/examples/__tests__/examples.smoke.test.ts   (注释去 vendor 名)
 M neptune-engine/examples/_provider.ts                       (新文件 / vendor-agnostic 重写 ~197 行)
 M neptune-engine/examples/sdk-pure.ts                        (头注释精简，指向 _provider.ts)
 M neptune-engine/examples/sdk-with-fs-store.ts               (同上)
 M neptune-engine/examples/sdk-with-server.ts                 (同上)
 D neptune-engine/scripts/probe-opencode-go.ts                (删旧的 vendor-specific probe)
?? neptune-engine/scripts/probe-anthropic-compat.ts           (重写 vendor-agnostic 版)
 M neptune-engine/scripts/smoke-real-api.sh                   (重写：去 vendor 自动识别)
```

**未 commit 的资源文档改动**：

```
 M docs/neptune-engine-v6.0.md
?? docs/strategy/handoff-2026-05-28-vendor-agnostic-provider.md
```

无其他 stash / WIP（以 `git status --short --branch` 为准）。

---

## 2. 本次工作的根本问题与解决思路（Why）

### 2.1 用户的根本指令

> "_provider.ts — 配置全部帮我抽取出来用环境变量注入，不要硬写代码搞；完整的 provider 路线画一个 ASCII 图来描述清楚，要足够抽象，不要有什么写死代码；provider 需要可配置化"

**翻译**：substrate 是分发给任意场景的 SDK，**vendor 知识属于配置（env），不是代码**。examples 与 scripts 不允许出现 `isOpenCode = baseURL.includes('opencode')` 或 `BASE_URL=https://api.deepseek.com/anthropic` 之类的硬编码 vendor 检测/默认值。

### 2.2 第一性原理：3 类正交配置

任何 anthropic-compatible provider 接入只需要 3 类正交 env：

| 正交维度 | env | 取值 |
|---------|-----|------|
| 认证模式 | `AUTH_MODE` | `apikey` (x-api-key header) \| `bearer` (Authorization Bearer header) |
| 认证值 | `API_KEY` 或 `AUTH_TOKEN` | 实际密钥 |
| 端点 + 模型 | `BASE_URL` + `MODEL` | URL + model name |

也接受 Anthropic SDK 标准 env (`ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_BASE_URL`)，方便 0 改动接入 cc-switch / claude code 等已有工具链。

`USE_SCRIPTED_PROVIDER=true` 走 mock provider（CI / 离线 0 API 消耗）。

完整路由图请见 `examples/_provider.ts` 文件头注释（含 6 种场景示例 ASCII 图）。

### 2.3 关键事实层面发现（之前几轮验证过的，不要重复劳动）

- 本地协议转换代理 `127.0.0.1:15721` 已实证支持 Anthropic SSE streaming；本轮真 API smoke 用 `x-api-key` header 通过。
- vendor 官方 anthropic endpoint、第三方 Bearer 网关、本地协议转换代理都应被抽象为同一类：Anthropic Messages/SSE compatible endpoint。
- 严格 anthropic-compat 网关可能只接受 content blocks 数组形式，不接受 `content: "string"`。examples 已统一用数组形式以覆盖更广兼容。

---

## 3. 已完成清单（What's done）

### 3.1 代码改动

| 文件 | 改动类型 | 关键点 |
|------|---------|-------|
| `examples/_provider.ts` | 重写 ~197 行 | 3 类正交 env、`resolveProvider()` 单入口、文件头 ASCII 全景图 + 6 场景示例 |
| `examples/sdk-pure.ts` | 头注释精简 | 删 vendor-specific key 示例，改为指向 _provider.ts |
| `examples/sdk-with-fs-store.ts` | 头注释精简 | 同上 |
| `examples/sdk-with-server.ts` | 头注释精简 | 同上 |
| `examples/__tests__/examples.smoke.test.ts` | 注释行 | 删 `DEEPSEEK_API_KEY` 字样 |
| `scripts/probe-opencode-go.ts` | **删除** | vendor-specific probe（含 OPENCODE_API_KEY 等） |
| `scripts/probe-anthropic-compat.ts` | **新建** | 直接复用 `_provider.ts::resolveProvider()`，0 vendor 知识 |
| `scripts/smoke-real-api.sh` | 重写 ~131 行 | 去 vendor 自动识别（删 `OPENCODE_API_KEY`/`DEEPSEEK_API_KEY` 推导分支），3 类正交 env，文件头列出 5 种场景 |

### 3.2 验证已跑过（baseline + 重写后均跑）

| 守门 | 结果 |
|------|------|
| `bun test src/engine` | **1306 pass / 0 fail** |
| `bun run tsc --noEmit` | **0 errors** |
| `bash scripts/smoke-scripted.sh` | **3 pass / 0 fail** |
| `bash scripts/verify-workspace-independent.sh` | **11/11 PASS** |
| `bash scripts/verify-substrate-v2.sh` | **42/42 PASS**（A 13 + B 10 + C 5 + D 10 + E 4） |

### 3.3 真 API smoke 已 3/3 通过

```bash
API_KEY=<inline only> \
BASE_URL=http://127.0.0.1:15721 \
MODEL=<provider-model> \
AUTH_MODE=apikey \
bash scripts/smoke-real-api.sh
```

- ✅ Step 1/3 sdk-pure.ts：in-process 真 LLM call OK
- ✅ Step 2/3 sdk-with-fs-store.ts：run.json 创建，3 个 events 持久化
- ✅ Step 3/3 sdk-with-server.ts：HTTP POST + SSE GET 端到端 OK

### 3.4 一个 macOS 兼容性 bug 已修

旧脚本里写了 `${VAR,,}`（小写转换），bash 3.x（macOS 默认）不支持，改为 `printf | tr`：

```bash
AUTH_MODE_LOWER="$(printf '%s' "$AUTH_MODE_RESOLVED" | tr '[:upper:]' '[:lower:]')"
```

---

### 3.5 本轮新增稳健性修复

- `scripts/smoke-real-api.sh` 不再固定 `SERVER_PORT=3789`，默认使用随机高端口，避免本地端口占用导致误判。
- `examples/__tests__/examples.smoke.test.ts` 的 server smoke 不再用 `PORT=0`，因为当前 Bun 环境下 `PORT=0` 会报告 `Failed to start server. Is port 0 in use?`。
- `examples/sdk-with-server.ts` 文档同步移除 `PORT=0 = 随机` 的误导描述。

---

## 4. 剩余收尾动作（What's next）

当前只剩工程收口：

1. stage code slice：`neptune-engine/examples` + `neptune-engine/scripts`
2. commit code slice：vendor-agnostic provider cleanup
3. stage docs slice：`docs/neptune-engine-v6.0.md` + 本 handoff
4. commit docs slice：v6.0 provider 配置文档同步
5. `git checkout develop` + `git merge --ff-only codex/engine-decoupling-cleanup`
6. 回到工作分支或按用户下一步继续新 batch

### 4.1 Commit 工程纪律

**关键工程教训（再次强调，不要踩坑）**：

> 不要用 `git commit -m "..."` 含 emoji / 多行 / 中文 / 反引号 / 中括号
> 不要用 multi-command（`&&`、`;`、`|`）— 会卡死

**正确流程**（每个 step 一个 invocation）：

```bash
# Step 1: 写 message 到临时文件
printf '%s\n' \
  'refactor(engine): P0.3 — examples/scripts 全面 vendor-agnostic 化' \
  '' \
  '核心：3 类正交 env (AUTH_MODE / API_KEY|AUTH_TOKEN / BASE_URL+MODEL)' \
  '替换所有 vendor 检测代码。Vendor 知识 = 配置（env），不是代码。' \
  '' \
  'Changes:' \
  '- examples/_provider.ts: vendor-agnostic 重写 (~197 行，含 ASCII 全景图 + 6 场景示例)' \
  '- examples/sdk-pure|sdk-with-fs-store|sdk-with-server: 头注释精简，指向 _provider.ts' \
  '- examples/__tests__/examples.smoke.test.ts: 删注释中 vendor 名' \
  '- scripts/probe-opencode-go.ts → scripts/probe-anthropic-compat.ts: 删 vendor-specific probe，新建复用 resolveProvider() 的探针' \
  '- scripts/smoke-real-api.sh: 重写 (~131 行)，删 OPENCODE_API_KEY/DEEPSEEK_API_KEY 自动识别分支' \
  '- 修 macOS bash 3.x 兼容，server smoke 使用随机高端口' \
  '' \
  '验证: substrate 1306/0, scripted smoke 3/3, v1 11/11, v2 42/42, tsc 0 errors' \
  '真 API smoke (local anthropic-compatible proxy): 3/3 pass' \
  > /tmp/cmsg.txt

# Step 2: stage 文件
git add neptune-engine/examples neptune-engine/scripts

# Step 3: commit
git commit -F /tmp/cmsg.txt

# Step 4: 清理
rm /tmp/cmsg.txt

```

代码 slice 提交后，用同样单步模式提交 docs slice。不要把 API key 写入 commit message 或临时文件。

### 4.2 [已完成，待 commit] v6.0 文档去 vendor + 补 5.3 节实证

**文件**：`docs/neptune-engine-v6.0.md`

**已完成改动范围**：

| 段落 | 已完成改动 |
|------|------------|
| `5.3` 节 provider 表 | 改成 3 类正交 env + anthropic-compatible 接入路径实证表 |
| `5.3` 节代码示例 | 改成 `process.env.API_KEY` / `process.env.AUTH_TOKEN` / `process.env.BASE_URL` / `process.env.MODEL` |
| smoke 命令示例 | 改成 `API_KEY=... BASE_URL=... MODEL=... bash scripts/smoke-real-api.sh` |
| factory 规则 | 删除旧的 vendor 名自动识别，改为显式 `AUTH_MODE` 与 env 解析 |
| roadmap | 从 vendor 名单扩展改成 provider conformance matrix |

**Commit message** 建议（独立 commit）：

```
docs(engine): document vendor-agnostic provider config

Update v6.0 and handoff docs for P0.3.
Substrate consumes anthropic-compatible protocol, not vendor names.
```

---

## 5. 红线与边界（不要踩）

延续之前所有用户纠正过的红线：

1. **第一性原理**：substrate 首先是强大 harness engine，然后才是干净/可拓展/SDK 分发。功能完整性 > 工程洁癖。
2. **vendor 知识 = 配置（env），不是代码**。绝对不允许 `isOpenCode = baseURL.includes(...)` 或 `if 含 deepseek then BASE_URL=...` 之类的检测分支。
3. **API key 处理**：
   - 不要写到代码中
   - 不要写到临时文件中
   - 不要在 stdout 完整打印
   - 用 inline env 形式 `KEY=... bun run ...`
4. **TDD red→green→commit→ff develop 节奏**，每个 sub-batch 独立闭环。
5. **守门必跑**：`verify-workspace-independent.sh` 11/11 + `verify-substrate-v2.sh` 42/42 + scripted smoke 3/3。
6. **commit 工程纪律**：`printf > /tmp/cmsg.txt` → `git add` → `git commit -F` → `rm`，每步一个 invocation，禁止 multi-command。
7. **substrate public API 边界**：`@neptune/engine` (主) + `@neptune/engine/testing` + 6 个 wrapper 子入口。新加的 `examples/_provider.ts` 是 example 层，不进 substrate exports（已确认）。

---

## 6. 关键文件路径速查

### 待 commit 的代码文件
- `neptune-engine/examples/_provider.ts` — vendor-agnostic provider factory（核心）
- `neptune-engine/scripts/probe-anthropic-compat.ts` — 协议探针（新建）
- `neptune-engine/scripts/smoke-real-api.sh` — 真 API smoke（重写）
- `neptune-engine/examples/sdk-pure.ts | sdk-with-fs-store.ts | sdk-with-server.ts` — 头注释统一精简
- `neptune-engine/examples/__tests__/examples.smoke.test.ts` — 注释微调

### 待 commit 的资源文档
- `docs/neptune-engine-v6.0.md` — v6.0 provider 配置边界同步
- `docs/strategy/handoff-2026-05-28-vendor-agnostic-provider.md` — 本轮事实与验证记录

### Substrate 边界参考（不要动，仅查阅）
- `neptune-engine/src/engine/agent-loop/provider/AnthropicStreamingProvider.ts` — 真 Provider 实现（authToken/apiKey 互斥逻辑）
- `neptune-engine/src/engine/index.ts` — substrate 主 entry public API
- `neptune-engine/package.json` — exports 字段（白名单制）
- `neptune-engine/scripts/verify-substrate-v2.sh` — 守门 v2 42 项
- `neptune-engine/scripts/verify-workspace-independent.sh` — 守门 v1 11 项

### 历史里程碑（背景参考）
- `docs/neptune-engine-v5.0.md` — v5.0 完整说明书 850 行
- `docs/neptune-engine-v6.0.md` — v6.0 文档骨架 708 行
- `docs/strategy/neptune-engine-decoupling-handover.md` — 最初 codex 交接文档

---

## 7. 一句话目标

> **跑通真 API smoke 3/3 → commit → ff merge develop → 改 v6.0 文档（独立 commit）→ ff merge develop。完事。**

预计耗时：30-60 分钟（如果不踩 commit message 坑）。

---

**祝顺利。如果遇到任何不在本文档预期内的偏差，先 grep 查事实，不要猜。**
