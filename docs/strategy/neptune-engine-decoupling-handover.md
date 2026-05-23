# neptune-engine 解耦交付任务清单（Handover）

**文档版本**：v1.0
**最后更新**：2026-05-22
**作者**：交接前的当前贡献者
**适用范围**：接手 `neptune-engine` 拆分工作的工程师
**战略对齐**：`docs/strategy/neptune-agentops-platform-strategy.md` §2.4、§3.3、§3.4

---

## 1. 战略目标（Why）

按 Neptune AgentOps 平台战略文档第 2.4 节与 3.4 节定义：

> **`neptune-engine` 是 Agent Runtime Kernel**，提供可嵌入的通用 Agent runtime：
> 模型调用、工具执行、MCP、streaming、trace、artifact hook、执行生命周期、policy hook / eval hook 的底层接入点。
>
> 它**不理解**：财务关账、会计期间、凭证、科目余额表、关账就绪报告等业务语义。
> 它**不依赖**：产品层（`@neptune/engine-product`、`neptune-ai/server`）的任何对象。

本任务的最终目标可以浓缩为一句话：

> **`@neptune/engine` 能够作为独立 workspace 包被任意上层（neptune-ai/server、第三方 SI 交付环境、未来的 CLI/SDK）嵌入使用，编译期不依赖 product 层任何文件。**

### 1.1 为什么这件事必须做

1. **战略护城河**：Neptune 的护城河是"把不确定的 LLM 行为包进可治理、可交付、可审计、可升级的企业执行协议"。Runtime Kernel 必须可独立打包、可签名、可版本化分发（战略 §5.4），否则升级语义无法成立。
2. **客户私有化部署**：中国企业财务场景要求私有化、专有云、混合部署（战略 §5.2、§8）。engine 与 product 解耦后，才能在客户侧只部署 runtime + 必要 connector，不带产品 SaaS 代码。
3. **责任边界**：战略 §6 的 Shared Responsibility Model 要求平台/方案包/连接器分别签名分发。runtime 必须独立。
4. **Solution Pack 演进**：第一包是中国 ERP 财务关账，后续会有更多行业方案包。runtime 不能因为第一 Solution Pack 而退化成财务专用 SDK。

### 1.2 边界与禁止事项（战略 §10）

- **不得**把任何具体财务语义写入 `neptune-engine`。
- **不得**让 engine 反向依赖 `@neptune/engine-product` 或 `neptune-ai/server`。
- **不得**在 engine 引入 React/Ink 等 UI 框架（这是 builtin-tools 当前的污染源）。
- **不得**把聊天会话作为 engine 的中心对象。
- **必须**保留版本化语义：重要对象不被原地覆盖。

---

## 2. 当前状态（Where we are）

### 2.1 已完成（截至 commit `7aedd41`）

engine **源码层（`neptune-engine/src/engine/`）** 对 `@neptune/engine-product` 的反向依赖已**清零**：

```bash
$ grep -rn "from '@neptune/engine-product" neptune-engine/src/engine/ | grep -v '^[^:]*:[^:]*:\s*["/].*from'
(0 个实际 import)
```

剩余 16 条匹配项全部是文档注释中提到的字符串（说明该类型/函数"从 product 内联而来"），不构成实际依赖。

#### 已完成提交链

| Commit | 内容 |
|---|---|
| `52e5fb1` | 阶段一：清零 19 个 engine 业务文件对 product 的反向依赖（permissions、mcp、SessionContext、CoreAppStateFactory、BaseProvider、OriginalQueryEngineBridge、CCRuntime、UnifiedConfig、ToolAdapter、CoreAppState 等） |
| `4c0242f` | 阶段一收尾：内联 `getEmptyToolPermissionContext`，engine types 层 value import 归零 |
| `5ac826b` | 阶段二 B 类：迁移 `ids/message/systemPromptType` 到 engine 内部 |
| `7aedd41` | 阶段三：删除 6 个无消费桥接文件（fileHistory/attribution/sessionHooks/model/settings/query-engine），内联 command/plugin/tool 三个有消费的桥接文件 |

#### engine/types/ 当前结构

```
src/engine/types/
├── CoreAppState.ts        ✅ 完全内联
├── command.ts             ✅ opaque 最小接口
├── engine-events.ts       ✅
├── ids.ts                 ✅ engine-local
├── index.ts               ✅
├── mcp.ts                 ✅ 完全内联
├── message.ts             ✅ engine-local
├── permissions.ts         ✅ 完全内联
├── plugin.ts              ✅ opaque 最小接口
├── query-events.ts        ✅
├── system-prompt.ts       ✅
├── tool-extension.ts      ✅
└── tool.ts                ✅ 完全内联 + 3 函数实现
```

