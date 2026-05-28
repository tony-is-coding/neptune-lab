# Stage B 实施计划 — substrate v2.1 真正功能完整

**起点**：Stage A 审计完成（commit 055e49a）
**目标**：A 功能完整性 5 条 + B 测试覆盖 5 条 + C 工程纪律 4 条 全部上线 = substrate v2.1 = "可独立分发的、功能齐全的 Agent Runtime Kernel"
**完成定义**：守门 v2 PASS（5 Gate ~41 项，含 functional substrate 端到端 check）+ baseline 不退化 + 3 个 SDK example 真跑通

---

## 已确认的 7 项决策（基于 Stage A 实证盘点 + 用户 approve）

1. **Sub-agent + Agent Teams 都是 substrate 必备能力** — cc 两个并立特性，B 模块 ~1200 行保留协议化（不是业务舍弃）
2. **内置 4 agents 必须保留** — generalPurpose / explore / plan / verification 是 substrate baseline，未来 LLM 自创建也以此为参考形态
3. **agentMemory 双文件协议化** — agent-scoped memory + 三 scope（user / project / local）+ snapshot 同步，作为 MemoryStore 协议扩展
4. **async background launch 替代证明通过** — substrate ~100 行 = TaskQueue + RunStore + AgentLoop.runWithStore 替代 cc 807 行 LocalAgentTask（jsonl 持久化更强 + 跨实例 resume 友好）
5. **resume sub-agent 替代证明通过** — substrate ~100 行 = RunStore.loadSnapshot + 50 行 message filter 替代 cc 266 行（需补 3 个 cleanup 函数）
6. **SkillTool 切片** — 保留 S1+S3+S4+S5+S6+S7+S8 + prompt = ~430 行；舍弃 S2/S9-S14（cc 命令系统、plugin marketplace、EXPERIMENTAL_SKILL_SEARCH、SAFE_SKILL_PROPERTIES、UI render 等业务装饰）
7. **行数预算确认** — substrate 必备 ~5000 行（cc 总 8400 行 / 可舍 ~3400 行）

---

## 实施批次（B0 - B10）

每个 sub-batch 必跑：
- TDD red → green → commit → 守门通过 → ff develop（`git -C /Users/terrence_tan/startups/neptune-lab merge --ff-only codex/engine-decoupling-cleanup`）
- 守门 / tsc / `bun test src/engine` / `bun test packages` baseline 不退化
- 任一退化立即 git revert + 汇报

### B0 守门修补 + 工程基线（信号先准）
**目标**：让守门信号变准，不再被假绿误导。

- **B0.1 守门 #10 加相对反向引用检查** — `from '\.\./\.\./\.\./\.\./\.\./src/'` 模式（修虚假 PASS）
- **B0.2 守门加 #12 functional substrate placeholder check**（红线 #5 — 先放占位，B2 后启用）
- **B0.3 清理 4 处 dangling import**：
  - `REPLTool/constants.ts` + `REPLTool/primitiveTools.ts` import 已迁出 AgentTool/NotebookEditTool
  - `FileEditTool/FileEditTool.ts` import NotebookEditTool
  - `GrepTool/prompt.ts` import `../AgentTool/constants.js`
- **B0.4 baseline tsc + bun test 全跑过 + commit + ff**

预估：1.5h

### B1 协议层补齐（先建协议再写工具）
**目标**：substrate 已有协议覆盖 70%，补齐 sub-agent / agent teams / agentMemory / message filter 缺的 30%。

- **B1.1 MemoryStore 协议扩展**：
  - `AgentScopedMemoryStore` 接口（agent-scoped + 三 scope + snapshot 同步）
  - `FilesystemMemoryStore` 实现（cc agentMemory 等价行为，无 cc 业务依赖）
  - 单测覆盖三 scope + snapshot init/replace/markSynced
- **B1.2 RunStore message filter 协议**：
  - `filterUnresolvedToolUses` / `filterOrphanedThinkingOnly` / `filterWhitespaceOnlyAssistant` 三个工具函数（resume 必备）
  - 加到 `engine/run/messageFilters.ts`
  - 单测覆盖
