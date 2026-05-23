# Neptune Engine 剥离 · 测试交付报告

日期：2026-05-22
范围：spec 阶段一全部完成 + Stage P1 收尾
相关 spec：`docs/superpowers/specs/2026-05-21-neptune-engine-harness-extraction-design.md`

---

## 一句话状态

Neptune Engine 已物理剥离为独立 workspace `@neptune/engine`，server 端完成切换并通过全套自动化测试。运行时与 baseline 行为等价，可以递交测试 + 推进 server 层产品演进。

---

## 一、当前可测试的功能

### 1.1 必测（QA 必须验证）

这一节是 **必须挂上 QA 流水线的回归套件**。每一项都已经在迁移末态通过本地自动化，但 QA 应在干净环境再跑一次。

| 类别 | 用例 | 期望 | 备注 |
|---|---|---|---|
| **后端单元** | `cd neptune-ai/server && bun test` | 275 pass / 0 fail | 22 个 test 文件，含 thread-manager、controlled-engine、permission delegate、engine factory、prompt assembler 等 |
| **健康检查** | `GET /health`、`GET /health/db` | 200 OK | server 启动后 ≤ 15s 内可达 |
| **登录鉴权** | `POST /auth/login` + `POST /auth/register` | 标准凭据可登录、错误凭据 401、注册 201 | 用 `e2e@neptune.ai / NeptuneE2E2026!` |
| **Agent / Thread 列表** | `GET /agents`、`GET /agents/:id/threads` | 列表返回 + 分页/筛选参数 | |
| **Thread CRUD** | `POST /agents/:id/threads`、`PATCH`、`GET /:tid/history` | 201/200，包括 not-found、bad-uuid、无权限 401 | |
| **聊天链路（controlled）** | `POST /agents/:id/threads/:tid/chat` 触发 SSE | 应返回 `E2E OK: controlled model dispatch is healthy. Received "..."...`；执行 `E2EControlledTool`；SSE 闭流 | 必须设 `NEPTUNE_ENGINE_MODE=controlled`，否则会真请求 LLM provider |
| **聊天链路（真实 LLM）** | 同上但去掉 controlled 模式 + 配置真 ANTHROPIC_API_KEY | 真模型返回 | 选测，需要走外部 API |

### 1.2 浏览器自动化套件

```bash
# Terminal A：启 server
cd neptune-ai/server
NEPTUNE_ENGINE_MODE=controlled bun run src/index.ts

# Terminal B：启 web
cd neptune-ai/web
bun run dev

# Terminal C：跑 e2e
cd neptune-ai/web
bunx playwright test
```

期望：**26 passed**

覆盖：
- `smoke.spec.ts`（3）：基本页面 + JS error free + 未登录跳转
- `auth.spec.ts`：登录、登录失败、刷新保持、401 自动恢复
- `navigation.spec.ts`：侧边栏、active 高亮
- `agent-config.spec.ts`：Agent 列表、切换
- `collaborate.spec.ts`：协作页面、agent detail、agent switching
- `controlled-chat.spec.ts`：**关键**，含 SSE 流、工具 UI、completion 状态、history
- `advanced-chat.spec.ts`：ask_user、artifact、plan progress、reload 恢复
- `thread-stability.spec.ts`：多 thread 历史切换
- `sse-recovery.spec.ts`：用户停止慢流后能继续输入
- `api-alignment.spec.ts`：前端 API 调用诊断
- `bug2-refresh-fix.spec.ts`：历史回归用例

### 1.3 各 stage 单独冒烟

如果 QA 想验证哪一层最容易出问题，按这个顺序排雷：

1. **Stage 1（包名整改）**：grep `claude-code-best` 三仓应 = 0；grep `@claude-code-best` 应 = 0。
2. **Stage 2（物理改名）**：`ls neptune-engine` 仅含 `package.json / src / packages / README.md / tsconfig.json / node_modules`；`ls neptune-engine-product` 含 `src + packages + 全部 fork 文件`。
3. **Stage 3（facade）**：`grep "@neptune/engine" neptune-ai/server/src/**/*.ts` 应 10 处，全部 `@neptune/engine` 或 `@neptune/engine/permissions`。
4. **Stage 4-7（K + K-DEFAULT 包）**：`ls neptune-engine/packages` 应有 `agent-tools / builtin-tools / mcp-client`；product 那边应已无这三个。
5. **Stage 8（src/engine 迁回）**：`ls neptune-engine/src/engine | wc -l` 应 ≈ 25 个子项；`ls neptune-engine-product/src` 应**不含** `engine/` 目录。
6. **Stage P1（engine typecheck baseline 化）**：`cd neptune-engine && bunx tsc --noEmit | grep -c 'error TS'` 应 = 371。等于 product 仓的 baseline。

