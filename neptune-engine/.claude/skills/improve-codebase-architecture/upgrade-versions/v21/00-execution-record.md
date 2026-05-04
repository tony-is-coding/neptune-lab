# V21 执行记录

## 版本信息
- 版本号：V21
- 目标：V7 技术债收尾 + V7.5 全局状态解耦
- 状态：✅ 全部完成
- 完成时间：2026-04-29
- 前置版本：V20（去 UI 耦合 + 死代码清理 + SDK 独立性加固）

## 目标概述

一个迭代内完成 V7 剩余技术债清理 + V7.5 全局状态解耦，为 V8 分布式基础设施铺路。

## OKR 来源

详细 OKR 定义见 `docs/okr-roadmap.md` 第十一节（V7）和第十二节（V7.5）。

### V7 剩余 Key Results

| # | Key Result | 优先级 | 状态 |
|---|-----------|--------|------|
| KR9 | 废弃 initializeEngine + 启动路径统一 | P0 | ✅ 完成 |
| KR10 | ProviderConfig 类型统一 | P0 | ✅ 完成 |
| KR11 | 消除 EngineFacade 中间层 | P1 | ✅ 完成 |

### V7.5 Key Results

| # | Key Result | 优先级 | 状态 |
|---|-----------|--------|------|
| KR1 | 写入收敛到 CCRuntime 单一入口 | P0 | ✅ 审计确认已完成 |
| KR2 | 高频字段读取从 ALS | P0 | ✅ 完成 |
| KR3 | 成本/Token 状态 ALS 化 | P1 | ✅ 完成 |
| KR4 | SessionContext 序列化增强 | P1 | ✅ 完成 |
| KR5 | bootstrap/state 降级审计 | P2 | ✅ 完成 |

## 执行阶段

```
Phase 0: 需求澄清 ✅ → Phase 1: 深度分析 ✅ → Phase 2: 任务拆分 ✅ → Phase 3: 团队执行 ✅ → Phase 4: 总结 ✅
```

## Phase 3 执行成果

### 代码改动统计

- **新增文件**：3 个（SessionContextBridge.ts + test, ConfigValidation.ts）
- **删除文件**：4 个（initializeEngine.ts, engineHelpers.ts, EngineFacade.ts + test）
- **改动文件**：17 个
- **净代码变化**：+153 行 / -2200 行

### 关键架构改动

1. **启动路径统一**：`AgentEngine.create()` 为唯一入口，726 行废弃代码删除
2. **ProviderConfig 统一**：types.ts re-export from AgentEngine.ts，消除重复定义
3. **EngineFacade 消除**：AgentEngine 直接持有 SessionManager，toSessionInfo() 迁入
4. **SessionContextBridge**：独立 ALS 桥接层，无循环依赖
5. **核心字段 ALS 化**：setter 双写 + getter ALS 优先（cwd/sessionId/projectRoot/originalCwd）
6. **成本/Token ALS 化**：8 个累积指标双写 + getter ALS 优先
7. **序列化增强**：SessionContextSnapshot 从 5→13 字段

## 关键架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 启动路径 | 唯一维护 AgentEngine.create | initializeEngine 无外部调用方 |
| ProviderConfig | 统一到 AgentEngine.ts | 引用正式 ProviderConfigs.ts，单一真相来源 |
| EngineFacade | 消除，AgentEngine 直接持有 SessionManager | 唯一消费者，错误处理冗余 |
| 状态迁移策略 | 保留 getXxx() 签名，内部改 ALS | 最小改动，121 文件不需改 import |
| ALS 桥接层 | 独立 SessionContextBridge | 避免循环依赖，只依赖 async_hooks |