- **B1.3 AgentRegistry 协议扩展**：
  - 增加 `getBuiltIns(): AgentManifest[]` 方法（让 substrate 默认提供 4 个 baseline agent）
  - 不破坏现有协议
- **B1.4 TeammateChannel 协议**（agent teams 用）：
  - mailbox 接口（writeToMailbox / readMailbox / subscribe）
  - 默认 InMemoryTeammateChannel 实现
  - 单测覆盖
- **B1.5 子进程接口预留**（agent teams in-process backend 用）：
  - 在 substrate 不引入 tmux / process spawn 业务，只定义接口

预估：4h

### B2 SubAgentTool 薄壳（核心 P0）
**目标**：substrate 内 ~2700 行薄壳，依托 substrate 协议组装。

- **B2.1 SubAgentTool 主体 ToolDef + inputSchema + outputSchema**（~150 行 + 测试 red→green）
- **B2.2 sub-agent 启动 + AgentLoop 集成**（~200 行 — manifest 解析 / system prompt 注入 / tools 白名单 / model 选择三段优先级）
- **B2.3 result aggregation**（~100 行 — last assistant text + 回溯 fallback + tool count + token usage + usage trailer）
- **B2.4 tool_result block mapping**（~80 行 — 含 one-shot agent 跳过 / 空内容 fallback / agentId 注入）
- **B2.5 cancellation 链路 + partial result extraction**（~120 行 — parent abort → child abort + 三类错误处理 + AbortError + extractPartialResult）
- **B2.6 一轮多 sub-agent 并行 spawn**（~80 行 — 与 AgentLoop ToolDispatcher 协调）
- **B2.7 permissionMode 继承 + 覆盖**（~50 行 — 5×5 矩阵已有，sub-agent 接入）
- **B2.8 sub-agent depth 限制 + 防 spawn 风暴**（~40 行）
- **B2.9 一轮 2 个 tool_use 的 e2e 测试**（red→green + ScriptedProvider）
- **B2.10 启用守门 #12 functional substrate check**（B0 占位转生效）

预估：8h

### B3 内置 4 agents 注册
**目标**：substrate 默认提供 generalPurpose / explore / plan / verification 4 个 baseline agent manifest。

- **B3.1 4 个 agent 转为 substrate AgentManifest**（剥 cc 业务装饰，保留 systemPrompt / tools / modelHint / description）
- **B3.2 InMemoryAgentRegistry / FilesystemAgentRegistry 默认注入这 4 个**
- **B3.3 单测覆盖（4 个 manifest 加载 + AgentTool 路径走通）**

预估：1.5h

### B4 Async background launch + Resume 协议化
**目标**：替代 cc 807 行 LocalAgentTask + 266 行 resumeAgent，substrate ~200 行实现等价行为。

- **B4.1 async background launch**：
  - SubAgentTool 路径分支：`run_in_background=true` → TaskQueue.create + RunStore.create → 后台 promise 跑 AgentLoop.runWithStore
  - 立即返回 `{status: 'async_launched', agentId, taskId, runId}`
  - 完成 → taskQueue.update + runStore.updateStatus + ctx.hooks.onAgentComplete
- **B4.2 resume sub-agent**：
  - SubAgentTool 路径分支：`action='resume', runId` → runStore.loadSnapshot + 3 个 filter → AgentLoop.resume
  - resume 不重新加 user message（snapshot.messages 已含）
- **B4.3 e2e 测试**：runWithStore + cross-instance resume + abort partial result

预估：3h

### B5 Agent Teams 薄壳
**目标**：substrate 内提供 spawnTeammate + 多 agent 协作能力，cc tmux/swarm 业务实现保留 product 作参考。

- **B5.1 TeammateManifest + spawnTeammate 协议**：
  - 接口定义（name / model / agentType / mailbox 端点 / lifecycle）
  - 默认 InMemoryTeammateBackend（同进程多 LLM 循环，无 tmux 业务）
- **B5.2 SendMessageTool 留 substrate + 剥 13 处反向引用**：
  - 走 substrate TeammateChannel 协议而不是 cc swarm/teammate 业务
  - 保留 mailbox / broadcast / shutdown_request / plan_approval 4 类消息类型
  - 移除 tmux / replBridge / peerSession / parseAddress UDS 业务（product 注入）
