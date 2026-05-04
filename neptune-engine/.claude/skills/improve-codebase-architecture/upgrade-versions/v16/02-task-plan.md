# V16 任务计划：V5 最后 5% 交付

> 版本：V16
> 计划日期：2026-04-28
> 基于：`auto-upgrade/v16/01-optimizer-research.md`

---

## 一、项目概述

V16 目标是完成 OKR V5 剩余 5%，交付 3 个必须项 + 1 个可选项：

1. TypeDoc API 文档生成（KR1 + KR10）
2. 快速开始指南 + 3 个示例（KR2）
3. query 互斥保护（KR20）
4. SQLite 异步化（可选增强）

完成后 V5 进度从 ~95% → **100%**。

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 协作方式 |
|------|------|------|----------|
| team-lead | 1 | 协调任务分配、进度管理、最终 merge | 全程监控，审核产出 |
| developer-1 | 1 | 代码改动：query 互斥保护 + SQLite 异步化 | 独立完成 Opt 3 + Opt 4 |
| developer-2 | 1 | 文档与配置：TypeDoc + 快速开始指南 | 完成 Opt 1 + Opt 2 |

**共 3 个 agent**，developer-1 和 developer-2 可并行工作。

---

## 三、任务阶段规划

### 阶段 A：并行执行（T1 + T2 同时进行）

- T1: query 互斥保护（developer-1）
- T2: TypeDoc API 文档配置（developer-2）

**小目标**：代码安全 + API 文档基础到位

### 阶段 B：顺序执行（T1 完成后 T3，T2 完成后 T4）

- T3: SQLite 异步化（developer-1，依赖 T1 完成）
- T4: 快速开始指南 + 3 个示例（developer-2，依赖 T2 完成）

**小目标**：增强 + 用户指南到位，V5 100%

---

## 四、任务清单

| 编号 | 任务名称 | 任务目标 | 依赖 | 执行人 | 验收标准 |
|------|----------|----------|------|--------|----------|
| T1 | query 互斥保护 | 同一 Session 并发 query 抛出明确错误 | 无 | developer-1 | 1. `AgentEngine.query()` 添加 per-session 互斥锁（`Map<sessionId, boolean>`）<br>2. 重复调用抛出 `EngineError(SESSION_BUSY, "Session 'xxx' already has an active query")`<br>3. query 完成（含 abort/异常）后 finally 块自动释放锁<br>4. 新增 3+ 测试用例覆盖并发场景 |
| T2 | TypeDoc API 文档配置 | SDK 公共 API 文档可一键生成 | 无 | developer-2 | 1. `claude-code/typedoc.json` 配置完成，与 Bun TS 兼容<br>2. `bun run docs:api` 可成功生成文档到 `docs/api/`<br>3. engine/ 公共 API 文档覆盖率 100%（所有 export 的 class/interface/function）<br>4. `docs/api/index.html` 入口可访问 |
| T3 | SQLite 异步化 | SQLite 操作不阻塞事件循环 | T1 | developer-1 | 1. `SQLiteSessionStore` 的 save/load/list/delete 使用非阻塞包装<br>2. 构造函数 PRAGMA 添加错误处理<br>3. `close()` 添加幂等性保护<br>4. 现有测试全部通过 |
| T4 | 快速开始指南 + 3 个示例 | 新用户 30 分钟内从零跑通 Agent 交互 | T2 | developer-2 | 1. `docs/getting-started.md` 完整指南（安装 → 配置 → 第一个 Agent → 事件处理）<br>2. `docs/examples/01-embedded-sdk.md` — 嵌入式 SDK 示例（Node.js 脚本）<br>3. `docs/examples/02-web-service.md` — Web 服务示例（Express + SSE）<br>4. `docs/examples/03-cli-tool.md` — CLI 工具示例（headless 自动化）<br>5. 每个示例可直接复制运行，无遗漏步骤 |

---

## 五、依赖关系图

```
T1 (query互斥) ──→ T3 (SQLite异步)
    └── 独立

T2 (TypeDoc) ──→ T4 (快速开始指南)
    └── 文档先到位，示例才能引用 API 文档

并行：T1 ‖ T2
```

**关键路径**：T2 → T4（TypeDoc 是示例文档的前置）

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| TypeDoc 与 Bun TS 不兼容（V14 已踩坑） | T2/T4 阻塞 | 先用 `tsc --declaration` 生成 `.d.ts`，再 TypeDoc 解析；备选用 API Extractor |
| SESSION_BUSY 错误码行为与 abort 冲突 | T1 回退 | 测试覆盖 abort 场景，确保 finally 块在 abort 后也能释放锁 |
| 快速开始指南示例无法直接运行 | T4 交付质量差 | 每个 example 必须经过实际验证，引用真实 API 签名 |

---

## 七、OKR 对齐

| KR | 任务 | 完成后状态 |
|----|------|-----------|
| KR1: API 文档覆盖全部公共方法 | T2 | ✅ 完成 |
| KR2: 快速开始指南 + 3 个示例 | T4 | ✅ 完成 |
| KR10: TypeDoc 配置与生成 | T2 | ✅ 完成 |
| KR20: query 互斥保护 | T1 | ✅ 完成 |
| V5 整体进度 | 全部 | **100%** |
