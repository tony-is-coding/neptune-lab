# Stage 1 完成报告 — Workspace 独立分发能力

> **里程碑**：Stage 1 — builtin-tools 解耦死结
> **完成日期**：2026-05-23
> **HEAD**：`1c5604a`

## 0. Stage 1 完成定义验收

| 项 | 状态 | 证据 |
|---|---|---|
| **守门脚本 7/7 PASS** | ✅ | `bash neptune-engine/scripts/verify-workspace-independent.sh` 全绿 |
| **agent-loop 231 测试不退化** | ✅ | bun test src/engine: 231 agent-loop 测试不变 |
| **总 baseline 不退化** | ✅ | 1252 tests / 1189 pass / 63 known Postgres fail（不变） |
| **builtin-tools 0 个 .tsx 文件** | ✅ | find packages/builtin-tools/src -name '*.tsx' 输出空 |
| **builtin-tools 0 个 react/ink import** | ✅ | grep 验证 |
| **9 核心工具 0 反向 src/ 引用** | ✅ | grep 验证 |
| **engine-product 0 反向引用** | ✅ | grep 验证 |

## 1. Sub-Batch 提交链

```
1c5604a S1.3c — permissions/analytics/file/misc cc-shim 完整覆盖（守门 7/7 PASS）
7b582d3 S1.3b — cc-shim/bash 内联 + LLM-driven prefix 拆除
04b151c S1.3a — cc-shim 5 个 utils（path/cwd/platform/log/debug）+ 全工具 import 切换
c3e1fcf S1.2  — 11 个 .tsx 文件全删 + React/ink import 清零（守门 6/7 PASS）
5b34917 S1.1  — Analytics 短命名接口 + verify-workspace-independent.sh 守门脚本（Stage 1 启动）
```

## 2. cc-shim 模块全景

```
neptune-engine/packages/builtin-tools/src/utils/cc-shim/
├── index.ts         — 公开 5 类基础 utils
├── cwd.ts           — getCwd / pwd / runWithCwdOverride（process.cwd 兜底，不依赖 AsyncLocalStorage）
├── platform.ts      — getPlatform / isWindows / isMac / isLinux
├── path.ts          — expandPath / getDirectoryForPath / posixPathToWindowsPath / joinPosix
├── log.ts           — logError / logForDebugging / logAntError / captureAPIRequest（走 console）
├── analytics.ts     — logEvent / getFeatureValue_CACHED_MAY_BE_STALE / logFileOperation（NoOp）
├── file.ts          — getFsImplementation / readFileSyncCached / addLineNumbers / diff / fileHistory / fileStateCache（Node fs 直接走）
├── misc.ts          — 30+ 业务 stub（sandbox/Shell/messages/model/state/settings/notebook/pdf/plugins/...）
├── permissions/
│   └── index.ts     — re-export engine permissions 类型 + getMatchingShellRules/PermissionMode/extractRules/etc.
└── bash/
    ├── commands.ts  — splitCommand_DEPRECATED + getCommandSubcommandPrefix stub（substrate 不做 LLM-driven prefix）
    ├── parser.ts    — parseCommandRaw / parseForSecurity / Node / PARSE_ABORTED
    ├── ast.ts       — Redirect / SimpleCommand / 解析逻辑
    ├── ParsedCommand.ts
    ├── heredoc.ts
    ├── shellQuote.ts — quote / tryParseShellCommand
    └── treeSitterAnalysis.ts
```

## 3. 量化指标

| 指标 | Stage 1 前 | Stage 1 后 | 变化 |
|---|---|---|---|
| 守门脚本 PASS 项 | 0/7 | 7/7 | +7 |
| builtin-tools .tsx 文件 | 11 | 0 | -11 |
| builtin-tools React/ink import | 32 处 | 0 | -32 |
| 9 核心工具反向 src/ 引用 | 215 处 | 0 | -215 |
| 整 builtin-tools 反向 src/ 引用 | 465 处 | ~110 处（AgentTool/SkillTool 业务残留）| -355 |
| engine 全量测试 pass | 1184 | 1189 | +5（含 5 新 Analytics） |
| 删除代码（净）| - | -2918 行 React 死代码 | |
| 新增 cc-shim 代码 | - | ~7000 行（含直接复制 cc bash AST 6500 行）| |

## 4. 第一性原理体现

1. **substrate 不依赖 cc 全局**：cc 用 AsyncLocalStorage cwdState、bootstrap state、analytics sink 全局单例；substrate 走 process.cwd() / NoOp / 内存实例
2. **接口 + 默认实现 + 可注入**：所有 stub 都允许 product 替换（fs / sandbox / analytics / permissions）
3. **明确边界**：substrate 提供 bash AST 解析（命令切分能力）；不提供 LLM-driven prefix extraction（cc product 业务）
4. **暴露错误，不代偿**：缺失 fs / sandbox / 等 ctx 注入时返回保守值（而非 throw）
5. **fail-loud 守门**：verify-workspace-independent.sh 把所有边界检查具象化、自动化

## 5. 与 cc 的关键差异（不抄部分）

| Behavior | cc 行为 | substrate 行为 | 理由 |
|---|---|---|---|
| cwd 全局 AsyncLocalStorage | 跨 agent concurrent 隔离 | process.cwd() 单值 | substrate 通过 ctx.options.cwd 注入隔离 |
| analytics logEvent | 真实埋点（langfuse/segment）| NoOp | 业务关注点；ctx.analytics 注入 |
| LLM-driven bash prefix extraction | queryHaiku 调用 | 整命令当 prefix（保守）| substrate 不依赖 LLM 做基础设施 |
| BASH_POLICY_SPEC（cc rule LLM 提示）| 有 | 无 | cc 业务 |
| fileHistory 跨工具状态 | 有 | NoOp stub | substrate 不持有 cross-tool mutation 历史 |
| Sandbox 强制包裹 | 有 | NoOp | 由 product 注入（Stage 3） |
| Settings 系统 | 有 | NoOp stub | product 业务 |
| feature flags / growthbook | 有 | NoOp stub | A/B 实验 |

## 6. 已知限制（留待后续）

| 限制 | 工作量 | 处置 |
|---|---|---|
| AgentTool 业务（builtInAgents/loadAgentsDir/agentColorManager）仍引 src/... | ~3 天 | S1.5（Post-Stage-2 处理） |
| SkillTool 业务（loadSkillsDir/plugin marketplace）仍引 src/... | ~1 天 | S1.6 |
| builtin-tools tsconfig.paths.src 仍存在帮忙 resolve | 0.5 天 | Stage 1.5 关掉 |
| bashPermissions.ts 用 prefix stub | 0 | PolicyHook 接管前不影响 substrate 用法 |
| 部分 stub 仅占位（pdf/imageResizer/notebook/git/glob/ripgrep）| 视需求 | 真要工具能用，product 自行注入 |

## 7. 下一步

进 Stage 2（合规护城河）：
- S2.1: shared 7 个稳定契约（Run/ToolInvocation/Artifact/EvidenceArtifact/AuditEvent/HumanReview/PolicyDecision）
- S2.2: 4 类治理 hook（PolicyHook/HumanReviewHook/EvalHook/ArtifactHook）+ NoOp 实现
- S2.3: PermissionMode 协议 + AgentLoop 集成（5 mode × 5 category 决策矩阵）
- S2.4: AgentLoop 集成治理 hook + Stage 2 收尾

Stage 1 收尾任务（S1.5/S1.6）后置 — 它们不阻塞 substrate 独立分发能力。