### 1.4 已知限制（不算 bug）

这些是 **fork 自带或 spec 接受的债务**，**不应作为缺陷反馈**：

- **typecheck 错误**：engine 仓 371 + server 仓 21，与 baseline 相同或更少。这些是 fork 自带的 strict 类型问题（如 `formData` 缺失、`drizzle.eq` 类型、SQLiteSessionStore 的 SQLQueryBindings 等），不影响 runtime。spec 阶段二/三随 B 类拆分与 CC fork 重写会自然消除。
- **engine 仓反向 import product**：engine 内含 ~103 处 `@neptune/engine-product/*`（Tool.ts、utils、types、services 等），是 spec 3.2 节明确列出的 "K-DEFAULT 含债务"。运行时正确，spec 阶段二拆 B 类后归零。
- **`neptune-engine-product/src/index.ts`** 没有外部消费者：是 fork 历史保留，spec 阶段四再清理。不要因为它存在就误以为 product 还在做 SDK 角色——SDK 角色由 `@neptune/engine` 承担。
- **engine builtin-tools 内部 strict TS 错误**：在 Stage P1 跑 typecheck 时会看到 ~1700 条；这些是 fork 自带的工具实现内的 strict 问题，**baseline 时 product 仓也是同样状态**，不影响 runtime。

---

## 二、可演进的 Server 层产品能力

剥离让 server 层得到了**接口稳定、命名规范、可独立演进**的 engine SDK。下面列**已具备演进基础**的产品方向。每一条都标了 "engine 端是否需要配合"，让 server 团队判断独立做 vs 协同做。

### 2.1 立刻可做（不依赖 engine 变化）

这一组是 **纯 server 层创新**，engine 提供的接口已经够用。

| 方向 | 价值 | 切入点 | engine 配合 |
|---|---|---|---|
| **多租户隔离强化** | 让一个 server 实例稳跑多组织 | `TenantPermissionDelegate` 已经做到工作区/文件路径/MCP server name 隔离；可加配额、资源限制、审计日志、工作区 quota | ❌ 不需要 |
| **会话编排升级** | 长会话、并行、暂停、续聊 | `engine.pauseSession / resumeSession` 已实现，server 层加 thread 级 lifecycle + 自动续聊策略 | ❌ |
| **可观测性深化** | 把 Langfuse trace 与 request_id、tenant、thread、provider call 全链贯通 | `ITracingProvider` 接口已注入；server 实现的 `LangfuseTracingProvider` 已可扩展 span attribute | ❌ |
| **错误信封统一** | 给前端统一的错误协议 | server 端补 `ApiError` 字段（code、retry_after、display_hint），engine 抛出的 `EngineError` 已有 `EngineErrorCode` 可映射 | ❌ |
| **SSE 协议演进** | 加 progress、artifact、ask_user 等结构化事件 | engine 的 `QueryEvent` 已有 typed 分流（AssistantText / ToolUse / ToolResult / System / Error），server 的 `sse-event-mapper` 可加字段 | ❌ |
| **Agent 配置版本化** | 让运营改 Agent 配置不破坏旧 thread | server 数据库加版本字段；engine 创建 session 时拍照 Agent 配置 | ❌ |
| **Memory 管理面** | 给运营查看/编辑用户记忆 | engine 已通过 `services/SessionMemory` 提供存储；server 加 REST CRUD + 前端 UI | ❌ |
| **Skill 上架与管理** | 让运营动态上下架 skill | engine `SkillExtension` 接口已有；server 加 skill registry + ASR / 类目 | ❌ |
| **审计日志 + 合规导出** | 企业合规必备 | `AuditPermissionDelegate` 已有；server 加结构化审计流 + 导出 API | ❌ |
| **配额 / 计费** | 商业化基础 | engine 的 `query` 已发 `modelUsage` 事件；server 接 `engine.on("query:complete", ...)` 累计 token | ❌ |
| **多用户协作 Thread** | 一个 thread 多用户参与 | server 加协作模型；engine 不感知用户身份，只看 workspace | ❌ |
| **工作流编排** | 让 agent 串成 DAG | engine 已支持 sub-agent（LocalAgentTask）；server 包一层 workflow runner | ❌ |

### 2.2 短期可做（engine 微调）

这一组是 **server 主动做、engine 配合开放扩展点**。

