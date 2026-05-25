# Stage A 盘点 — neptune-engine v2.0 真实状态审计

**审计日期**：2026-05-25
**审计目的**：在动手补缺口之前，先盘点 substrate 真实功能完整性，给出 v2.0 真正完成定义。
**审计方法**：4 个 subagent 并行盘点（功能维度 / cc 设计要素 / 守门设计 / 工具拓扑）+ 主线交叉验证。
**审计结论**：substrate 处于「双轨制」假绿状态。守门 11/11 PASS 是**虚假信号**。需要重大修复。

---

## 一、最致命的发现：双轨制假绿

substrate 当前存在**两条平行轨道**，守门只验左轨「干净度」，不验右轨「集成度」。

```
左轨（守门覆盖，11/11 PASS）：       右轨（守门盲区）：
├─ engine/agent-loop/*    ✓         ├─ AgentEngine.query() 走
├─ engine/run/*           ✓         │    HeadlessQueryEngine 200 行 stub
├─ engine/audit/*         ✓         │    （单轮纯文本，无工具/无 retry/
├─ engine/governance/*    ✓         │     无 fallback/无 audit/无 sub-agent）
├─ engine/sandbox/*       ✓         ├─ AgentRegistry 协议存在但 0 caller
├─ engine/agent-registry  ✓         ├─ AuditStore/RunStore 协议存在但
└─ kernel-protocol tools  ✓         │    AgentEngine 零接入
                                     ├─ BashTool 直调原生 API，绕过 ctx.sandbox
                                     ├─ 相对反向引用 ../../../../../src/...
                                     │    守门 #10 只查 'src/' 没查 ../，漏检
                                     └─ 4 个文件 import 已迁出的工具，已断链
```

**结论**：v2.0 SDK 用户拿到的 substrate，看上去 11/11 干净，但用 `AgentEngine` 跑实际查询时，没有 sub-agent / 没有 skill / 没有 retry / 没有 audit / 没有 sandbox 防护。「干净」是真的，「可用」是假的。

---

## 二、致命漏洞清单（P0 必修）

### P0.1 Agent / Skill 启动能力缺失
- **现象**：substrate 暴露 AgentRegistry / SkillRegistry 协议，但**没有任何工具消费它们去启动 sub-agent / skill**
- **证据**：`grep -r "agentRegistry" packages/builtin-tools/src` → 0 命中（除协议自身）
- **影响**：substrate 内 LLM 看到 DiscoverSkillsTool 列出 skill，但**点不动**（无 SkillTool 启动器）
- **修复**：substrate 内新写 AgentTool 薄壳 + SkillTool 薄壳（基于 AgentLoop + Registry 协议）

### P0.2 AgentEngine 生产路径绕过 substrate
- **现象**：`AgentEngine.query()` 走 `HeadlessQueryEngine.submitMessage()`（200 行 stub），不走 `AgentLoop`
- **证据**：`engine/cc-runtime/HeadlessQueryEngine.ts` 全文 200 行，纯 fetch + text_delta 单轮，0 工具调度 / 0 RunStore / 0 audit
- **影响**：v1.0 完成的 16 个 agent-loop batch（retry / fallback / watchdog / caching / compaction / budget / kernel）全部生产路径**未启用**，只在单测和 examples 内被 invoke
- **修复**：AgentEngine.query 改走 AgentLoop，注入 kernel bag + governance + auditStore + runStore

### P0.3 守门脚本是「形式 PASS 假装功能 PASS」
- **现象**：守门检查项 80% 是 `[ -f file.ts ]` 文件存在 / `grep -q 'Set ANTHROPIC_API_KEY'` env guard，0 项功能契约
- **证据**：
  - `verify-harness-v1.sh:67-86` 7 项 B Gate 都是 `[ -f xxx.ts ]`
  - D.1-D.3 三个 SDK example 仅 grep env 错误信息就判 PASS，AgentLoop 一行没跑
  - 把 SandboxAdapter.ts 清空只留 `export {}`，B 仍全绿
- **影响**：守门绿是假信号，无法保证 substrate 真的可用
- **修复**：升级守门为 5 Gate / 41 项设计，加入功能契约 check

