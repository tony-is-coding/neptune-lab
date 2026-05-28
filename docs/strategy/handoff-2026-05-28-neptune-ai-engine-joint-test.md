# Handoff — neptune-ai + neptune-engine 联合测试准备

日期：2026-05-28
当前分支：`codex/engine-decoupling-cleanup`
已合入目标：`develop`
当前 develop HEAD：`a12991a docs(engine): document vendor agnostic provider config`

## 0. 当前结论

`neptune-engine` vendor-agnostic provider cleanup 已经完成并 fast-forward 合入 `develop`。下一阶段应从 `develop` 出发，做一次 `neptune-ai` 与 `neptune-engine` 的联合验证，目标不是继续扩大 engine 重构，而是证明产品层仍能消费新的 engine public surface 与 runtime 行为。

本阶段第一性原则：

- `neptune-engine` 是 Runtime Kernel，只负责模型调用、工具执行、session、MCP、streaming、runtime trace、artifact 与底层 hook。
- `neptune-ai/server` 是产品编排层，负责 AgentOps 平台对象、用户/权限、MCP 注册、Run 编排、审计和产品 API。
- `neptune-ai/web` 是产品体验层，验证用户路径、SSE 渲染、Agent 管理与 Business Workspace。
- 联合测试的主语是 contract 和运行闭环，不是把产品语义重新塞回 engine。

## 1. 已合入 develop 的事实

当前 `develop` 已包含两个本轮提交：

```text
a12991a docs(engine): document vendor agnostic provider config
d60c9f5 refactor(engine): make examples provider vendor agnostic
```

上一轮已完成的验证：

| 区域 | 命令 / 方式 | 结果 |
|------|-------------|------|
| engine typecheck | `cd neptune-engine && bun run tsc --noEmit` | PASS |
| engine tests | `cd neptune-engine && bun test src/engine` | 1306 pass / 0 fail |
| examples scripted smoke | `cd neptune-engine && bash scripts/smoke-scripted.sh` | 3 pass / 0 fail |
| workspace independence | `cd neptune-engine && bash scripts/verify-workspace-independent.sh` | 11/11 |
| substrate v2 | `cd neptune-engine && bash scripts/verify-substrate-v2.sh` | 42/42 |
| true API smoke | local anthropic-compatible proxy | 3/3，含 HTTP + SSE |

重要边界已经落地：

- examples/scripts 不再识别 vendor 名。
- 真 API 接入统一为 `AUTH_MODE` / `API_KEY|AUTH_TOKEN` / `BASE_URL+MODEL`。
- `neptune-engine` package exports 继续保持白名单制。
- API key 没有写入代码、文档或 commit message。

## 2. 下一阶段目标

目标：在 `develop` 上验证 `neptune-ai` 能继续以产品层身份消费 `neptune-engine`，覆盖 server contract、engine workspace dependency、web 用户路径和 SSE 流。

不是目标：

- 不把财务、关账、业务工作台语义下沉到 `neptune-engine`。
- 不为了测试临时恢复 engine wildcard exports。
- 不引入新的 provider vendor 特判。
- 不在文档或测试夹带 API key。

## 3. 建议执行顺序

### 3.1 基线确认

```bash
git status --short --branch
git log --oneline --decorate -5
```

预期：

- 当前在 `develop`。
- HEAD 至少包含 `a12991a` 与 `d60c9f5`。
- 工作区干净。

### 3.2 Engine 侧快速守门

```bash
cd neptune-engine
bun run tsc --noEmit
bun test src/engine
bash scripts/verify-workspace-independent.sh
bash scripts/verify-substrate-v2.sh
```

说明：

- `verify-substrate-v2.sh` 的 examples server smoke 会启动本地 HTTP server；如果沙箱环境禁止端口监听，需要在可监听本地端口的环境重跑。
- engine 侧通过后，不要继续扩大 engine 改动；进入 product 消费验证。

### 3.3 neptune-ai/server 合同验证

```bash
cd neptune-ai/server
bun test
```

重点观察：

- `@neptune/engine` workspace 依赖是否可解析。
- server 是否仍只消费白名单 exports。
- ControlledEngine / run orchestration / audit / governance 相关测试是否因为 engine surface 缩小而断裂。
- 如果测试需要数据库 schema，先记录失败原因，不要把 DB 环境问题误判成 engine contract 问题。

可能需要的环境动作：

```bash
cd neptune-ai/server
bun run db:migrate
```

只有当错误明确指向 schema 缺失时再执行迁移；不要盲目迁移。

### 3.4 neptune-ai/web 类型与 E2E

```bash
cd neptune-ai/web
bun run lint
bun run test:smoke
```

如果 smoke 需要后端：

```bash
cd neptune-ai/server
NEPTUNE_ENGINE_MODE=controlled bun run src/index.ts
```

再在 web 目录跑 Playwright。优先使用 repo 自带的 `neptune-ai/web/playwright.config.ts`，不要套用外部默认端口假设。

### 3.5 联合路径优先级

优先验证这些路径：

1. Server 启动与健康检查。
2. Agent/template/list 或 run-control 相关 API。
3. Chat / Run SSE 是否能从 server 到 web 正确渲染。
4. Governance / human review / audit 事件是否仍可生成与读取。
5. Business Workspace / Close Readiness 页面是否还能看到基于 audit/evidence 的事实链。

## 4. 风险清单

| 风险 | 判断方式 | 处理原则 |
|------|----------|----------|
| product 仍引用被 engine 移除的 root export | `bun test` / `tsc` import error | 优先改 product import 到白名单子入口或 product 模块，不恢复 wildcard exports |
| DB/schema 缺失导致 server test 失败 | 错误含 relation/table/schema 不存在 | 先跑 migration 或记录环境缺口，不改 engine |
| 本地端口监听被沙箱拦截 | Bun server 报 `Failed to start server. Is port ... in use?` 但 lsof 无占用 | 换可监听环境或提权验证，不改 server 逻辑 |
| SSE 断流 | Playwright / curl 可复现 | 先定位 server route 与 stream contract，再看 engine provider event mapping |
| provider env 混乱 | 缺 `MODEL` 或认证 env | 使用 3 类正交 env，不加 vendor fallback |

## 5. 资源位置

- Engine provider cleanup handoff：`docs/strategy/handoff-2026-05-28-vendor-agnostic-provider.md`
- Engine v6.0 当前说明：`docs/neptune-engine-v6.0.md`
- 长期战略源文档：`docs/strategy/neptune-agentops-platform-strategy.md`
- 最初 engine decoupling handoff：`docs/strategy/neptune-engine-decoupling-handover.md`
- Product 边界：`neptune-ai/CONTEXT.md`
- Server 边界：`neptune-ai/server/CONTEXT.md`
- Shared 边界：`shared/CONTEXT.md`
- Engine package exports：`neptune-engine/package.json`

## 6. 接手建议

下一位 agent 建议从 server 开始，不要从 web 截图开始：

1. 确认 `develop` 已在 `a12991a` 或之后。
2. 先跑 engine 快速守门，确认 runtime kernel 仍绿。
3. 跑 `neptune-ai/server` tests，按 import / schema / runtime 三类归因。
4. 再启动 server + web，跑 Playwright smoke。
5. 每修复 20-30 文件以内形成一个可验证 batch；不要一口气做 product + engine 大混改。

如果发现 product 依赖了已经被 engine 移除的内容，默认判断为 product-side migration 候选，而不是 engine 回滚候选。只有当白名单 public API 确实缺失了 runtime kernel 必需能力，才考虑补 engine export。
