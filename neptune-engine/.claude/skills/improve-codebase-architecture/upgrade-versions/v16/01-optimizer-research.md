# V16 优化清单：V5 最后 5% 交付

> 版本：V16
> 分析日期：2026-04-28
> 分析范围：V5 OKR 遗留项（KR1/KR2/KR10/KR20）+ V15 推迟项
> 基于：V15 完成后代码状态（engine/ 802 用例、LLMRuntime 统一、错误英文）

---

## 一、框架现状分析

### 1.1 整体状态

经过 V1-V15 的持续优化，框架核心能力已全面完备：

| 维度 | 状态 | V16 前遗留 |
|------|------|-----------|
| 物理分离 | ✅ 完成 | — |
| SDK 构建 | ✅ 完成 | — |
| 测试覆盖 | ✅ 802 用例 | — |
| e2e 验证 | ✅ 完成 | — |
| Provider 可选化 | ✅ 完成 | — |
| LLMRuntime 统一 | ✅ 完成 | — |
| 资源安全 | ✅ 完成 | — |
| 类型统一 | ✅ 完成 | — |
| 错误统一 | ✅ 完成 | — |
| **API 文档** | ❌ **未完成** | TypeDoc 未配置 |
| **快速开始** | ❌ **未完成** | 无指南、无示例 |
| **query 互斥** | ❌ **未完成** | 同一 Session 并发无保护 |

### 1.2 剩余工作

V5 仅剩 3 个交付物 + 2 个可选增强：

**必须完成（V5 100% 必要条件）**：
1. TypeDoc API 文档生成
2. 快速开始指南 + 3 个示例
3. query 互斥保护

**可选增强（不阻塞 V5 100%）**：
4. SQLite 异步化
5. initializeRuntime 全局状态隔离

---

## 二、框架目标对齐分析

| 目标（project-purpose.md） | 当前状态 | 差距 | V16 可推进 |
|--------------------------|---------|------|-----------|
| API 文档完整 | ❌ 无 TypeDoc | KR1/KR10 遗留 | ✅ 核心交付 |
| 接入成本 < 1 天 | ⚠️ 缺文档和示例 | KR2 未开始 | ✅ 核心交付 |
| 多 Session 并发 ≥ 10 | ⚠️ 无 query 互斥 | KR20 推迟 | ✅ 核心交付 |
| 单 Session 内存 < 100MB | ✅ 截断保护 | — | — |
| SDK 包 < 2MB | ✅ 构建通过 | — | — |

---

## 三、优化清单（按优先级排序）

### Opt 1：TypeDoc API 文档生成（P1）

**优化重点**：配置 TypeDoc 生成 SDK 公共 API 文档

**优化目标**：`bun run docs:api` 生成完整的 SDK API 文档

**关键结果**：
- KR1：TypeDoc 配置完成（`claude-code/typedoc.json`），与 Bun TS 兼容
- KR2：engine/ 公共 API 文档覆盖率 100%
- KR3：文档输出到 `docs/api/` 目录，包含 `index.html` 入口

**预期收益**：SDK 用户有完整的 API 参考文档，IDE 可直接链接到文档

**对框架的影响**：
- 不破坏框架原则 — 只增加文档工具
- 正向：DX 大幅提升，V5 KR1/KR10 达标
- 风险：中 — TypeDoc 与 Bun TS 兼容性是已知难点（V14 未完成）

**符合框架目标**：API 文档完整覆盖（project-purpose.md 七、开发体验）

**依赖关系**：无

---

### Opt 2：快速开始指南 + 3 个示例（P1）

**优化重点**：为 SDK 新用户创建 30 分钟可跑通的快速开始指南

**优化目标**：新用户从零到跑通 Agent 交互 < 30 分钟