### 2.2 真实瓶颈（What's blocking）

执行 `cd neptune-engine && bunx tsc --noEmit` 暴露的根本问题：

```
packages/builtin-tools/src/tools/AgentTool/*.ts
  → Cannot find module 'src/bootstrap/state.js'
  → Cannot find module 'src/utils/theme.js'
  → Cannot find module 'src/services/analytics/index.js'
  → Cannot find module 'src/services/mcp/types.js'
  → Cannot find module 'react' / '@anthropic/ink'
```

**真相**：engine 自己干净了，但它通过 `package.json` 依赖的兄弟包 `@neptune/builtin-tools`（和潜在的 `@neptune/mcp-client`、`@neptune/engine-tools`）仍大量**反向引用** product 的 `src/*` 路径与 UI 框架。

```jsonc
// neptune-engine/package.json
"dependencies": {
  "@neptune/engine-product": "workspace:*",   // ⚠️ 应该移除
  "@neptune/engine-tools": "workspace:*",     // ⚠️ 需审计
  "@neptune/builtin-tools": "workspace:*",    // ⚠️ 当前污染源
  "@neptune/mcp-client": "workspace:*",       // ⚠️ 需审计
  ...
}
```

### 2.3 与战略目标的差距矩阵

| 战略要求（§2.4 / §3.4） | 当前状态 | 差距 |
|---|---|---|
| Runtime Kernel 提供通用 agent runtime | ✅ engine 源码已不含业务语义 | engine 兄弟包仍污染 |
| 不理解财务/ERP/关账 | ✅ engine 内部已无业务对象 | — |
| 暴露 `PolicyHook` | ⚠️ 仅有基础 hook 框架 | 需扩展为治理 hook 边界 |
| 暴露 `HumanReviewHook` | ❌ 缺失 | 需新增接口 |
| 暴露 `EvalHook` | ❌ 缺失 | 需新增接口 |
| 暴露 `Artifact` 生成 hook | ⚠️ tool result 已有结构 | 未抽象为 EvidenceArtifact hook |
| `shared` 沉淀跨层契约 | ❌ 大部分缺失 | Run/ToolInvocation/Artifact/AuditEvent 等待落地 |
| engine 可独立 `tsc --noEmit` | ❌ 失败 | builtin-tools 污染 |
| engine 可独立打包发布 | ❌ 失败 | tsconfig / package.json 未隔离 |

---

## 3. 后续任务（What to do）

按优先级与依赖关系排列。任务 ID 与 TaskList 对齐。

### Task #27 ── 清零兄弟包对 product 的反向依赖（P0）

**战略锚点**：§3.4 "engine 不依赖财务对象，不持有产品语义"

**目标**：让 `@neptune/builtin-tools`（以及 `@neptune/mcp-client`、`@neptune/engine-tools` 如有同样污染）不再 `import` 来自 `src/*` 或 `@neptune/engine-product` 的任何模块。

**输入清单**：完整污染列表通过下列命令获得：

```bash
cd /Users/terrence_tan/startups/neptune-lab
grep -rn "from 'src/\|from '@neptune/engine-product" packages/builtin-tools/src/ packages/mcp-client/src/ packages/engine-tools/src/ 2>/dev/null
```

**已知污染类别**（来自当前 `tsc` 错误样本）：

| 类别 | 典型路径 | 处理策略 |
|---|---|---|
| 状态全局单例 | `src/bootstrap/state.js` | DI 注入 `EngineState` 接口（engine 已有） |
| 主题/UI | `src/utils/theme.js`、`react`、`@anthropic/ink` | 移除 UI render 方法到 product 层，engine 只暴露 ToolDef |
| Analytics | `src/services/analytics/*` | 改用 engine 的 `NoOpAnalytics` 抽象 |
| MCP 类型 | `src/services/mcp/types.js` | 已在 `engine/types/mcp.ts` 内联，改 import 路径 |
| Tool 类型 | `src/Tool.js` | 已在 `engine/types/tool.ts` 内联，改 import 路径 |
| Settings | `src/utils/settings/*` | 通过 DI 注入 settings provider，或内联最小子集 |
| 工具实用 | `src/utils/*.js`（log、debug、cwd、path、git） | 引入 `@neptune/engine-utils` 子包或内联到 engine/helpers |
| Permission Mode | `src/utils/permissions/*` | 已在 engine/permissions 内联，改 import 路径 |
| Plans | `src/utils/plans.js` | 业务语义，迁回 product 层（不应在 builtin-tools） |
| Teammate / Mailbox | `src/utils/teammate*.js` | 业务语义，迁回 product 层 |