### P0.4 守门 #10 漏检相对反向引用
- **现象**：`packages/builtin-tools/src/tools/{SendMessageTool,BashTool}.ts` 仍有 13+2 处 `from '../../../../../src/...'`，守门 #10 只 grep `^import .*from 'src/'` 没查相对路径
- **证据**（已主线确认）：
  - `SendMessageTool.ts:3-42` — 13 处 `from '../../../../../src/...'`
  - `BashTool.ts:10,69` — 2 处反向 import
- **影响**：守门虚报 PASS；substrate 实际不自闭环
- **修复**：守门 #10 加 `from '\.\./\.\./\.\./\.\./\.\./src/'` 模式

### P0.5 4 个文件断链 import 已迁出工具
- **现象**：以下文件仍 import 已迁出的 AgentTool / NotebookEditTool，编译过靠 TS 不报缺失，运行时一定 broken
- **证据**（已主线确认）：
  - `REPLTool/constants.ts` + `REPLTool/primitiveTools.ts` import AgentTool / NotebookEditTool
  - `FileEditTool/FileEditTool.ts` import NotebookEditTool
  - `GrepTool/prompt.ts` import `../AgentTool/constants.js`
- **影响**：Stage 7 没收尾的债，运行时 import 错误
- **修复**：内联常量 / 移除 dangling import

---

## 三、重要漏洞清单（P1 应修）

### P1.1 SendMessageTool / REPLTool 错位
- 这两个工具是 cc teammate / swarm / replBridge 业务，应迁到 product，不是 substrate 必备
- 证据：`SendMessageTool.ts:3-42` 13 处反向引用 swarm/peerSession；`REPLTool.ts:80-86` 仅 ant-native 可用，substrate 是 stub

### P1.2 Cancellation 链路断裂
- AgentEngine 的 combinedSignal 未传到 submitMessage，bridge 层新建独立 controller 链路断裂

### P1.3 BashTool / FileWriteTool / WebFetchTool 绕过 sandbox
- 直调原生 child_process / fs / fetch，未走 ctx.sandbox
- LocalSandbox 实现完整但实际生产路径绕过

### P1.4 SleepTool 业务耦合
- `feature('PROACTIVE'/'KAIROS')` + `require('src/proactive/...')` 是 cc 业务，应剥到 product hook

### P1.5 Memory 双套 InMemoryMemoryStore
- `engine/memory/` 和 `engine/storage/` 各有同名实现，形状不同，AgentEngine 不注入

---

## 四、v2.0 真正完成定义（建议）

substrate 真正可用、可分发，需要同时满足下面三组：

### A. 功能完整性（P0）
- [ ] **A.1 SDK 用户能 spawn sub-agent**：通过 ctx.kernel.agentRegistry.register 注册 manifest → LLM tool_use(AgentTool) → AgentLoop 起 sub-agent → 返回 result
- [ ] **A.2 SDK 用户能 invoke skill**：注册 SkillManifest → LLM 调 SkillTool → AgentLoop 起 sub-agent 用 skill.prompt
- [ ] **A.3 AgentEngine.query 走 AgentLoop**：retry / fallback / cache / compaction / governance / audit / runStore 全部上线
- [ ] **A.4 BashTool / FileWriteTool / WebFetchTool 走 ctx.sandbox**：默认 NoOpSandbox 透传，product 注入 LocalSandbox 即生效
- [ ] **A.5 Cancellation 链路完整**：abort signal 一路传到 provider 和 dispatcher，无中途断链

### B. 测试覆盖（P0）
- [ ] **B.1 ScriptedProvider e2e**：spawn sub-agent 的端到端测试（不依赖真 API）
- [ ] **B.2 SkillTool e2e**：注册 skill → invoke → 看到 sub-agent assistant message
- [ ] **B.3 AgentEngine e2e**：通过 ScriptedProvider 跑完整 query，验证 RunStore / Audit / Governance 都被触达
- [ ] **B.4 Resume 跨实例**：现有 AgentLoopRunStore.test.ts 加入 AgentEngine 路径
- [ ] **B.5 SDK examples smoke**：USE_SCRIPTED_PROVIDER=1 真跑 1 turn，不是仅查 env

