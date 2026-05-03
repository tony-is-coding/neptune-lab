# 架构决策记录

> 真相来源: 此文件。替代 docs/adr/，作为 skill 内部的轻量决策记录。

| ID | 日期 | 简述 | 上下文 | 结论 | 状态 |
|----|------|------|--------|------|------|
| D1 | 2026-04-27 | CCRuntime 依赖抽象层 | engine/ 内 7 处硬编码 require() 直接引用 CC 模块 | 定义 CCRuntime 接口，通过 AsyncLocalStorage 注入依赖 | 活跃 |
| D2 | 2026-04-27 | L1-L4 分层标准 | engine/ 与上层模块边界模糊，import 无规则 | 建立 L0(raw)←L1(types)←L2(engine)←L3(CLI) 分层，lint:layers 自动守护 | 活跃 |
| D3 | 2026-04-28 | Tool 接口拆分为 CoreTool + UITool | Tool 接口 47 方法混杂 React/UI 依赖和纯逻辑 | 拆分为 CoreTool(29 方法, 零 UI) + UITool(18 方法, 含 UI) | 活跃 |
| D4 | 2026-04-28 | EngineState 零 React | AppState 深度耦合 React 类型 | 提取 EngineState 18 字段纯数据类型，React 类型留在 UI 层 | 活跃 |
| D5 | 2026-04-28 | Provider 适配器体系 | LLM API 调用硬编码 claude.ts，无法支持多后端 | ProviderRegistry 单例 + ProviderAdapter 抽象，7 个 Provider 实现 | 活跃 |
| D6 | 2026-04-29 | ICommandProvider 命令注入 | engine/ 硬编码空命令数组，反向依赖 CLI | DefaultCommandProvider 14 方法注入，框架不持有具体命令 | 活跃 |
| D7 | 2026-04-29 | CLI/SDK 物理分离 | SDK 需独立运行，不能捆绑 CLI 代码 | 创建 claude-code-cli/ 目录，763 文件导入路径切换到包引用 | 活跃 |
| D8 | 2026-04-29 | PermissionDelegate 三模式 | 权限检查硬编码在框架内 | ReadOnlyPermissionDelegate + RBACPermissionDelegate + AuditPermissionDelegate | 活跃 |
| D9 | 2026-04-29 | 状态外化接口 | 单进程全局状态阻止分布式部署 | ISessionStore write-through 持久化 + IBackend 4 实现 | 活跃 |
| D10 | 2026-04-29 | 废弃 initializeEngine + EngineFacade | V9 创建的启动路径和中间层在 V21 已不必要 | 删除 726 行 initializeEngine + 204 行 EngineFacade，ALS 桥接层替代 | 活跃 |
| D11 | 2026-04-29 | ALS 桥接层替代全局单例 | bootstrap/state.ts 全局变量阻止多 Session 并发 | SessionContextBridge 使用 AsyncLocalStorage 按 sessionId 隔离 | 活跃 |
| D12 | 2026-04-29 | Provider 运行时激活 | Provider 注册后未接入实际调用链 | 7 个 ProviderAdapter 接入运行时调用链，CircuitBreaker 熔断保护 | 活跃 |
| D13 | 2026-04-30 | types/ 层零 React 类型 | types/ 目录仍含 ReactNode 等 React 类型 | ReactNode→unknown 替换，所有类型定义零 React 依赖 | 活跃 |
| D14 | 2026-04-30 | ProviderConfig 单一真相来源 | Provider 配置分散在多处，类型不统一 | ProviderConfig discriminated union 统一配置类型 | 活跃 |
| D15 | 2026-05-03 | ARCHITECTURE-DECISIONS.md 替代 docs/adr/ | docs/adr/ 目录不存在，SKILL.md 引用断裂 | skill 内部维护轻量决策记录，不创建 docs/adr/ | 活跃 |

## 详细决策

目前所有决策可在表格中完整表达，无需展开到 decisions/ 目录。
当决策跨 3+ 模块或需 100+ 字解释时，在 decisions/ 下创建单独文件并在此链接。
