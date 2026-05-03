# 架构认知索引

> 最后更新: 2026-05-03 | 版本: v21

## 模块状态

| 模块 | 状态 | 关键版本 | 备注 |
|------|------|----------|------|
| engine/ 依赖方向 | 已治理 | V1,V4,V9 | 反向依赖从 74 条归零，穿透依赖持续治理中 |
| Tool 接口 | 已深化 | V5,V20 | CoreTool/UITool 分离，types/ 零 React |
| Provider 体系 | 已建立 | V6,V11,V19 | 7 Provider 运行时激活，CircuitBreaker 启用 |
| EventBus | 已建立 | V1 | 推+拉双路，透传 CC 原始 Message |
| Session 管理 | 已深化 | V2,V15,V21 | SessionContextBridge ALS 按会话隔离 |
| Permission 系统 | 已深化 | V6,V8 | 三模式委托 + RBAC + Audit |
| 日志系统 | 已建立 | V11,V15 | JsonLogFormatter + MDC，统一英文错误信息 |
| 状态存储 | 已建立 | V6,V18 | IBackend 4 实现，ISessionStore write-through |
| CLI/SDK 分离 | 已完成 | V7-V10 | 物理分离，SDK 可独立运行 |
| 错误体系 | 已深化 | V1,V13,V15 | EngineError 错误码 + 错误链 |
| 可观测性 | 已建立 | V18 | ITracingProvider + IMetricsProvider |
| 配置系统 | 已建立 | V18,V19 | IConfigProvider + UnifiedConfig + ProviderConfig union |
| 文档体系 | 已建立 | V16 | TypeDoc API 文档 + 快速开始指南 |
| Hook 系统 | 已深化 | V5 | HookCore 零 UI 依赖 |
| EngineState | 已深化 | V5,V20 | 18 字段纯数据，零 React |
| query() 接口 | 已建立 | V13,V16 | 类型安全事件映射 + per-session 互斥锁 |
| ComponentRegistry | 已建立 | V9 | UI 组件注册模式，框架不直接依赖 CLI |
| AppStateStore | 已治理 | V10 | createAppStateStore() 纯 JS 创建 |

## 已知待办

- [ ] engine/ 穿透依赖仍有约 62 条（目标 <10）
- [ ] 文档与架构同步机制尚未自动化（V18 审计发现 3 个 P0 过时文档）
- [ ] V17 识别的 10 个生产就绪优化点未完全执行
- [ ] okr-roadmap.md V8-V9 待启动

## 研究事实索引

> 详细内容见 research-docs/ 目录

（暂无，后续迭代积累）
