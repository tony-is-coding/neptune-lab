# V21 优化研究报告

> 版本：V21
> 目标：V7 技术债收尾 + V7.5 全局状态解耦
> 生成时间：2026-04-29
> 驱动方式：基于 `/improve-codebase-architecture` 深度分析 + OKR 路线图 + 代码级可行性验证
> 策略：聚焦已确认的优化点，验证可行性，识别新增风险

---

## 一、框架现状分析

### 1.1 整体状态

| 维度 | 当前值 | 目标值 | 差距 |
|------|--------|--------|------|
| engine/ 文件数 | 172 | — | — |
| 穿透依赖 | ~100 条 | < 50 条 | ~50 条 |
| 测试用例 | 2472 / 0 fail | — | — |
| tsc 错误 | 0 | 0 | ✅ |
| 废弃模块 | initializeEngine (573行) | 移除 | 待执行 |
| 重复类型 | ProviderConfig × 2 | 统一 | 待执行 |
| 不必要中间层 | EngineFacade (204行) | 消除 | 待执行 |
| 全局状态单例 | bootstrap/state.ts (1759行, 90+字段) | 解耦 | 待执行 |

### 1.2 V7 已完成项（V20）

| KR | 状态 |
|----|------|
| KR2 SDK 入口完全统一 | ✅ |
| KR4 文档全面同步 | ✅ |
| KR6 IConfigProvider 公共导出 | ✅ |

### 1.3 V7 待完成项

| KR | 状态 | 难度 |
|----|------|------|
| KR1 Provider 适配器测试修复 | ⚠️ 待推进 | 中 |
| KR3 穿透依赖 < 50 条 | ⚠️ 待推进 | 中 |
| KR9 废弃 initializeEngine | 📋 V21 新增 | 低-中 |
| KR10 ProviderConfig 类型统一 | 📋 V21 新增 | 中 |
| KR11 消除 EngineFacade | 📋 V21 新增 | 中 |

---

## 二、框架目标对齐分析

| 框架目标 | V7 KR 贡献 | V7.5 KR 贡献 |
|---------|------------|-------------|
| 物理分离：SDK 核心独立 | KR9 移除 deprecated 启动路径，KR10 清理重复类型 | — |
| 零 UI 依赖 | KR11 消除 EngineFacade (消除内部中间层) | — |
| 多 Session 并发 | — | KR2 高频字段 ALS 化后多 workspace 不再互相覆盖 |
| 独立发布 | KR9/KR10 清理废弃导出 | KR5 审计后 bootstrap/state 不再是 SDK 包的隐式依赖 |
| 分布式部署（V8 前置） | — | KR1-KR4 为多实例部署扫除状态隔离障碍 |

---

## 三、优化清单（按优先级排序）

### 优化 1：废弃 initializeEngine + 启动路径统一（V7 KR9）

**优化重点**：消除 deprecated 的两套启动路径，统一到 AgentEngine.create()

**优化目标**：SDK 只有唯一的初始化入口 `AgentEngine.create()`，无废弃代码残留

**关键结果**：
- KR1：`initializeEngine`、`engineHelpers` 文件删除，`bootstrap/index.ts` 不再导出废弃函数
- KR2：`validateEngineConfig()` 迁移到独立模块，`AgentEngine.create()` 内联 CLI 校验逻辑
- KR3：`src/index.ts` 清理约 14 行废弃导出，`UnifiedConfig.ts` 移除 `EngineConfig` 类型引用

**预期收益**：
- 消除 573 行废弃代码 + 153 行辅助代码（共 726 行）
- SDK 初始化路径唯一，开发者不再困惑于两套 API
- engine/ 不再通过编译期依赖穿透到 CC 模块（initializeEngine 直接 import getTools/getCommands 等）

**对框架的影响**：
- 破坏"包装不替代"原则？否——initializeEngine 本身就是包装层的废弃部分
- 正向影响：engine/bootstrap/ 目录精简，SDK 独立性增强
- 负面影响：CLI 如果依赖 initializeEngine 的 hook 机制，需迁移到 EventBus 事件
- 实施风险：**低**——无外部生产调用方，仅测试和 src/index.ts 导出引用

**符合框架目标**：物理分离 + 独立发布

**依赖关系**：无前置依赖，可立即执行

**验证发现**：
- `validateEngineConfig` 在 `AgentEngine.create()` 中通过 `require()` 动态导入（第 348-349 行），需内联或迁出
- `UnifiedConfig.ts` 的 `EngineConfig` 类型仅作文档注释用途，可直接移除
- Ant 权限过滤逻辑（第 399-411 行）是 CLI 特有的，应在 CLI 入口路径中处理，不进入 AgentEngine