**关键结果**：
- KR1：`docs/getting-started.md` 完整指南（安装 → 配置 → 第一个 Agent → 事件处理）
- KR2：3 个示例放在 `docs/examples/`：
  - `01-embedded-sdk.md` — 嵌入式 SDK（Node.js 脚本）
  - `02-web-service.md` — Web 服务（Express + SSE）
  - `03-cli-tool.md` — CLI 工具（headless 自动化）
- KR3：每个示例可直接复制运行，无遗漏步骤

**预期收益**：SDK 接入成本从"需要看源码"降到"30 分钟跑通"

**对框架的影响**：
- 不破坏框架原则 — 纯文档
- 正向：V5 KR2 达标，用户转化率提升
- 风险：低

**符合框架目标**：接入成本 < 1 天（project-purpose.md 七、开发体验）

**依赖关系**：建议在 Opt 1 之后（文档需要参考 API 文档）

---

### Opt 3：query 互斥保护（P1）

**优化重点**：为同一 Session 的并发 query 添加互斥保护

**优化目标**：同一 Session 同时只能有一个活跃的 query，重复调用抛出明确错误

**关键结果**：
- KR1：`AgentEngine.query()` 入口添加 per-session 查询互斥锁（`Map<sessionId, boolean>`）
- KR2：重复调用时抛出 `EngineError(SESSION_BUSY, "Session 'xxx' already has an active query")`
- KR3：query 完成（包括 abort/异常）后自动释放锁（finally 块）
- KR4：新增 3+ 个测试验证并发 query 场景

**预期收益**：防止用户意外并发调用导致的状态混乱，多 Session 并发更可靠

**对框架的影响**：
- 不破坏框架原则
- 正向：V5 KR20 达标，状态一致性保障
- 负面：限制了同一 Session 的并发能力（但这是设计意图）
- 风险：低

**符合框架目标**：多 Session 并发 ≥ 10（project-purpose.md 七、性能指标）

**依赖关系**：无

---

### Opt 4：SQLite 异步化（P2，可选）

**优化重点**：将 SQLiteSessionStore 的同步操作改为异步

**优化目标**：SQLite 操作不阻塞事件循环

**关键结果**：
- KR1：save/load/list/delete 使用非阻塞包装
- KR2：构造函数 PRAGMA 添加错误处理
- KR3：close() 幂等性保护

**预期收益**：写入密集场景下 SDK 不卡顿

**对框架的影响**：
- 不破坏框架原则
- 风险：低

**符合框架目标**：高性能

**依赖关系**：无

---

## 四、优化点依赖关系

```
Opt 1 (TypeDoc) ──→ Opt 2 (快速开始)

Opt 3 (query互斥) ────→ 独立

Opt 4 (SQLite异步) ────→ 独立（可选）
```

**关键路径**：Opt 1 → Opt 2（文档先到位，示例才能引用）

**可并行**：Opt 3 独立于 Opt 1/2

---

## 五、执行策略建议

### 阶段 A：文档 + 互斥（Opt 1 + Opt 3 并行）

**并行分配**：
- developer-1：Opt 3（query 互斥保护）— 代码改动
- developer-2：Opt 1（TypeDoc 配置）— 配置 + 验证

### 阶段 B：指南（Opt 2）

- developer-2：Opt 2（快速开始指南 + 3 个示例）— 文档编写

### 阶段 C（可选）：SQLite（Opt 4）

- developer-1：Opt 4（SQLite 异步化）

---

## 六、OKR 对齐更新

本次 V16 执行完成后，OKR 路线图预期进度：

| KR | 描述 | 当前进度 | V16 后预期 |
|----|------|---------|-----------|
| KR1 | API 文档覆盖全部公共方法 | 未开始 | ✅ 完成 |
| KR2 | 快速开始指南 + 3 个示例 | 未开始 | ✅ 完成 |
| KR10 | TypeDoc API 文档 | ⏳ 部分 | ✅ 完成 |
| KR20 | query 互斥保护 | 未开始 | ✅ 完成 |
| V5 整体 | 交付验收 | ~95% | **100%** |
