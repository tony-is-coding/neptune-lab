# v1-v21 历史总览

> 创建时间: 2026-05-03
> 性质: 一次性创建，后续不更新

---

## 五阶段演进

| 阶段 | 版本 | 核心主题 | 标志性事件 |
|------|------|----------|------------|
| 内部治理 | V1-V2 | engine/ 内部结构清理 | CCRuntime 依赖抽象、EventBus 桥接、SessionContext 精简 |
| 分层解耦 | V3-V6 | L1-L4 分层标准、TUI/Tool/Hook/UI 分离 | V3 产出分层标准和路线图，Provider 体系建立 |
| 物理分离 | V7-V10 | CLI/SDK 物理分离 | V9 反向依赖从 74 条归零，V10 创建独立 CLI 目录 |
| 质量深耕 | V11-V16 | 测试从 6 到 812、类型安全、文档 | V11 最大批量交付（+6336 行），V16 V5 里程碑 100% |
| 企业级能力 | V17-V21 | 可观测性、分布式、去 UI、状态隔离 | V18 分布式奠基，V21 做减法成熟阶段 |

## 反复出现的主题

| 主题 | 出现版本 | 说明 |
|------|----------|------|
| engine/ 穿透依赖 | V1,V4,V11,V18,V19,V20,V21 | 从 35+ 处到目标 <10，持续性的核心难题 |
| React/UI 解耦 | V3,V5,V10,V13,V14,V20 | 从类型解耦到彻底消除，跨越 17 个版本 |
| Provider 体系完善 | V6,V11,V13,V15,V18,V19 | 从空壳到运行时激活，跨度最大的主题 |
| 测试覆盖率提升 | V1,V6,V12,V13,V14,V15 | 6→129→395→446→753→802→812 |
| 死代码/废弃代码清理 | V1,V8,V11,V20 | 每次"清理完后"下一轮又发现新的 |
| 全局状态隔离 | V2,V15,V18,V21 | V2 发现到 V21 才解决，跨越 19 个版本 |
| 文档与架构同步 | V3,V4,V16,V18 | 文档频繁过时，V18 审计发现 3 个 P0 过时文档 |
| 错误处理统一 | V1,V2,V8,V13,V15 | SessionError→EngineError→错误链→统一英文 |

## 关键转折点

**V3 — 确立路线图：** 唯一一次纯研究版本，产出 L1-L4 分层标准和 Top 20+ 优化点。后续 V4-V6 全部来自 V3 报告。

**V7 — 物理分水分岭：** 从逻辑解耦走向物理切割，开启 V8-V10 的物理分离阶段。

**V9 — 反向依赖归零：** 框架到 CLI 的反向依赖从 74 条降至 0，context/ 目录完全删除。SDK 独立性最关键的一步。

**V11 — 最大批量交付：** 一次性完成 V1-V5 的 18 个任务，+6336 行代码。确立 Provider 多后端、存储抽象、RBAC 权限等核心能力。

**V16 — V5 里程碑完成：** OKR V5 达到 100%，SDK 从"可独立运行"升级到"可交付"。TypeDoc 文档、快速开始指南。

**V18 — 分布式奠基：** 引入状态外化（ISessionStore write-through）、可观测性 Provider、统一配置。从单进程走向可分布式。

**V21 — 做减法成熟：** 删除 726 行废弃 initializeEngine + 204 行 EngineFacade，ALS 桥接层解决困扰 19 个版本的全局状态问题。

## 各版本摘要

| 版本 | 需求一句话 | 产出关键 |
|------|-----------|----------|
| V1 | engine/ 依赖治理 | 删除 adapters/ 死代码、EventBus 桥接、SessionContext 精简 |
| V2 | CCRuntime 依赖抽象 | CCRuntime 接口解耦 7 处硬编码、AsyncLocalStorage 双层隔离 |
| V3 | 分层差距分析 | L1-L4 分层标准、TUI 解耦、29 个文件 import 路径调整 |
| V4 | 第二批优化执行 | lint:layers 自动化守护、engine/index.ts 统一导出 |
| V5 | Tool/AppState/Hook 解耦 | Tool 接口 29+18 分离、EngineState 18 字段零 React |
| V6 | Provider/Permission/QueryDeps | ProviderRegistry 7 Provider、PermissionDelegate 三模式 |
| V7 | CLI 迁移可行性研究 | 识别 CLI/SDK 分层边界和迁移方案 |
| V8 | engine/ 零 CLI 依赖 | ICommandProvider 注入、删除 buddy/ 和 55 个死代码文件 |
| V9 | SDK 独立启动 | 反向依赖归零、initializeEngine() 骨架、context/ 迁移 |
| V10 | CLI/SDK 物理分离 | React 依赖解耦、763 文件导入路径切换、package.json exports |
| V11 | OKR V1-V5 批量执行 | 7 个 Provider、IBackend 4 实现、RBAC 权限、结构化日志 |
| V12 | V11 遗留 + 质量深耕 | 测试 87→395、BaseProvider 抽象、e2e_cli 公共 API |
| V13 | 性能/效果/架构优化 | EngineEventMap 类型安全、CircuitBreaker 熔断 |
| V14 | V5 剩余 20% | SDK 构建修复、测试覆盖率 70%→90% |
| V15 | 深度优化分析 | AsyncGenerator 资源泄漏修复、LLMRuntime 统一接口 |
| V16 | V5 收官 100% | TypeDoc API 文档、query 互斥保护、快速开始指南 |
| V17 | 生产就绪深度分析 | 10 个优化点识别（纯研究，未执行） |
| V18 | V6 状态外化/可观测性 | ITracingProvider、IMetricsProvider、ISessionStore write-through |
| V19 | Provider 运行时接入 | 7 个 ProviderAdapter 运行时调用链、CircuitBreaker 启用 |
| V20 | 去 UI 耦合 | types/ 层零 React 类型、清理 6 个零引用目录 |
| V21 | V7 技术债 + V7.5 全局状态 | 删除 930 行废弃代码、ALS 桥接层、ProviderConfig 单一来源 |