**实施步骤**：

1. **审计清单**：跑上述 grep 命令，列出全部反向依赖（按文件分组）。
2. **分类**：按上表分类标记每条依赖（型号：迁入 engine / 移除 UI / DI 注入 / 迁回 product）。
3. **逐文件处理**：
   - UI 类（React/Ink、`renderToolUseMessage`、`renderToolResultMessage` 等）→ 从 builtin-tools 移除，迁到 `neptune-ai/server/ui-adapters` 或 product 层。
   - 业务类（plans、teammate、coordinator）→ 整文件迁出 builtin-tools 到 product 层。
   - 通用工具类 → 在 engine/helpers 或新建 `@neptune/engine-utils` 内联。
   - 状态访问 → 通过 ToolUseContext 接收依赖，不再 import 全局单例。
4. **修复测试**：builtin-tools 自己的测试如果依赖 product，迁出或改用 engine-local 替代。

**验收标准**：

```bash
# 1. 全局检查无反向依赖
cd /Users/terrence_tan/startups/neptune-lab
grep -rn "from 'src/\|from '@neptune/engine-product" packages/builtin-tools/src/ packages/mcp-client/src/ packages/engine-tools/src/
# 期望输出：（空）

# 2. 各兄弟包可独立编译
cd packages/builtin-tools && bunx tsc --noEmit  # 期望：0 error
cd packages/mcp-client && bunx tsc --noEmit     # 期望：0 error
cd packages/engine-tools && bunx tsc --noEmit   # 期望：0 error
```

**预计工作量**：3-5 天（涉及 30+ 个 builtin-tools 文件的逐个解耦，UI 方法迁移最耗时）

**风险点**：
- builtin-tools 的 UI render 方法被 product 层 React 组件直接使用，迁移路径需要先在 product 层建立 "tool UI adapter" 反查表。
- `AgentTool` 内嵌的 builtInAgents/exploreAgent/planAgent 依赖大量 product 单例，可能需要整体迁回 product 层并通过工具注册接口在 runtime 注入。

---

### Task #28 ── engine 独立编译验证 + workspace 依赖清理（P0）

**战略锚点**：§3.4 "提供可嵌入的 Agent runtime"、§5.4 "Signed Package"

**前置条件**：Task #27 完成。

**目标**：
1. `neptune-engine` 包可在不依赖 product 源码的前提下完成 `tsc --noEmit`。
2. `package.json` 不再声明对 `@neptune/engine-product` 的 workspace 依赖。
3. CI 增加独立编译验证步骤，防止回归。

**实施步骤**：

1. **清理 package.json**：
   ```jsonc
   // 移除：
   "@neptune/engine-product": "workspace:*"
   ```
   保留：`@neptune/engine-tools`、`@neptune/builtin-tools`、`@neptune/mcp-client`（前提是 Task #27 已让它们独立）。

2. **更新 package.json description**：
   ```jsonc
   // 当前描述提到 "Retains a transitional reverse-dependency on @neptune/engine-product ... to be cleared in spec phase 2"
   // 应更新为："Independent agent runtime kernel. Zero reverse dependency on product layer."
   ```

3. **tsconfig 隔离**：
   - 检查 `neptune-engine/tsconfig.json` 是否包含通配符引用 product 路径（`include`、`paths`）。
   - 设置 `"composite": true`，方便后续 project references。

4. **CI 编译验证**：在仓库 CI 配置（GitHub Actions / 现有 hooks）增加：
   ```yaml
   - name: Verify engine independent compile
     run: cd neptune-engine && bunx tsc --noEmit
   ```

5. **回归防护脚本**（可选但推荐）：在 `neptune-engine/scripts/` 增加 `verify-no-reverse-dep.sh`：
   ```bash
   #!/usr/bin/env bash
   set -e
   matches=$(grep -rn "from '@neptune/engine-product" src/ | grep -v "^[^:]*:[^:]*:\s*[/*]" || true)
   if [ -n "$matches" ]; then
     echo "反向依赖检测失败："
     echo "$matches"
     exit 1
   fi
   ```