---

### 优化 2：ProviderConfig 类型统一（V7 KR10）

**优化重点**：消除 ProviderConfig 的双重定义，统一到 AgentEngine.ts（引用正式 ProviderConfigs.ts）

**优化目标**：ProviderConfig 类型有且仅有一处定义，类型安全且无重复

**关键结果**：
- KR1：`engine/types.ts` 删除 `ProviderConfig`、`VALID_PROVIDER_TYPES`、`ProviderType` 定义
- KR2：`defaultModel` 字段从 types.ts 版本合并到正式的 `BaseProviderConfig` 或对应 ProviderConfig
- KR3：Session.ts 和 EngineFacade.ts 的 import 路径更新，向后兼容 re-export 保留

**预期收益**：
- 消除类型重复定义，减少维护负担
- SDK 用户使用一致的、类型安全的 ProviderConfig（继承 BaseProviderConfig 的 model/fallbackModel/maxTokens/temperature/topP/retryConfig）
- 新增 Provider 时只需修改一处

**对框架的影响**：
- 破坏"包装不替代"原则？否——纯类型清理
- 正向影响：类型系统更严格，IDE 自动补全更准确
- 负面影响：types.ts 的 `defaultModel` 字段和 `[key: string]: unknown` 索引签名丢失，需确认无外部依赖
- 实施风险：**中**——types.ts 版本含 `defaultModel` 字段，AgentEngine.ts 版本不含，需处理差异

**符合框架目标**：物理分离 + 独立发布

**依赖关系**：无前置依赖，可与优化 1 并行执行

**验证发现**：
- **关键差异**：types.ts 的 config 中包含 `defaultModel` 字段和 `[key: string]: unknown` 索引签名，AgentEngine.ts 版本不含。统一时需决定 `defaultModel` 归入 BaseProviderConfig 还是保留在子类型中
- `VALID_PROVIDER_TYPES` 和 `ProviderType` 两个文件完全重复，types.ts 版本为 `export const`（公开），AgentEngine.ts 版本为 `const`（私有）。合并后保留 AgentEngine.ts 的导出
- 受影响文件仅 2 个（Session.ts、EngineFacade.ts），且 EngineFacade 后续会被删除

---

### 优化 3：消除 EngineFacade 不必要中间层（V7 KR11）

**优化重点**：AgentEngine 直接持有 SessionManager，消除 EngineFacade 1:1 透传层

**优化目标**：SDK 内部调用链从 AgentEngine → EngineFacade → SessionManager 简化为 AgentEngine → SessionManager

**关键结果**：
- KR1：`SessionInfo` 类型从 EngineFacade.ts 迁移到 types.ts，公共 API 导出路径不变
- KR2：AgentEngine 直接持有 SessionManager，`toSessionInfo()` 转换逻辑迁入 AgentEngine 或 SessionManager
- KR3：修复 `setMemoryPath` 中 metadata 赋值不持久化的静默 bug

**预期收益**：
- 消除 204 行中间层代码（EngineFacade.ts）
- 减少 1 层间接调用，调用链更清晰
- 修复 metadata 赋值静默失效 bug
- 消除 deprecated 的 sessionMetadata Map 向后兼容层

**对框架的影响**：
- 破坏"包装不替代"原则？否——EngineFacade 是框架自身的包装层，不是 CC 原始能力
- 正向影响：SDK 内部结构更精简，错误处理统一到 SessionManager
- 负面影响：770 行测试需迁移，AgentEngine.getSession() 内部实现变化（但公共返回类型 SessionInfo 保持不变）
- 实施风险：**中**——需处理 `toSessionInfo()` 转换逻辑迁移和 metadata bug 修复

**符合框架目标**：零 UI 依赖 + 物理分离

**依赖关系**：建议在优化 2（KR10）完成后执行，因为 EngineFacade 需更新 ProviderConfig import

**验证发现**：
- EngineFacade 唯一消费者是 AgentEngine，无其他生产代码依赖
- `toSessionInfo()` 转换逻辑（Session → SessionInfo DTO）是 EngineFacade 的核心价值，需保留
- `wrapSessionOperation()` 错误包装几乎完全冗余——SessionManager 已直接抛 EngineError
- metadata 赋值 bug 确认存在（AgentEngine.ts 第 797 行），赋值到 SessionInfo DTO 不传播回 Session 实体

---

### 优化 4：bootstrap/state 写入收敛到 CCRuntime（V7.5 KR1）

