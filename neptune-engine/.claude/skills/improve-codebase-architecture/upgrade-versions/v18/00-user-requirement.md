# V18 用户需求

## 需求来源
- OKR 路线图：`docs/okr-roadmap.md` V6 章节
- 架构纲领：`claude-code/ARCHITECTURE.md`
- 架构设计：`docs/architecture-design.md`

## 优化目标
基于 OKR V6 进行深度研究，分析当前代码库实现状态，识别优化点，输出详细的 OKR 执行计划。

## 关注范围
V6 的 5 个 Key Results：

### KR1: TracingProvider + MetricsProvider (P1)
- NoOpTracingProvider（零开销默认）
- InMemoryMetricsProvider
- 框架定义关键 trace/metrics 埋点

### KR2: IConfigProvider 配置归一化 (P0)
- 统一 AgentEngineConfig / EngineConfig / CC 内部 Config 三套配置
- 优先级：代码 > 环境变量 > 配置文件 > 默认值

### KR3: AgentEngine 无界 Map → StorageProvider (P0)
- sessions / sessionMetadata / activeQueries 等 7 个 Map 迁移到可插拔存储
- 默认 InMemory，可切换到 SQLite/PG/Redis

### KR4: IMemoryStore + ISessionContentStore 接口 (P2)
- 记忆按用户隔离
- 会话内容追加写入

### KR5: engine/ 穿透依赖 < 10 处 (P1)
- 当前 25+ 处穿透引用
- 目标降到 10 以下

## 必须参考的架构文档
1. `docs/architecture-design.md` — 整体架构设计、模块依赖、数据流
2. `claude-code/ARCHITECTURE.md` — SDK 纲领文档、架构原则、目标架构、研发规约

## 约束
- 遵循"包装不替代"原则
- 核心状态零 React
- 事件完全透传
- 不自建事件模型

## 门禁条件
1. KR3 通过（状态外化可用，SDK 可无状态运行）
2. KR2 通过（配置归一化，用户不再困惑于 3 套 Config）
3. 现有 250+ engine 测试全部通过