**验收标准**：

```bash
cd /Users/terrence_tan/startups/neptune-lab/neptune-engine

# 1. 独立 tsc 通过
bunx tsc --noEmit
# 期望：exit 0，无 error

# 2. package.json 不含 product 依赖
grep "engine-product" package.json
# 期望：（空）

# 3. 独立测试通过
bun test
# 期望：所有测试通过
```

**预计工作量**：0.5-1 天

---

### Task #29 ── shared 契约层落地（P0）

**战略锚点**：§3.3 "承载稳定协议，而不是承载业务行为"、§9.1 关账主路径

**目标**：在 `packages/shared`（或新建 workspace 包）固化跨层契约对象，避免 web/server/engine 各自定义一套类型导致漂移。

**对象清单**（按战略文档 §3.3）：

| 对象 | 用途 | 第一阶段必需性 |
|---|---|---|
| `Run` | Agent 执行的核心事实对象 | ✅ 必需 |
| `ToolInvocation` | 单次工具调用记录 | ✅ 必需 |
| `Artifact` | 通用产物 | ✅ 必需 |
| `EvidenceArtifact` | 受审计的证据子类型 | ✅ 必需 |
| `AuditEvent` | append-only 审计事件 | ✅ 必需 |
| `PolicyDecision` | 策略引擎决策记录 | 中期 |
| `HumanReview` | 人工复核/审批记录 | ✅ 必需（关账场景） |
| `EvalRun` | 评估运行 | 中期 |
| `ReleaseVersion` | 版本发布记录 | 中期 |
| `UsageRecord` | 用量与成本记录 | 中期 |

**实施步骤**：

1. **确认承载位置**：检查现有 `packages/shared`（若存在）的结构，确认 schema 文件夹路径。若不存在，新建。
2. **逐对象定义 zod schema**：每个对象一个文件，结构示例：
   ```ts
   // packages/shared/src/contracts/Run.ts
   import { z } from 'zod'

   export const RunSchema = z.object({
     id: z.string().uuid(),
     projectId: z.string(),
     agentTemplateVersion: z.string(),
     status: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled']),
     startedAt: z.string().datetime(),
     endedAt: z.string().datetime().optional(),
     // ...
   })
   export type Run = z.infer<typeof RunSchema>
   ```
3. **优先级排序**：先做关账主路径必需的 5 个（Run、ToolInvocation、Artifact、EvidenceArtifact、AuditEvent、HumanReview）。
4. **导出契约**：在 `packages/shared/src/index.ts` 统一导出。
5. **改造 engine hook 边界**：engine 的 ArtifactHook、PolicyHook 等接口使用 shared 类型作为输入输出（依赖关系：shared ← engine ← server）。
6. **文档**：在 `packages/shared/README.md` 写明"这是稳定协议层，不承载业务行为"。

**验收标准**：

```bash
# 1. 契约定义存在
ls /Users/terrence_tan/startups/neptune-lab/packages/shared/src/contracts/
# 期望：Run.ts ToolInvocation.ts Artifact.ts EvidenceArtifact.ts AuditEvent.ts HumanReview.ts

# 2. shared 独立编译
cd packages/shared && bunx tsc --noEmit
# 期望：exit 0

# 3. engine 引用 shared 通过
cd neptune-engine && grep -rn "from '@neptune/shared" src/engine/ | head -5
# 期望：engine 的 hook 边界已开始使用 shared 契约
```

**预计工作量**：1-2 天

**注意**：契约一旦发布到 server/engine/web，breaking change 成本高。设计 schema 时优先考虑向前兼容性（如使用 `.passthrough()`、避免 union 收紧）。

---

### Task #30 ── engine 暴露 PolicyHook / HumanReviewHook / EvalHook 边界（P1）

**战略锚点**：§2.4 "engine 理解 PolicyHook / HumanReviewHook / EvalHook"

**前置条件**：Task #29 完成（依赖 shared 类型）。

**目标**：engine 提供三类治理 hook 接口，server 侧 AgentOps Core 通过实现这些接口注入治理能力。engine 自身**不实现**任何业务策略。

**接口设计**（草案，最终签名以实施时确认）：