### C. 工程纪律（既有保留）
- [ ] **C.1 守门升级为 5 Gate / 41 项**：A 干净度（保留 11+ 修补 #10）/ B 协议契约（替代文件存在）/ C 工具调度 / D 端到端功能 / E 量化基线
- [ ] **C.2 修补 #10 漏检**：增加 `from '\.\./\.\./...src/'` 检查
- [ ] **C.3 清理 4 处断链**：REPLTool / FileEditTool / GrepTool / BashTool
- [ ] **C.4 baseline 含 packages 测试**：`bun test src packages` 整体不退化

---

## 五、建议的工具拓扑（最终态）

### substrate 保留 22 个工具

| 类别 | 工具 | 数量 | 状态 |
|------|------|------|------|
| 文件 IO | Bash / FileRead / FileWrite / FileEdit / Glob / Grep | 6 | 5 个完整、Bash 待薄壳化 |
| 网络 | WebFetch / WebSearch | 2 | 完整 |
| 代码理解 | LSP | 1 | 完整 |
| MCP 协议薄壳 | MCP / ListMcpResources / ReadMcpResource | 3 | 完整 |
| Kernel 协议薄壳 | TodoWrite / 6 个 Task / ToolSearch / DiscoverSkills / 2 个 Memory | 11 | 完整 |
| **Sub-agent / Skill 启动**（新增 P0）| **AgentTool / SkillTool 薄壳** | **2** | **缺失，待补 ~370 行** |
| 时序原语 | Sleep | 1 | 待剥业务 |

### substrate 移除 2 个

- ❌ **SendMessageTool** → product/cc-tools/SendMessageTool/（cc teammate 业务）
- ❌ **REPLTool** → product/cc-tools/REPLTool/ 或删除（仅 ant-native，substrate 无价值）

### product 保留 / 接收

- AgentTool 5576 行（cc 完整版，作为参考实现 + product 高级形态）
- SkillTool 1109 行（同上）
- NotebookEditTool / McpAuthTool / spawnMultiAgent
- provider/（6 unsupported provider stub）
- + 新接收：SendMessageTool / REPLTool

---

## 六、阶段 B 计划草案（待用户拍板）

| 批次 | 内容 | 预估 | 完成定义 |
|------|------|------|----------|
| **B1** | 修补守门 #10 + 清理 4 处断链 | 1h | 守门升级查相对反向引用，4 个文件 dangling import 全清，11/11 仍 PASS（修补真问题） |
| **B2** | substrate 内补 AgentTool 薄壳 + SkillTool 薄壳（TDD） | 4h | ScriptedProvider 端到端：spawn sub-agent + invoke skill 全跑通，~370 行新增 |
| **B3** | AgentEngine.query 改走 AgentLoop（保留 HeadlessQueryEngine 兼容路径） | 4h | 16 个 agent-loop 能力全部生产路径上线，e2e 测试覆盖 |
| **B4** | SendMessageTool / REPLTool 迁出到 product | 1h | substrate 反向 import = 0（包括相对路径） |
| **B5** | 升级守门为 v2.sh 5 Gate / 41 项 | 3h | 守门 PASS = substrate 真的可用、功能齐全 |
| **B6** | 端到端验证 + 写 v2.1 说明书 | 2h | baseline 跑过，3 个 SDK example 真跑通，文档纠正 v2.0 误导 |
| **总计** | | **~15h** | substrate v2.1 = v2.0 工程干净 + 真正功能完整 |

---

## 七、给用户的请求拍板

请用户对以下 4 项给出回复：

1. **是否同意 v2.0 真正完成定义清单**（A/B/C 三组）？还是有补充？
2. **工具拓扑**：SendMessageTool / REPLTool 迁出，是否同意？
3. **阶段 B 是否按 B1→B6 顺序推进**？或者有其他偏好（如先做 B5 守门让信号准，再做 B2 补能力）？
4. **AgentTool / SkillTool 薄壳的实现路径**：用 substrate `engine/agent-loop` + `agent-registry` + `task-queue` + `skill-registry` 协议组装即可（cc 5576 行**留在 product/cc-tools/ 不动**作参考）。请确认这是预期路径。

阶段 B 不动手，等用户拍板后开干。