**优化重点**：engine/ 对 bootstrap/state 的 per-session 字段写入收敛到 CCRuntime.setupBootstrap() 单一入口

**优化目标**：engine/ 层与 bootstrap/state 的耦合点收敛为 CCRuntime 接口上的 1 个方法

**关键结果**：
- KR1：确认 engine/ 对 bootstrap/state 的写入已收敛到 `DefaultCCRuntime.setupBootstrap()`（仅 setCwdState/setOriginalCwd/setProjectRoot 3 个 setter）
- KR2：AgentEngine.query() 中通过 SessionContext 管理状态，不再直接写 STATE
- KR3：验证单 workspace 场景行为不变

**预期收益**：
- engine/ 层与全局状态的耦合已最小化（仅 1 处 require），为后续迁移奠定基础
- CCRuntime 接口成为 engine/ 层访问 CC 全局状态的唯一通道

**对框架的影响**：
- 破坏"包装不替代"原则？否
- 正向影响：engine/ 层状态管理独立性增强
- 负面影响：无明显负面影响
- 实施风险：**低**——engine/ 层实际上已经做到了写入收敛

**符合框架目标**：分布式部署（V8 前置）

**依赖关系**：无前置依赖，V7 KR9/KR10/KR11 完成后开始

**验证发现（关键新发现）**：
- **engine/ 层已经完全解耦**！engine/ 目录下没有直接 import `bootstrap/state.js`。唯一的引用在 `DefaultCCRuntime.ts` 中通过 `require()` 动态加载（3 个 setter）
- **KR1 实际上已完成**——写入收敛已经在之前的版本中实现。本次只需确认和审计

---

### 优化 5：CC 原始代码的 per-session 读取迁移策略（V7.5 KR2）

**优化重点**：将 CC 原始代码对 bootstrap/state 的 per-session 读取逐步迁移到 ALS 上下文

**优化目标**：CC 原始代码通过 ALS 获取 sessionId/cwd/projectRoot 等字段，多 workspace 并发不互相覆盖

**关键结果**：
- KR1：bootstrap/state.ts 中的 `getCwdState()`/`getSessionId()`/`getProjectRoot()`/`getOriginalCwd()` 改为"先查 ALS，fallback 全局 STATE"
- KR2：CC 原始代码前 20 个高频调用方验证通过
- KR3：多 workspace 并发场景下各 session 状态互不干扰验证通过

**预期收益**：
- 消除全局状态单 session 假设，SDK 真正支持多 workspace 并发
- 为 V8 分布式部署扫除核心障碍

**对框架的影响**：
- 破坏"包装不替代"原则？否——CC 核心逻辑不变，只改状态读取方式
- 正向影响：多实例部署能力就绪
- 负面影响：121 个文件的间接影响
- 实施风险：**高**

**符合框架目标**：多 Session 并发 + 分布式部署

**依赖关系**：依赖优化 4（KR1 审计确认）

**验证发现（关键风险发现）**：

**ALS 传播覆盖率仅 1%**。CC 原始代码的 query 流程（`query.ts` → `QueryEngine.ts` → `services/api/claude.ts`）**完全不经过** engine/ 的 SessionContext ALS 体系。ALS 仅在 `AgentEngine.query()` 中被建立。

这意味着"先查 ALS，fallback 全局 STATE"的策略在 CC 原始代码中 **99% 的场景都会 fallback**，等于没有迁移。

**迁移策略修正**：

| 原策略 | 问题 | 修正策略 |
|--------|------|---------|
| 修改 getter 内部实现，先查 ALS | CC 代码不在 ALS 上下文内，100% fallback | **不修改 getter 实现**，改为在 CC query 入口处包裹 ALS 上下文 |
| 逐文件修改 121 个 import | 改动面太大，风险不可控 | **不改调用方**，改 bootstrap/state.ts 的 setter 实现写入 ALS |
| 一步到位 | ALS 覆盖率太低 | **分步走**：先让 setter 写入 ALS，再让 getter 从 ALS 读取 |

**具体路径**：
1. 修改 `setCwdState()`/`setSessionId()` 等核心 setter，同时写入全局 STATE 和 ALS SessionContext（双写）
2. 修改 `getCwdState()`/`getSessionId()` 等核心 getter，优先从 ALS 读取
3. 在 CC query 入口（`REPL.tsx`/`main.tsx` 的 query 调用链）外包裹 `runInSessionContext()`
4. 但这需要 bootstrap/state.ts 引入对 `engine/session/SessionContextStorage.ts` 的依赖——**存在循环依赖风险**