```ts
// neptune-engine/src/engine/hooks/governance.ts
import type { PolicyDecision, HumanReview, EvalRun, ToolInvocation } from '@neptune/shared'

/** 工具调用前注入策略决策 */
export interface PolicyHook {
  beforeToolUse(invocation: ToolInvocation): Promise<PolicyDecision>
  // decision.behavior: 'allow' | 'deny' | 'require_review'
}

/** Finding 产生后挂起等待人工复核 */
export interface HumanReviewHook {
  requestReview(input: {
    runId: string
    findingId: string
    severity: 'low' | 'medium' | 'high'
    evidence: string[]   // artifact ids
  }): Promise<HumanReview>
}

/** Run 完成后触发评估 */
export interface EvalHook {
  onRunComplete(runId: string, runResult: unknown): Promise<EvalRun | null>
}
```

**实施步骤**：

1. **设计接口**：在 `engine/hooks/governance.ts` 定义三类 hook 接口。
2. **集成到 AgentEngine**：在 `AgentEngine` 或 `Session` 构造参数中接收可选 hook 实现。
3. **运行时调用点**：
   - `PolicyHook.beforeToolUse`：在 ToolAdapter 调用真实 tool.call 前调用。
   - `HumanReviewHook.requestReview`：留接入点，由上层在生成 finding 时主动调用（engine 不知道 finding 是什么，只提供异步等待机制）。
   - `EvalHook.onRunComplete`：在 Session 完成时触发。
4. **测试**：编写 mock hook 实现的单元测试，验证 engine 正确调用接口。

**验收标准**：

```bash
# 1. 接口定义存在
cat /Users/terrence_tan/startups/neptune-lab/neptune-engine/src/engine/hooks/governance.ts
# 期望：包含三类 hook 接口

# 2. 单测覆盖
cd neptune-engine && bun test src/engine/__tests__/hooks/governance.test.ts
# 期望：mock hook 被正确调用

# 3. engine 自身仍可独立编译
bunx tsc --noEmit
# 期望：exit 0
```

**预计工作量**：1-2 天

---

### Task #31 ── engine ArtifactHook：可审计 EvidenceArtifact 边界（P1）

**战略锚点**：§2.4 "engine 理解 Artifact"、§6 责任边界（审计事实）

**前置条件**：Task #29 完成。

**目标**：engine 在 tool result 转换阶段触发 ArtifactHook，server 侧据此生成 EvidenceArtifact 并写入 artifact store。engine 自身**不持久化** artifact 内容。

**接口设计**（草案）：

```ts
// neptune-engine/src/engine/hooks/artifact.ts
import type { EvidenceArtifact } from '@neptune/shared'

export interface ArtifactInput {
  runId: string
  toolInvocationId: string
  source: {
    toolName: string
    inputSnapshot: unknown    // 工具入参快照
    agentTemplateVersion: string
    connectorVersion?: string
  }
  content: ArrayBuffer | string  // engine 只暴露内容，不写入
  mime: string
  hint?: 'voucher' | 'balance' | 'invoice' | 'bank_receipt' | 'attachment' | string
}

export interface ArtifactHook {
  /** 由 server 实现：写入 artifact store 并返回带 id/hash 的 EvidenceArtifact */
  persistArtifact(input: ArtifactInput): Promise<EvidenceArtifact>
}
```

**关键设计原则**：

- engine **不计算 hash**，不持久化，不知道存储位置。
- engine 只负责**触发时机**和**结构化字段透传**（来源、版本、来源工具入参快照）。
- server 实现 hook 时计算 hash、写入存储、生成 EvidenceArtifact，回传给 engine 用于后续 trace 关联。

**实施步骤**：

1. **设计接口**：在 `engine/hooks/artifact.ts` 定义 ArtifactHook 与 ArtifactInput。
2. **触发点**：在 ToolAdapter 的 result 处理路径中，识别需要产出 artifact 的 tool（通过 tool metadata 或 result hint），调用 hook。
3. **关联 trace**：将 hook 返回的 EvidenceArtifact id 写入 ToolInvocation 记录。
4. **测试**：mock ArtifactHook，验证 input 字段完整、hook 被调用次数正确。

**验收标准**：

```bash
# 1. 接口存在且引用 shared 类型
cat neptune-engine/src/engine/hooks/artifact.ts | grep -E "ArtifactHook|EvidenceArtifact"
# 期望：定义存在

# 2. 单测覆盖触发点
bun test src/engine/__tests__/hooks/artifact.test.ts
# 期望：mock hook 在 tool result 阶段被调用

# 3. ToolInvocation 含 artifact 关联
grep "artifactIds" neptune-engine/src/engine/types/ src/engine/bridge/
# 期望：ToolInvocation 类型包含 artifactIds 字段
```

