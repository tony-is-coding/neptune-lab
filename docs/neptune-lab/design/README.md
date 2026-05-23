# Neptune Lab 设计文档总览

日期：2026-05-22

状态：设计收敛

## 0. 结论

本目录是 Neptune AgentOps 产品进入实现前的设计基线。它把战略判断、产品架构、技术架构、服务/API、系统拓扑和实施路线拆成多份互相引用的文档，避免所有决策堆在一份超长规格里。

所有文档共同遵守三个约束：

1. `neptune-engine` 是 Runtime Kernel，不承载财务、关账、审计责任、产品治理对象。
2. `neptune-ai` 是产品体验、服务编排、平台事实、Solution Pack 的主要承载层。
3. 用户主界面中文优先，主路径使用 `智能体`，英文只作为代码、协议、模型、provider、技术括注或标准缩写出现。

## 1. 文档地图

| 文档 | 目的 | 主要读者 |
| --- | --- | --- |
| [01-product-architecture.md](01-product-architecture.md) | 产品定位、用户、入口、旅程、信息架构、中文交互原则 | 产品、设计、前端、业务方案 |
| [02-technical-architecture.md](02-technical-architecture.md) | 源码边界、运行时边界、控制/数据/事实/治理平面、技术防线 | 架构、后端、平台工程 |
| [03-service-api-design.md](03-service-api-design.md) | 前后台服务、服务职责、API 草案、SSE、错误信封、权限/配额 | 后端、前端、测试 |
| [04-subsystems-topology.md](04-subsystems-topology.md) | 本地 MVP、私有化、未来云控制面拓扑，数据流和故障边界 | 架构、部署、运维 |
| [05-implementation-roadmap.md](05-implementation-roadmap.md) | 分阶段实施、12 项能力映射、验收门禁、测试策略 | 全栈研发、项目管理 |
| [06-parallel-subagent-tdd-delivery-governance.md](06-parallel-subagent-tdd-delivery-governance.md) | 并行 subagent 研发规约、TDD 顺序、文件所有权、验证门禁、下一批切片队列 | 全栈研发、测试、项目管理 |

## 2. 上游依据

- 战略源文档：[../../strategy/neptune-agentops-platform-strategy.md](../../strategy/neptune-agentops-platform-strategy.md)
- 当前设计母版：[../../superpowers/specs/2026-05-22-neptune-agentops-product-architecture-design.md](../../superpowers/specs/2026-05-22-neptune-agentops-product-architecture-design.md)

## 3. 统一术语

| 内部/代码术语 | 用户主界面术语 | 说明 |
| --- | --- | --- |
| `Agent` | 智能体 | `Agent` 可作为技术括注，不作为业务用户主标签 |
| `AgentTemplate` | 智能体模板 | 交付台配置对象 |
| `AgentTemplateVersion` | 智能体版本 | 治理台不可变运行快照 |
| `Run` | 运行记录 | 平台中心事实 |
| `RunEvent` | 运行事件 | 运行详情时间线 |
| `ToolInvocation` | 工具调用 | 调试与审计事实 |
| `Artifact` | 成果文件 | 交付侧产物 |
| `EvidenceArtifact` | 证据 | 关账和审计场景中的事实文件 |
| `Finding` | 异常发现 | 关账工作台主对象 |
| `HumanReview` | 人工复核 | 责任链事实 |
| `PolicyDecision` | 策略决策 | 工具、模型、路径、数据边界决策 |
| `AuditEvent` | 审计事件 | append-only 责任事实 |

## 4. 当前阶段不做

- 不修改 `neptune-engine`。
- 不把财务、ERP、关账、报表语义下沉到 runtime。
- 不提前建设重型云控制面、完整 CI/CD、多环境灰度、自动 rollback。
- 不用聊天作为主产品入口。
- 不用 Langfuse 或 transcript 替代审计、证据和成果文件。

## 5. 设计完成门禁

文档进入实施前必须满足：

- 每个新增平台对象能落回 `Run / Evidence / Review / Audit / Version / Cost` 事实链。
- 每个 UI 入口消费真实 server API，不做孤立 mock。
- 每个跨层 API 有 shared DTO 或明确暂不进入 shared 的理由。
- 每个核心动作有审计事件或明确豁免理由。
- 中文主路径有页面标题、按钮、状态、空状态、错误态和确认态。