**循环依赖风险分析**：
- `bootstrap/state.ts` 是 import DAG 的叶子节点
- 如果它反向依赖 `engine/session/SessionContextStorage.ts`，会引入循环
- 解决方案：引入独立的 `SessionContextBridge.ts`（位于 `bootstrap/` 或新建 `shared/` 目录），不依赖 engine/ 层

---

### 优化 6：成本/Token 状态 ALS 化（V7.5 KR3）

**优化重点**：totalCostUSD/modelUsage 等 8 个累积指标写入 SessionContext

**优化目标**：query 结束后指标写入 SessionContext + ISessionStore，不再依赖全局 STATE 累加

**关键结果**：
- KR1：`addToTotalCostState()` 等累积函数同时写入 SessionContext
- KR2：`setCostStateForRestore()` 从 SessionContext 恢复成本数据
- KR3：query 结束时 SessionContext 成本字段与 STATE 保持一致

**预期收益**：
- 成本数据随 Session 生命周期管理，session 恢复时成本数据完整
- 多实例部署时每个实例的成本数据独立

**对框架的影响**：
- 实施风险：**中**——需要修改 `cost-tracker.ts` 和 `services/api/logging.ts` 中的写入逻辑

**依赖关系**：依赖优化 5（ALS 上下文可用）

---

### 优化 7：SessionContext 序列化增强（V7.5 KR4）

**优化重点**：补全 SessionContextSnapshot 中缺失的字段

**优化目标**：SessionContextSnapshot 覆盖所有 per-session 状态，序列化/反序列化往返验证通过

**关键结果**：
- KR1：当前仅覆盖 5 个字段（sessionId/cwd/projectRoot/memoryPath/version），需扩展到 27+ 个 per-session 字段
- KR2：`restoreSessionContextFromSnapshot()` 完整还原所有字段
- KR3：序列化往返测试通过

**预期收益**：
- SDK 可在进程重启后从存储完整恢复 session 状态
- 为 V8 分布式基础设施提供完整的状态迁移能力

**对框架的影响**：
- 实施风险：**低**——纯增量修改，不影响现有逻辑

**验证发现**：
- 当前覆盖度仅 **18%**（5/27 个 per-session 字段）
- 但约 80% 的 per-session 字段通过 `setCostStateForRestore()` 和 `sessionRestore.ts` 的零散逻辑间接恢复
- 序列化增强是将这些零散恢复路径统一到 SessionContextSnapshot 中

**依赖关系**：依赖优化 6（成本字段写入 SessionContext 后才可序列化）

---

### 优化 8：bootstrap/state 降级审计（V7.5 KR5）

**优化重点**：确认 bootstrap/state.ts 仅保留进程级配置

**优化目标**：per-session 字段引用数为 0，bootstrap/state 降级为约 12 项进程级配置的管理器

**关键结果**：
- KR1：grep 审计确认 per-session getter/setter 无 CC 原始代码引用（仅 engine/ 通过 CCRuntime 间接使用）
- KR2：bootstrap/state.ts 保留的字段仅为：OTel/日志/ClientType/SdkBetas/StatsStore 等 ~12 项

**预期收益**：
- 全局状态单例降级为轻量配置管理器
- SDK 的状态管理完全通过 SessionContext + ISessionStore

**对框架的影响**：
- 实施风险：**低**——审计确认性质，无代码改动

**依赖关系**：依赖优化 5-7 全部完成

---

## 四、执行依赖关系

```
优化 1 (KR9: initializeEngine) ──┐
优化 2 (KR10: ProviderConfig) ──┤── V7 技术债收尾（可并行）
优化 3 (KR11: EngineFacade) ────┘    ↑ 依赖优化 2
        │
        ▼
优化 4 (V7.5 KR1: 写入收敛审计) ── 实际已大部分完成
        │
        ▼
优化 5 (V7.5 KR2: 读取迁移) ──── 高风险，核心阻塞项
        │                         需解决 ALS 覆盖率 + 循环依赖
        ▼
优化 6 (V7.5 KR3: 成本 ALS 化) ── 依赖优化 5
        │
        ▼
优化 7 (V7.5 KR4: 序列化增强) ── 依赖优化 6
        │
        ▼
优化 8 (V7.5 KR5: 降级审计) ──── 依赖优化 5-7
```

**建议分两批执行**：

**第一批（V21 核心迭代）**：优化 1 + 优化 2 + 优化 3
- 全部为 V7 技术债清理，风险可控
- 预计涉及文件：15-20 个生产代码文件 + 3 个测试文件
- 无架构级风险