**预计工作量**：1-2 天

---

## 4. 任务依赖图

```text
#27 清零 builtin-tools 反向依赖（P0）
    │
    ▼
#28 engine 独立编译验证（P0）

#29 shared 契约层（P0，可与 #27 并行）
    │
    ├──▶ #30 治理 hook（P1）
    │
    └──▶ #31 artifact hook（P1）
```

**关键路径**：#27 → #28 决定 engine 是否能宣告"独立编译完成"。
**并行机会**：#29 可与 #27 同时进行（无源码冲突）。
**后置项**：#30/#31 不阻塞 engine 独立编译，但阻塞 server 侧 AgentOps Core 实现。

---

## 5. 任务跟踪表（一页式）

| ID | 任务 | 优先级 | 工作量 | 战略锚点 | 前置 | 状态 |
|---|---|---|---|---|---|---|
| #27 | 清零 builtin-tools / mcp-client / engine-tools 对 product 的反向依赖 | P0 | 3-5d | §3.4 | — | 🔲 待开始 |
| #28 | engine 独立 tsconfig + CI 编译验证 + 移除 product workspace 依赖 | P0 | 0.5-1d | §3.4, §5.4 | #27 | 🔲 待开始 |
| #29 | shared 契约层：Run/ToolInvocation/Artifact/EvidenceArtifact/AuditEvent/HumanReview | P0 | 1-2d | §3.3, §9.1 | — | 🔲 待开始 |
| #30 | engine 暴露 PolicyHook / HumanReviewHook / EvalHook | P1 | 1-2d | §2.4 | #29 | 🔲 待开始 |
| #31 | engine ArtifactHook：EvidenceArtifact 边界 | P1 | 1-2d | §2.4, §6 | #29 | 🔲 待开始 |

**总预估工作量**：6.5-12 个工作日（单人）

---

## 6. 交接附件与参考

### 6.1 已有提交
- 当前工作分支：`develop`
- 主分支：`feat/threads-system`
- 关键提交（最近 → 最早）：`7aedd41`、`4c0242f`、`52e5fb1`、`5ac826b`、`b694199`

### 6.2 参考文档
- 战略主文档：`docs/strategy/neptune-agentops-platform-strategy.md`
- 仓库结构 ADR：`docs/adr/0001-mono-repo-structure.md`
- Git workflow：`docs/governance/git-workflow.md`

### 6.3 关键命令速查

```bash
# 全局检查 engine 内反向依赖（应为 0 个 import）
grep -rn "from '@neptune/engine-product" neptune-engine/src/engine/ | grep -v '^[^:]*:[^:]*:\s*[/*"]'

# 检查兄弟包污染（Task #27 起点）
grep -rn "from 'src/\|from '@neptune/engine-product" packages/builtin-tools/src/ packages/mcp-client/src/ packages/engine-tools/src/

# engine 独立编译（Task #28 验收）
cd neptune-engine && bunx tsc --noEmit

# engine 测试
cd neptune-engine && bun test
```

### 6.4 设计禁区提醒

> 战略文档 §10 的 8 条强制约束必须每次设计时重读。尤其是：
> - 不得把财务语义写入 engine
> - 不得让 Solution Pack 与 Platform Core 边界混乱
> - 必须保留持续可升级语义

---

## 7. 风险与开放问题

| 风险 | 影响 | 当前判断 |
|---|---|---|
| Task #27 工作量被低估：builtin-tools 内的 AgentTool/ExitPlanModeTool 等深度耦合 product 的 React UI | 拖慢 engine 独立编译里程碑 | 必要时拆分子任务：UI 方法迁出可优先，业务 agent 迁回 product 可滞后 |
| shared 契约 schema 一旦定型，后续 breaking change 成本高 | 长期维护负担 | Task #29 实施时邀请 server 团队 review；首版 schema 保守、可扩展 |
| engine 独立后，product 是否还需要保留 engine 的代码副本（历史兼容） | 影响 product 侧重构节奏 | 由 product 团队独立决策，不阻塞 engine 任务 |
| 治理 hook（#30）的异步等待语义（HumanReview）如何持久化跨进程会话 | runtime/server 协议复杂度 | 第一阶段允许 hook 实现为 server 内存阻塞 + 数据库轮询；后续替换为事件总线 |

---

**文档结束。如有疑问，先重读 `docs/strategy/neptune-agentops-platform-strategy.md`，再回到本文档查任务。**
