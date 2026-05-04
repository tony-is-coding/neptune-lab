# V3 多阶段执行详细记录

## Phase 0: 需求确认

**时间**: 2026-04-26
**状态**: ✅ 完成

### 需求输入
用户提出三个架构优化方向：
1. TUI 和 tool 深度耦合，需要解耦
2. UI 和核心层没有做足够分层
3. 项目结构需要进行分层设计：核心/扩展/工具清晰划分

### 需求澄清结果
- **优化目标**: 架构分层与解耦，使 Agent Engine 底座可独立于 UI 层运行
- **关注范围**: 整体框架的分层架构设计
- **优先方向**: 先分层（明确边界），再解耦（打断耦合）
- **约束**: 最小改动现有代码，优先包裹和外扩；核心 agent loop 尽量不变

### 用户确认
- 用户确认需求梳理准确，可以继续

---

## Phase 1: 深度研究

**时间**: 2026-04-26
**状态**: ✅ 完成（第二轮，基于完整目标架构差距分析）

### 分析方法
1. 启动 4 个并行探索 agent，分别覆盖：
   - 核心引擎层（query.ts, QueryEngine.ts, hooks, compaction, cron, engine/）
   - 适配器层/Provider（LLM Provider, Auth, Stream, Context, Network）
   - 基础设施层（Tools, Shell, Config, Telemetry, Permission, Memory）
   - 扩展系统/UI（Ink, CLI, Server, Swarm, IDE, Updater, Teleport）
2. 对照用户给出的完整目标架构图，逐层做差距分析
3. 基于实际代码扫描结果（2641 源文件，~483,174 行），识别优化点

### 关键发现
**差距评级分布**：
- 🔴 高差距（3层）：Provider 适配器层（无统一接口）、Tool 系统（40% UI 耦合）、Server 层（70% stub）
- 🟡 中等差距（8层）：agent, config, telemetry, memory, permission, swarm, ide, cli
- 🟢 低差距（4层）：ink, shell, updater, teleport

**最大差距点**：
1. Provider 适配器层：claude.ts 通过 if/else 分发 7 种 Provider，无统一接口
2. Auth 认证：5 种认证方式散落在 auth.ts 1999行中，无策略模式
3. Tool 系统：CoreTool/UITool 分离已开始但未完成，~35 个工具 40% 方法是 UI 渲染
4. Server 层：11 个文件中 7 个是 stub
5. AppState：核心运行时状态与 UI 状态混合在 React Context 中

### 产出物
- 21 个优化点（#1-#21），按 P0/P1/P2 优先级排序
- 每个优化点包含 OKR 描述、预期收益、架构影响、框架目标对齐
- 5 阶段依赖关系图（Phase A → B → C → D → E）
- 每层差距详细对照表（11 个目标 Package × 4-5 个能力维度）

---

## Phase 2: 任务拆分

**时间**: 2026-04-26
**状态**: ✅ 完成

### 决策记录
- **执行范围**: 第一批（5 个低风险优化点：O4, O1, O2, O6, O11）
- **团队规模**: 3 人（1 architect + 2 developer）
- **任务划分**: 6 个任务（T1-T6），2 阶段并行 + 1 阶段验证

### 任务分配
- **architect**: T1(分层标准文档) + T6(集成验证)
- **dev-types**: T2(CanUseToolFn提取) + T11(权限纯化)
- **dev-state**: T3(SpinnerMode提取) + T4(AppState分离)

### 产出物
- 02-task-plan.md：完整任务计划

---

## Phase 3: 团队执行

**状态**: ⏳ 待开始

---

## Phase 4: 工作总结

**状态**: ⏳ 待开始