- **B5.3 e2e 测试**：spawn 2 个 in-process teammate + mailbox 通信 + shutdown
- **B5.4 守门 #10 升级到检查 SendMessageTool 0 反向引用**

预估：5h

### B6 SkillTool 薄壳
**目标**：substrate 内 ~430 行薄壳，依托 SkillRegistry 协议 + AgentLoop。

- **B6.1 SkillTool 主体 ToolDef + inputSchema + outputSchema**（~80 行 — skill name + args，剥 cc 命令系统）
- **B6.2 validateInput**（~30 行 — registry.find 命中，剥 EXPERIMENTAL_SKILL_SEARCH）
- **B6.3 checkPermissions**（~50 行 — deny/allow rules + 默认 ask，剥 SAFE_SKILL_PROPERTIES）
- **B6.4 call 主路径 — fork sub-agent**（~150 行 — skill.prompt 当 system prompt + skill.tools 白名单 + AgentLoop spawn + result aggregate）
- **B6.5 mapToolResultToToolResultBlockParam**（~30 行）
- **B6.6 prompt.ts 简化**（~80 行 — 教 LLM 怎么用 skill，剥 cc 命令 / plugin / mcp / discoveredSkill 业务装饰）
- **B6.7 e2e 测试 — invoke skill + sub-agent 跑完 + result 回填**
- **B6.8 守门 #12 加 SkillTool e2e check**

预估：3h

### B7 AgentEngine.query 重接 AgentLoop（解开双轨制）
**目标**：让 AgentEngine 生产路径走 AgentLoop，注入 kernel bag + governance + auditStore + runStore。v1.0 完成的 16 个 agent-loop batch 能力全部上线。

- **B7.1 AgentEngine.query 路径分支**：
  - 默认走 AgentLoop（注入 kernel bag from config）
  - 保留 HeadlessQueryEngine 作为 legacy fallback（向后兼容）
- **B7.2 注入完整能力**：
  - retry / fallback / watchdog / caching / compaction / budget （v1.0 已有，注入即可）
  - governance hooks / auditStore / runStore / sandbox（v1.0 已有，注入即可）
  - kernel bag（agentRegistry / skillRegistry / taskQueue / todoState / toolRegistry / memoryStore）
- **B7.3 cancellation 链路修复**：combinedSignal 一路传到 AgentLoop（修 P1.2）
- **B7.4 e2e 测试**：通过 ScriptedProvider 跑完整 query + 验证 RunStore / Audit / Governance 都被触达

预估：4h

### B8 工具拓扑收尾
**目标**：剥离剩余反向引用 / 业务耦合。

- **B8.1 SendMessageTool 反向引用收尾**（B5.2 已完成主体，这里查漏补缺）
- **B8.2 REPLTool 重新盘点**（实测后再向用户确认是否迁出）
- **B8.3 SleepTool 剥 proactive 业务**（移到 product hook）
- **B8.4 BashTool / FileEditTool / GrepTool 反向引用收尾**

预估：2h

### B9 Sandbox 集成（生产路径）
**目标**：让 BashTool / FileWriteTool / WebFetchTool 走 ctx.sandbox（默认 NoOpSandbox 透传，product 注入 LocalSandbox 即生效）。

- **B9.1 BashTool 接 ctx.sandbox.exec**
- **B9.2 FileWriteTool 接 ctx.sandbox.writeFile**
- **B9.3 WebFetchTool 接 ctx.sandbox.fetch**
- **B9.4 e2e 测试**：注入 LocalSandbox 后规则生效（24 case 决策矩阵已有）

预估：2h

### B10 守门完整升级 + 端到端验收 + v2.1 说明书
**目标**：守门 v2.sh 5 Gate / ~41 项含 functional substrate；写 v2.1 纠正 v2.0 误导。

