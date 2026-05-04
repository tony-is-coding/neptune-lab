# V21 用户需求

## 核心需求

将 V7 剩余技术债清理 + V7.5 全局状态解耦，在一个迭代中完成。

## 背景

基于 `/improve-codebase-architecture` 对 `src/` 的深度架构分析，识别出 8 个优化候选。用户选择优先执行两个核心项：

1. **启动路径统一 + ProviderConfig 类型统一**（V7 KR9/KR10）
2. **bootstrap/state.ts 全局状态解耦**（V7.5 KR1-KR5）

同时采纳消除 EngineFacade 不必要中间层（V7 KR11）。

## OKR 定义

### V7 剩余（本次执行）

| KR | 描述 | 优先级 | 执行步骤数 |
|----|------|--------|-----------|
| KR9 | 废弃 initializeEngine + 启动路径统一 | P0 | 7 步 |
| KR10 | ProviderConfig 类型统一 | P0 | 4 步 |
| KR11 | 消除 EngineFacade 中间层 | P1 | 8 步 |

### V7.5（本次执行）

| KR | 描述 | 优先级 | 阶段 |
|----|------|--------|------|
| KR1 | 写入收敛到 CCRuntime 单一入口 | P0 | Phase 1 |
| KR2 | 高频字段读取从 ALS（sessionId/cwd/projectRoot 等） | P0 | Phase 2 |
| KR3 | 成本/Token 状态 ALS 化 | P1 | Phase 2 |
| KR4 | SessionContext 序列化增强 | P1 | Phase 3 |
| KR5 | bootstrap/state 降级审计 | P2 | Phase 3 |

## 约束

- 不违反"包装不替代"原则
- CC 原始代码核心逻辑不改，只改状态读取方式
- 所有改动必须 `bunx tsc --noEmit` 零错误 + `bun test` 全通过

## 成功标准

1. V7 门禁条件全部通过（KR2/KR4/KR1/KR9/KR10）
2. V7.5 KR1+KR2 通过（多 workspace 并发验证）
3. 全量测试通过