| 方向 | engine 需要做什么 |
|---|---|
| **多 provider 路由** | engine 已有 ProviderRegistry，每 session 可覆盖；server 加路由策略（按 tenant / 按用量 / fallback）。engine 端可能要补 "provider rate limit" 事件 |
| **流式工具执行** | engine 的 ToolUse / ToolResult 是分两步发出的，server 可加中间 "tool:progress" 事件，需要 engine 在 ToolExtension 里暴露 progress 回调 |
| **持久化存储后端** | engine 接口 `ISessionStore / ISessionContentStore / IMemoryStore / IBackend` 已成型，但需要 server 端实现 Postgres / Redis 版本（PgSessionStore / PgContentStore / RedisMemoryStore 已有，验证补 server 落地） |

### 2.3 中期可做（engine 阶段二/三完成后）

这一组要**等 engine spec 阶段二（B 类拆分）或阶段三（CC fork 重写）落地**才解锁。

| 方向 | 阻塞点 |
|---|---|
| **轻量 Embedded Engine（headless 跑路）** | 阶段三 — 把 CC fork 的 QueryEngine 替换成 engine kernel 自带的轻量 loop，去掉 ~30 万行 fork |
| **Tool/Permission 接口稳定** | 阶段二 — 把 Tool.ts / Task.ts / commands.ts 等 B 类拆出净化版到 engine，engine 不再反向 import product |
| **engine 1.0 公开 SemVer** | 阶段五 — 接口契约文档、向后兼容承诺、第三方接入指南 |

---

## 三、给 QA 的递交清单

请按这个顺序检查：

1. **拉最新 develop 分支**（最新 commit 应是 `18e0c20 chore(engine-extraction): Stage P2 配套清理`）。
2. **干净 install**：
   ```bash
   # 如果你不在公司内网，需要先把 ~/.npmrc 的 registry 切到 npmmirror 或 npmjs.org
   bun install
   ```
3. **后端单测**：
   ```bash
   cd neptune-ai/server && bun test
   # 期望: 275 pass / 0 fail
   ```
4. **数据库准备**（如果未跑过 seed-e2e）：
   ```bash
   cd neptune-ai/server
   bun run db:migrate
   bun src/scripts/seed-e2e.ts   # 灌入 e2e@neptune.ai 用户 + E2E Assistant
   ```
5. **启动两个服务**（两个 terminal）：
   ```bash
   # Terminal A
   cd neptune-ai/server && NEPTUNE_ENGINE_MODE=controlled bun run src/index.ts
   # Terminal B
   cd neptune-ai/web && bun run dev
   ```
6. **跑 E2E**：
   ```bash
   cd neptune-ai/web && bunx playwright test
   # 期望: 26 passed
   ```
7. **手动 smoke**（浏览器开 http://localhost:3004）：
   - 登录 `e2e@neptune.ai / NeptuneE2E2026!`
   - 进入任一 Agent，发一句话 `controlled health check`
   - 应看到 SSE 流出 `E2E OK: controlled model dispatch is healthy`
   - 刷新页面，历史保留
   - 切换 Agent，新 thread 行为正常

如有任何**未列在第 1.4 节已知限制**里的偏差，提单到 develop 分支。

---

## 四、给 server 团队的演进起手式

建议的优先级（基于 ROI）：

1. **【一周内】 错误信封统一 + SSE 事件协议补全** —— 让前端开发体验立刻提升
2. **【两周内】 Langfuse trace 全链贯通 + 配额事件接入** —— 商业化前提
3. **【一月内】 Agent 配置版本化 + Memory / Skill 管理面** —— 运营可控
4. **【与 engine 协同】 等阶段二完成后启动多 provider 路由 + 流式工具执行**

每条都可独立成 spec / writing-plans 项目走完整流程。

---

## 五、Engine 团队后续要做的（与 server 解耦）

（这部分写给我自己，你不用看）

按 spec 后续阶段推进：

- **阶段二**：B 类拆分（Tool.ts → Task.ts → tasks.ts → commands.ts → services/{tools, compact, SessionMemory, AgentSummary}）。每个文件单独走 plan-phase，"接口去 engine、实现留 product" 四步。
- **阶段三**：CC fork 重写。把 product/cc-runtime/ 用 engine kernel 重写，把 30 万行 fork 收敛为轻量 query loop + 真实接入点。
- **阶段四**：可选 product 解耦（cli / observability / @ant 分仓）。
- **阶段五**：engine 1.0 SemVer + 接口契约 + 接入指南。

阶段二可与 server 团队并行（双方不互相阻塞，靠接口约定协作）。
