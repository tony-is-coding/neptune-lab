# 架构原则

> 记录时间: 2026-05-03
> 来源: docs/architecture-design.md F1-F5/G1-G6 迁移 + v1-v21 回顾补充
> 真相来源: 此文件。docs/architecture-design.md 第三节为此文件的视图。

---

## 核心原则（不可违反）

### P1: 包装不替代
禁止自建 QueryEngine、工具 handler、LLM 调用层、权限系统、会话存储。
**Why:** CC 原始能力稳定可靠，重写风险极高。
**Scope:** 所有对 src/ 的改动。
**Since:** v1（项目立项即确立）
**Origin:** F1

### P2: 单向分层依赖
L0 ← L1 ← L2 ← L3，禁止反向 import。
**Why:** 防止循环依赖，保证层间独立可测。v1-V9 耗时 9 个版本才将 engine/ 反向依赖从 74 条清零。
**Scope:** src/ 内所有 import。
**Since:** v3（确立 L1-L4 分层标准）
**Origin:** F2

### P3: 核心状态零 React
engine/ 和 state/AppStateStore 零 React 依赖。
**Why:** SDK 可在非 UI 环境（服务端、CI）独立运行。v3-V20 跨越 17 个版本才彻底消除 React 类型依赖。
**Scope:** engine/ 目录内所有文件、AppStateStore 类型定义。
**Since:** v3（TUI 解耦）
**Origin:** F3

### P4: 事件完全透传
不自建事件模型，直接转发 CC 原始 Message。
**Why:** 零数据丢失，使用者直接处理 CC 消息格式。
**Scope:** EventBus 和所有事件相关接口。
**Since:** v1（EventBus 桥接）
**Origin:** F4

### P5: 权限委托不硬编码
权限行为通过 PermissionDelegate 注入。
**Why:** SDK 不直接弹窗或阻塞，由宿主决定权限策略。
**Scope:** 所有权限相关代码。
**Since:** v6（PermissionDelegate 三模式）
**Origin:** F5

---

## 建议原则（推荐遵循）

### P6: Session = Workspace
Session 与工作目录一对一映射。
**Why:** 简化模型，与 CC 原始行为对齐。
**Scope:** SessionManager 和 Session 生命周期。
**Since:** v1
**Origin:** G1

### P7: 配置化启动
AgentEngine.create(config) 静态工厂，Extension 模型。llm 唯一必填。
**Why:** 降低接入成本。
**Scope:** AgentEngine 入口和配置接口。
**Since:** v9（initializeEngine 骨架）
**Origin:** G2

### P8: 框架轻量
框架只提供 SDK + EventBus，不内置 HTTP/SSE/CLI。
**Why:** 传输层由宿主自行构建，框架不绑定特定传输。
**Scope:** SDK 对外导出的所有模块。
**Since:** v10（CLI/SDK 物理分离）
**Origin:** G3

### P9: 存储分层
框架管 Session 元数据，CC 管 transcript 内容。
**Why:** 避免重复存储，职责清晰。
**Scope:** SessionStore 和 TranscriptParser。
**Since:** v6（IBackend 4 实现）
**Origin:** G4

### P10: 命令接口解耦
CLI 通过 ICommandProvider 注入命令实现。
**Why:** 框架不依赖具体 CLI 命令。
**Scope:** ICommandProvider 接口和 DefaultCommandProvider。
**Since:** v8（ICommandProvider 14 方法注入）
**Origin:** G5

### P11: 组件注册模式
框架定义注册点，CLI 注册 UI 组件。
**Why:** 框架需要 UI 时通过 registry 获取，不直接依赖 CLI。
**Scope:** ComponentRegistry 和所有 UI 组件注册。
**Since:** v9（ComponentRegistry 解耦）
**Origin:** G6

---

## 从 v1-v21 提炼的补充原则

### P12: 全局状态隔离
进程全局状态通过 AsyncLocalStorage 按会话隔离，不使用裸全局变量。
**Why:** 全局单例问题从 v2 发现到 v21 才解决，跨越 19 个版本。裸全局变量阻止多 Session 并发。
**Scope:** bootstrap/state.ts、SessionContext、所有 ALS 使用。
**Since:** v21（ALS 桥接层）

### P13: Provider 可插拔
LLM Provider 通过 ProviderRegistry + ProviderAdapter 机制注册和切换，运行时按配置激活。
**Why:** 硬编码 Provider 路由无法支持多后端，从 v6 空壳到 v19 运行时激活耗费 13 个版本。
**Scope:** provider/ 目录、ProviderRegistry、ProviderAdapter。
**Since:** v6（ProviderRegistry 单例）→ v11（7 Provider）→ v19（运行时激活）

### P14: 深化优先于广化
发现浅模块时优先深化（增加深度），而非横向拆分（增加数量）。
**Why:** v5 的 Tool 接口拆分（29+18 方法）比拆成多个小接口更有价值。接口是测试表面，深度产生杠杆。
**Scope:** 所有模块重构决策。
**Since:** v3-v5（Tool/Hook/State 深化经验）
**Reference:** LANGUAGE.md "Depth" 概念

### P15: 渐进式改造，每阶段可验证
每阶段必须产出：阶段内测试通过、旧能力回归通过、下一阶段准入门禁满足。
**Why:** v11 一次性完成 5 个 OKR 的 18 个任务虽然高效，但风险极高。后续回归测试耗费 V12-V14 三个版本。
**Scope:** 所有迭代规划和执行。
**Since:** v1（渐进式原则确立）
