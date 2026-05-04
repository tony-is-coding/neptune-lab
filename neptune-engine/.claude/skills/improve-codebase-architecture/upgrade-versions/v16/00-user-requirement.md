# V16 用户需求

> 记录时间：2026-04-28
> 需求来源：用户主动提出

---

## 核心需求

完成 OKR V5 剩余 5%，使 V5 达到 100% 完成状态。

### 具体目标

1. **TypeDoc API 文档（KR1 + KR10）**
   - 配置 TypeDoc，生成 SDK 公共 API 文档
   - engine/ 公共 API 文档覆盖率 100%
   - 文档输出到 `docs/api/` 目录

2. **快速开始指南 + 3 个示例（KR2）**
   - 快速开始指南：新用户 30 分钟内跑通
   - 3 个完整示例：嵌入式 / Web 服务 / CLI 工具
   - 文档输出到 `docs/getting-started.md` 和 `docs/examples/`

3. **query 互斥保护（KR20）**
   - 同一 Session 同时只能有一个活跃 query
   - 重复调用抛出 EngineError(SESSION_BUSY)
   - query 完成后自动释放锁

## 约束

- 不破坏框架核心原则
- 完成后 V5 进度从 ~95% → 100%