- **B10.1 守门升级为 verify-substrate-v2.sh**：
  - Gate A 干净度（11 项保留 + 1 项相对反向引用 + 1 项调试残留 = 13 项）
  - Gate B 协议契约（10 项 — 替代 v1 文件存在，跑各模块 `__tests__` PASS）
  - Gate C 工具调度（5 项 — e2e/PermissionMode/Hooks/kernel tool/ToolRegistry）
  - Gate D 端到端功能（9 项 — ScriptedProvider AgentLoop / SubAgent e2e / Skill e2e / Teammate e2e / resume / Audit / Governance / Obs / Cancellation）
  - Gate E 量化基线（5 项 — engine + packages baseline / engine tsc / packages tsc / API 快照 / 守门套娃）
- **B10.2 baseline 跑过 + verify-substrate-v2.sh PASS**
- **B10.3 写 docs/neptune-engine-v2.1.md 说明书**：纠偏 v2.0 双轨制误导，写清 substrate 真正能力清单 + 限制 + 使用方式

预估：3h

---

## 时间预估

| 批次 | 内容 | 预估 | 累计 |
|------|------|------|------|
| B0 | 守门修补 + 工程基线 | 1.5h | 1.5h |
| B1 | 协议层补齐 | 4h | 5.5h |
| B2 | SubAgentTool 薄壳 | 8h | 13.5h |
| B3 | 内置 4 agents 注册 | 1.5h | 15h |
| B4 | Async + Resume 协议化 | 3h | 18h |
| B5 | Agent Teams 薄壳 | 5h | 23h |
| B6 | SkillTool 薄壳 | 3h | 26h |
| B7 | AgentEngine 重接 AgentLoop | 4h | 30h |
| B8 | 工具拓扑收尾 | 2h | 32h |
| B9 | Sandbox 生产路径集成 | 2h | 34h |
| B10 | 守门升级 + 验收 + v2.1 文档 | 3h | 37h |
| **合计** | | **~37h（约 4-5 个工作日）** | |

---

## 主目标不丢失锚点（每批做完必须勾选）

完成 v2.1 = 14 条全部 ✅：

### A 功能完整性（5 条）
- [ ] A.1 SDK 用户能 spawn sub-agent（B2 + B7 完成）
- [ ] A.2 SDK 用户能 invoke skill（B6 + B7 完成）
- [ ] A.3 AgentEngine.query 走 AgentLoop（B7 完成）
- [ ] A.4 BashTool / FileWriteTool / WebFetchTool 走 ctx.sandbox（B9 完成）
- [ ] A.5 Cancellation 链路完整（B7.3 完成）

### B 测试覆盖（5 条）
- [ ] B.1 ScriptedProvider e2e — spawn sub-agent（B2.9 完成）
- [ ] B.2 SkillTool e2e — invoke skill（B6.7 完成）
- [ ] B.3 AgentEngine e2e — RunStore + Audit + Governance 都触达（B7.4 完成）
- [ ] B.4 Resume 跨实例 — AgentEngine 路径（B4 + B7 完成）
- [ ] B.5 SDK examples USE_SCRIPTED_PROVIDER=1 真跑 1 turn（B10 完成）

### C 工程纪律（4 条）
- [ ] C.1 守门升级为 5 Gate / ~41 项（B10.1 完成）
- [ ] C.2 守门 #10 修补相对反向引用（B0.1 完成）
- [ ] C.3 清理 4 处 dangling import（B0.3 完成）
- [ ] C.4 baseline 含 packages 测试（B10.1 内集成）

---

## 红线锚点（每批必检）

1. **每个 sub-batch TDD red→green→commit→ff develop** — 强制
2. **守门必跑** — 每批末尾 `bash neptune-engine/scripts/verify-workspace-independent.sh`
3. **baseline 不退化** — `bun test src/engine` + `bun test packages`，pass 不能少
4. **禁止漂移** — 任一改动若与 7 项决策不符，立即停手汇报
5. **大改前先红测试** — 比如 B7 重接 AgentLoop 必须先有 e2e red 测试，不准盲改
6. **任一退化立即 git revert** — 不许带病前进
7. **任一新念头「这一步绿就够了」** → 停手向用户求证

---

## 现在执行 B0.1（守门 #10 修补相对反向引用）

立即开干。
