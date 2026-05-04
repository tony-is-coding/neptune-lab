# V2 用户需求

## 基本信息

- **版本号**：v2
- **梳理时间**：2026-04-26
- **需求来源**：用户对话

---

## 优化目标

在 V1 架构对齐基础上，深入解决框架核心层的设计合理性和耦合问题，推动分布式支持能力。

## 关注范围

`src/engine/` 及与 CC 原始代码的交互边界，包括：
- V1 遗留：initializeRuntime() 多 workspace、集成测试、26 个预存 tsc 错误
- 设计合理性：require 路径硬编码、SessionContext 双向依赖、全局状态管理
- 耦合治理：框架对 CC 原始模块的依赖方式、编译时 vs 运行时绑定
- 分布式支持：多进程/多节点 Session 管理、事件同步、状态持久化

## 优先方向

**深度治理优先**：先解决设计合理性和耦合问题，为分布式支持打基础。

## 已确认的 V1 成果

1. ✅ Adapters 移出框架
2. ✅ query→EventBus 自动桥接
3. ✅ canUseTool 权限恢复
4. ✅ 全局状态部分隔离（setMemoryPath）
5. ✅ SessionContext 职责拆分
6. ✅ 错误分类机制重构
7. ✅ 死代码清理
8. ✅ 日志系统统一
9. ✅ 类型安全提升
10. ✅ 测试体系建设

## V1 遗留问题

1. initializeRuntime() 仅支持单 workspace 并发
2. bootstrap/state cwd/projectRoot 进程级单例
3. 26 个非 engine/ 预存 tsc 错误
4. AgentEngine 缺少集成测试

## 特殊约束

无特殊时间线约束或风险偏好限制。