**第二批（V21.5 或 V22）**：优化 4 + 优化 5 + 优化 6 + 优化 7 + 优化 8
- 需要解决 ALS 覆盖率问题（核心阻塞项）
- 建议引入 `SessionContextBridge.ts` 桥接层解决循环依赖
- 涉及修改 `bootstrap/state.ts` 的 getter/setter 实现（121+ 文件间接影响）
- 建议 Phase 2 先做写入双写（setter 同时写 STATE + ALS），Phase 3 再做读取迁移（getter 优先 ALS）

---

## 五、新增风险发现

### 风险 1：ALS 传播覆盖率不足（P0）

**发现**：CC 原始代码的 query 流程完全不经过 engine/ 的 SessionContext ALS 体系。ALS 仅在 `AgentEngine.query()` 中被建立。CC 代码通过 `REPL.tsx`/`main.tsx` 直接调用自己的 query 流程。

**影响**：V7.5 的"修改 getter 从 ALS 读取"策略在 CC 代码中 99% 的场景会 fallback 到全局 STATE，等于没有迁移。

**缓解**：改为"先让 setter 写入 ALS（双写），再在 CC query 入口包裹 ALS 上下文"的渐进策略。引入 `SessionContextBridge.ts` 解决循环依赖。

### 风险 2：ProviderConfig 统一的 defaultModel 字段差异（P1）

**发现**：types.ts 版本的 ProviderConfig 包含 `defaultModel` 字段，AgentEngine.ts 版本不含。统一时如果直接删除 types.ts 版本，可能丢失 `defaultModel` 的类型支持。

**影响**：SDK 用户使用 ProviderConfig 时无法配置 defaultModel。

**缓解**：将 `defaultModel` 合并到 `BaseProviderConfig`（在 `engine/provider/types/ProviderConfigs.ts` 中），或保留为各子类型的显式字段。

### 风险 3：EngineFacade toSessionInfo() 转换逻辑的归属（P2）

**发现**：EngineFacade 的 `toSessionInfo()` 将 Session 实体转为 SessionInfo DTO，包含 metadata 合并、systemPrompt/providerConfig 提取。消除 EngineFacade 后，这个转换逻辑需迁入 SessionManager 或 AgentEngine。

**影响**：如果迁入 SessionManager，SessionManager 需要了解 SessionInfo 的公共 API 形状（DTO 关注点泄漏到内部组件）。如果迁入 AgentEngine，AgentEngine 的复杂度增加。

**缓解**：迁入 AgentEngine，作为 `private toSessionInfo()` 私有方法。SessionManager 保持返回原始 Session 实体。

---

## 六、后续行动建议

1. **立即执行第一批**（优化 1+2+3）：这三个优化风险低、收益明确、无架构级阻塞。建议作为 V21 的核心交付物。

2. **第二批先做验证 POC**：优化 5（ALS 读取迁移）的风险最高，建议先做一个小规模 POC——在 `bootstrap/state.ts` 中选一个字段（如 `getSessionId()`）实现"setter 双写 + getter ALS 优先"，验证循环依赖和 ALS 上下文可用性。POC 成功后再扩大范围。

3. **SessionContextBridge 引入时机**：如果在 POC 中确认了循环依赖问题，在第二批正式开始前引入 `SessionContextBridge.ts`（独立于 engine/ 层的 ALS 桥接层）。

4. **不建议合并到一次迭代**：第一批（3 个优化）和第二批（5 个优化）的风险级别差异太大。强行合并可能导致第二批的高风险问题阻塞第一批的低风险收益。建议分两个版本（V21 + V22）执行。

---

## 七、V21 建议执行范围

| 优化 | 是否纳入 V21 | 理由 |
|------|-------------|------|
| 优化 1 (KR9) | ✅ 纳入 | 低风险，无外部依赖 |
| 优化 2 (KR10) | ✅ 纳入 | 低-中风险，需处理 defaultModel |
| 优化 3 (KR11) | ✅ 纳入 | 中风险，依赖优化 2 |
| 优化 4 (V7.5 KR1) | ✅ 纳入（审计确认） | 大部分已完成，仅需审计 |
| 优化 5 (V7.5 KR2) | ❌ 延后到 V22 | 高风险，需先做 POC |
| 优化 6 (V7.5 KR3) | ❌ 延后到 V22 | 依赖优化 5 |
| 优化 7 (V7.5 KR4) | ❌ 延后到 V22 | 依赖优化 6 |
| 优化 8 (V7.5 KR5) | ❌ 延后到 V22 | 依赖优化 5-7 |
