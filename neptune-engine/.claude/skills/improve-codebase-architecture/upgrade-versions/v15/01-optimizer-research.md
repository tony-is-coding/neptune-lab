# V15 优化清单：性能、效果、架构设计深度优化

> 版本：V15
> 分析日期：2026-04-28
> 分析范围：src/engine/ 及 src/ 全量代码，聚焦性能/效果/架构三个维度
> 基于：V14 完成后的代码状态（engine/ 50 测试文件、753 用例、SDK 构建通过）

---

## 一、框架现状分析

### 1.1 整体状态

经过 V1-V14 的持续优化，框架核心能力已基本完备：

| 维度 | 状态 | 说明 |
|------|------|------|
| 物理分离 | ✅ 完成 | CLI/SDK 目录清晰分离 |
| SDK 构建 | ✅ 完成 | build:sdk 通过，类型声明可用 |
| 测试覆盖 | ✅ 完成 | engine/ 753 用例，~90% 覆盖 |
| e2e 验证 | ✅ 完成 | e2e_cli 类型安全 |
| Provider 可选化 | ✅ 完成 | bedrock/vertex/foundry 可选安装 |

### 1.2 本次分析发现的关键问题

三个维度深度分析共发现 **30+ 个具体问题**，归纳为以下核心领域：

**性能维度（影响生产可靠性）**：
- AsyncGenerator 资源泄漏：`runInSessionContextAsync` 的 wrapper 不处理 `.return()`/`.throw()`，消费者提前退出时底层流不关闭
- `sessionMessages` 无大小上限：加载大型 transcript 可能导致 OOM
- `waitForResultWithTimeout` 超时后不关闭底层 AsyncGenerator
- SQLiteSessionStore 同步操作阻塞事件循环
- Provider 适配器 AsyncGenerator 无 finally 清理

**效果维度（影响开发者体验）**：
- 两套不同的 `EngineConfig` / `AgentEngineConfig` 类型，用户极易混淆
- `Tool` 类型在 `engine/` 和 `src/` 的导出完全不兼容
- 错误信息中英文混杂，同一语义错误语言不同
- `ProviderConfig.config` 是 `Record<string, unknown>`，用户无法知道各 provider 需要什么配置
- `CircuitBreaker` 抛原生 `Error` 而非 `EngineError`，用户无法统一捕获

**架构维度（影响可维护性和扩展性）**：
- `buildQueryEngineConfig` 返回值 `as any`，整个 query 执行路径无编译时类型检查
- `destroySession()` 不清理 `sessionMetadata`、外部 signal 监听器、QueryEngine 实例
- 同一 Session 并发 `query()` 无互斥保护
- `initializeRuntime` 的 `setupBootstrap` 修改全局状态，多 workspace 并发时可能串扰
- EventBus `subscribe` vs `on` API 不一致，`on()` 不支持 sessionId 过滤

---

## 二、框架目标对齐分析

| 目标（project-purpose.md） | 当前状态 | 差距 | V15 可推进 |
|--------------------------|---------|------|-----------|
| 物理分离完成 | ✅ V1-V9 完成 | — | — |
| 独立发布就绪 | ✅ SDK 构建通过 | — | — |
| 零 UI 依赖 | ✅ engine/ 零 React | — | — |
| 测试覆盖 ≥ 90% | ✅ 753 用例 | — | — |
| SDK 包 < 2MB | ✅ 构建通过 | — | — |
| 多 Session 并发 ≥ 10 | ⚠️ 单线程安全但无互斥 | 并发 query 无锁、全局状态串扰 | ✅ 高优先 |
| 单 Session 内存 < 100MB | ⚠️ 无 transcript 大小限制 | sessionMessages 可能 OOM | ✅ 高优先 |
| API 文档完整 | ❌ 无 TypeDoc | KR10 遗留 | ✅ 中优先 |
| 接入成本 < 1 天 | ⚠️ 类型混乱 | 两套 Config、Tool 类型不兼容 | ✅ 高优先 |
| 错误信息清晰可操作 | ❌ 中英混杂、类型不统一 | CircuitBreaker 不用 EngineError | ✅ 高优先 |

---

## 三、优化清单（按优先级排序）

### Opt 1：AsyncGenerator 资源生命周期管理（P1）

**优化重点**：修复 AsyncGenerator 在提前退出/超时/中断场景下的资源泄漏

**优化目标**：所有 AsyncGenerator 在消费者提前退出时，底层资源（网络连接、流、上下文）被正确清理

**关键结果**：
- KR1：`runInSessionContextAsync` 的 wrapper generator 实现 `.return()` 和 `.throw()` 方法，确保内部 generator 被正确关闭
- KR2：`waitForResultWithTimeout` 超时时显式调用 `messages.return()` 关闭 generator
- KR3：Provider 适配器的 `query()` AsyncGenerator 添加 `finally` 块清理 stream
- KR4：新增 5+ 个测试用例验证提前退出场景

**预期收益**：生产环境下长时间运行的 Agent 不会因资源泄漏而逐渐变慢或崩溃

**对框架的影响**：
- 不破坏框架原则 — 只修复资源清理逻辑
- 正向：生产可靠性大幅提升，长时间运行场景稳定
- 负面：无
- 风险：低 — 在 finally/return 块中添加清理代码，不影响正常路径

**符合框架目标**：多 Session 并发 ≥ 10、单 Session 内存 < 100MB（project-purpose.md 七、性能指标）

**依赖关系**：无

---

### Opt 2：API 类型体系统一与强化（P1）

**优化重点**：统一 `engine/` 和 `src/` 的类型导出，消除 `as any` 逃逸

**优化目标**：SDK 用户从任何入口点导入时获得一致、类型安全的 API

**关键结果**：
- KR1：合并/统一 `EngineConfig`（bootstrap）、`AgentEngineConfig`（AgentEngine）为单一 `AgentEngineConfig`，废弃 bootstrap 的 `EngineConfig`
- KR2：统一 `Tool` 类型定义 — `ToolExtension` 中的 `Tool` 与 `src/Tool.ts` 的 `Tool` 建立明确的适配关系
- KR3：`ProviderConfig.type` 改为联合类型 `'anthropic' | 'bedrock' | 'vertex' | 'foundry' | 'openai' | 'gemini' | 'grok'`
- KR4：`ProviderConfig.config` 为每种 Provider 提供结构化类型（而非 `Record<string, unknown>`）
- KR5：`AssistantTextEvent.content` 类型改为 `string`，`ErrorEvent.error` 类型改为 `Error`
- KR6：生产代码中 `as any` 减少 50%+（当前约 20 处）

**预期收益**：IDE 类型提示准确，编译时捕获配置错误，接入成本从"需要看源码"降到"IDE 提示即可"

**对框架的影响**：
- 不破坏框架原则 — 只改类型定义和导出，不改运行时逻辑
- 正向：DX 大幅提升，编译时安全保障
- 负面：部分公共类型签名变更（向后不兼容）
- 风险：中 — 类型变更可能影响已有用户代码，需要版本化处理

**符合框架目标**：接入成本 < 1 天、API 文档完整覆盖（project-purpose.md 七、开发体验）

**依赖关系**：无

---

### Opt 3：错误处理体系统一（P1）

**优化重点**：统一错误语言、错误类、错误码，让 SDK 用户可以可靠地捕获和处理错误

**优化目标**：所有 engine/ 抛出的错误都是 `EngineError` 实例，错误信息使用统一语言（英文），包含可操作的修复建议

**关键结果**：
- KR1：所有错误信息统一为英文（当前中英文混杂），格式为 `"[ErrorCode] Description. Suggestion: ..."`
- KR2：`CircuitBreaker` 抛出 `EngineError` 而非原生 `Error`，新增 `CIRCUIT_OPEN` 错误码
- KR3：`classifyQueryError` 从字符串匹配改为基于错误对象属性的结构化分类
- KR4：关键错误场景添加修复建议（如 `memoryRoot 未配置` → `"Set memoryRoot in AgentEngineConfig.options"`）
- KR5：新增 `EngineErrorCode` 枚举值覆盖所有当前错误场景

**预期收益**：SDK 用户可以 `try/catch` 统一处理所有错误，通过 `error.code` 做程序化处理，通过 `error.message` 获取可操作的修复信息

**对框架的影响**：
- 不破坏框架原则 — 只改错误抛出方式，不改业务逻辑
- 正向：生产可调试性大幅提升
- 负面：错误信息语言变更（中→英），依赖错误消息文本的用户代码需要调整
- 风险：低

**符合框架目标**：错误信息清晰、可操作（project-purpose.md 七、开发体验）

**依赖关系**：无

---

### Opt 4：Session 生命周期资源完整性（P1）

**优化重点**：修复 `destroySession`/`destroy` 中的资源清理遗漏

**优化目标**：Session 从创建到销毁的完整生命周期中，所有关联资源被正确清理

**关键结果**：
- KR1：`EngineFacade.destroySession()` 清理 `sessionMetadata` 中对应条目
- KR2：`AgentEngine.destroySession()` 中 abort 正在执行的 query 并清理 `activeAbortControllers`
- KR3：`AgentEngine.destroy()` 和 `query()` 的 finally 块中移除外部 `signal` 上注册的 abort 监听器
- KR4：`destroySession` 后清理 `tokenBudgetStates` 中对应 session 的条目
- KR5：新增 3+ 个测试验证 destroy 后资源清理完整性

**预期收益**：长时间运行的 SDK 实例在反复创建/销毁 Session 后不会累积资源泄漏

**对框架的影响**：
- 不破坏框架原则
- 正向：内存和资源管理可靠性提升
- 负面：`destroySession` 对正在执行的 query 会 abort，行为变更需文档说明
- 风险：中 — 需要确保 abort 操作不会导致数据不一致

**符合框架目标**：多 Session 并发 ≥ 10（project-purpose.md 七、性能指标）

**依赖关系**：建议在 Opt 1 之后执行（AsyncGenerator 清理是基础）

---

### Opt 5：sessionMessages 内存保护（P2）

**优化重点**：为 `sessionMessages` 加载添加大小限制，防止 OOM

**优化目标**：加载大型 transcript 时不会导致内存暴涨，提供分页/截断机制

**关键结果**：
- KR1：`loadSession()` 加载 transcript 时添加最大消息数限制（默认 10000 条），超出时截断最早的消息
- KR2：`sessionMessages` Map 添加 per-session 大小上限（可配置）
- KR3：超出限制时发出 `EngineError(WARNING, ...)` 日志但不中断加载

**预期收益**：SDK 在恢复大型历史会话时内存可控

**对框架的影响**：
- 不破坏框架原则
- 正向：内存安全性提升
- 负面：截断可能导致早期上下文丢失
- 风险：低 — 截断行为可配置

**符合框架目标**：单 Session 内存 < 100MB（project-purpose.md 七、性能指标）

**依赖关系**：无

---

### Opt 6：Provider LLMRuntime 统一接口（P2）

**优化重点**：封装 7 个 Provider 的 LLM API 调用为统一接口（OKR KR9）

**优化目标**：所有 Provider 适配器实现统一的 `LLMRuntime` 接口，消除 `as any[]` 类型逃逸

**关键结果**：
- KR1：定义 `LLMRuntime` 接口（`query(params) → AsyncGenerator<LLMEvent>`），所有 Provider 实现该接口
- KR2：消除 Provider 适配器中 `messages as any[]` 和 `tools as any[]`（当前 8 个适配器共 16 处）
- KR3：`ProviderRegistry` 支持 `getRuntime(type: string) → LLMRuntime` 查询

**预期收益**：用户可以通过统一接口调用任意 Provider 的 LLM，无需关心底层差异

**对框架的影响**：
- 不破坏框架原则 — "包装不替代"，在现有适配器之上增加统一抽象
- 正向：Provider 可插拔、可扩展
- 负面：增加一层抽象，但接口薄
- 风险：中 — 需要确保 7 个 Provider 的差异能在统一接口中表达

**符合框架目标**：独立发布就绪、Provider 可用（project-purpose.md 六、"完成"的定义 第2条）

**依赖关系**：建议在 Opt 2 之后执行（类型体系统一是基础）

---

### Opt 7：EventBus API 增强（P2）

**优化重点**：统一 EventBus API、完善 sessionId 过滤、修复 TTL timer 泄漏

**优化目标**：EventBus 的 `subscribe`/`on`/`unsubscribe` API 行为一致，TTL timer 不泄漏

**关键结果**：
- KR1：`on()` 方法支持 `options?: { sessionId?: string }` 参数，与 `subscribe()` 行为统一
- KR2：`on()` 返回的 unsubscribe 函数同时清理对应的 TTL timer
- KR3：TTL timer 触发后从 `ttlTimers` 数组中移除自身引用
- KR4：`subscribe()` 返回取消函数（当前返回 `void`），与 `on()` 一致

**预期收益**：EventBus 使用更直觉，订阅者管理更安全

**对框架的影响**：
- 不破坏框架原则
- 正向：API 一致性提升
- 风险：低 — `subscribe()` 改为返回取消函数是向后兼容的（之前返回 void，用户不太可能依赖）

**符合框架目标**：API 文档完整、接入成本 < 1 天

**依赖关系**：无

---

### Opt 8：同一 Session query 互斥保护（P2）

**优化重点**：为同一 Session 的并发 query 添加互斥保护

**优化目标**：同一 Session 同时只能有一个活跃的 query，重复调用抛出明确错误

**关键结果**：
- KR1：`AgentEngine.query()` 入口添加 per-session 查询互斥锁
- KR2：重复调用时抛出 `EngineError(SESSION_BUSY, "Session 'xxx' already has an active query")`
- KR3：query 完成（包括 abort/异常）后自动释放锁
- KR4：新增 2+ 个测试验证并发 query 场景

**预期收益**：防止用户意外并发调用导致的状态混乱

**对框架的影响**：
- 不破坏框架原则
- 正向：状态一致性保障
- 风险：低 — 增加互斥检查

**符合框架目标**：多 Session 并发可靠性

**依赖关系**：建议在 Opt 4 之后执行

---

### Opt 9：SQLiteSessionStore 异步化（P2）

**优化重点**：将 SQLiteSessionStore 的同步操作改为异步，避免阻塞事件循环

**优化目标**：SQLite 操作不阻塞事件循环，支持高并发写入场景

**关键结果**：
- KR1：`save`/`load`/`list`/`delete` 方法使用 `bun:sqlite` 的异步 API（如果可用）或包装为 `setImmediate` 降级
- KR2：构造函数中 `PRAGMA journal_mode=WAL` 添加错误处理
- KR3：新增 `close()` 调用保护（幂等性检查）

**预期收益**：写入密集场景下 SDK 不会卡住

**对框架的影响**：
- 不破坏框架原则
- 正向：性能提升
- 风险：低 — 内部实现变更，公共接口不变

**符合框架目标**：多 Session 并发 ≥ 10、高性能

**依赖关系**：无

---

### Opt 10：TypeDoc API 文档生成（P2）

**优化重点**：完成 V14 T9 遗留的 TypeDoc 配置和文档生成（OKR KR10）

**优化目标**：`bun run docs:api` 生成完整的 SDK 公共 API 文档

**关键结果**：
- KR1：TypeDoc 配置完成，与 Bun TS 兼容
- KR2：engine/ 公共 API 文档覆盖率 100%
- KR3：文档输出到 `docs/api/` 目录

**预期收益**：SDK 用户有完整的 API 参考文档

**对框架的影响**：
- 不破坏框架原则 — 只增加文档工具
- 正向：DX 大幅提升
- 风险：低

**符合框架目标**：API 文档完整覆盖（OKR KR10）

**依赖关系**：建议在 Opt 2 之后执行（类型统一后文档才准确）

---

## 四、优化点依赖关系

```
Opt 1 (AsyncGenerator清理) ──→ Opt 4 (Session生命周期) ──→ Opt 8 (query互斥)

Opt 2 (类型体系统一) ──→ Opt 6 (Provider LLMRuntime)
                    └──→ Opt 10 (TypeDoc)

Opt 3 (错误处理统一) ────→ 独立

Opt 5 (sessionMessages保护) ────→ 独立

Opt 7 (EventBus增强) ────→ 独立

Opt 9 (SQLite异步化) ────→ 独立
```

**关键路径**：Opt 2 → Opt 6 → Opt 10（类型统一 → Provider 接口 → 文档生成）

**可并行**：Opt 1/3/5/7/9 之间无依赖

---

## 五、执行策略建议

### 阶段 A：资源安全（Opt 1 + Opt 4）

**目标**：AsyncGenerator 资源泄漏修复 + Session 生命周期清理完整

**关键改动**：
1. `runInSessionContextAsync` wrapper generator 实现 `.return()`/`.throw()`
2. `waitForResultWithTimeout` 超时时关闭底层 generator
3. Provider 适配器 `query()` 添加 finally 清理
4. `destroySession` 清理所有关联资源

### 阶段 B：类型与错误统一（Opt 2 + Opt 3）

**目标**：API 类型体系统一 + 错误处理体系统一

**关键改动**：
1. 统一 `AgentEngineConfig`，废弃重复的 `EngineConfig`
2. ProviderConfig 结构化类型
3. 错误信息统一为英文
4. CircuitBreaker 使用 EngineError

### 阶段 C：功能增强（Opt 5-9）

**目标**：内存保护 + EventBus + query 互斥 + SQLite + Provider LLMRuntime

**并行分配**：
- developer-1：Opt 5（内存保护）+ Opt 6（Provider LLMRuntime）+ Opt 9（SQLite）
- developer-2：Opt 7（EventBus）+ Opt 8（query 互斥）

### 阶段 D：文档（Opt 10）

**目标**：TypeDoc API 文档生成

---

## 六、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| AsyncGenerator `.return()` 实现复杂 | 中 | 参考标准 AsyncGenerator cleanup 模式，逐步测试 |
| 类型统一导致向后不兼容 | 中 | 保留旧类型作为 deprecated alias，过渡期 2 个版本 |
| 错误信息语言变更影响已有用户 | 低 | 错误码不变，只改 message 文本 |
| Provider LLMRuntime 抽象层过厚 | 低 | 接口设计参考现有 adapter，最小抽象 |
| TypeDoc 与 Bun TS 兼容性 | 中 | 使用 TypeDoc 0.26+ ESM 支持 |

---

## 七、OKR 对齐更新

本次 V15 执行完成后，OKR 路线图预期进度：

| KR | 描述 | 当前进度 | V15 后预期 |
|----|------|---------|-----------|
| KR1 | API 文档覆盖全部公共方法 | 未开始 | ⏳ 取决于 Opt 10 |
| KR2 | 快速开始指南 + 3 个示例 | 未开始 | ⏳ 不在 V15 范围 |
| KR9 | Provider LLMRuntime 统一接口 | 未开始 | ✅ 完成（Opt 6） |
| KR10 | TypeDoc API 文档 | ⏳ 部分 | ✅ 完成（Opt 10） |
| V5 整体 | 交付验收 | ~90% | ~95% |

### 新增 KR（V15 发现）

| KR | 描述 | 优先级 | 来源 |
|----|------|--------|------|
| KR14 | AsyncGenerator 资源生命周期管理 | P1 | V15 深度分析 |
| KR15 | API 类型体系统一（消除 as any） | P1 | V15 深度分析 |
| KR16 | 错误处理体系统一（中英混杂、EngineError） | P1 | V15 深度分析 |
| KR17 | Session 生命周期资源完整性 | P1 | V15 深度分析 |
| KR18 | sessionMessages 内存保护 | P2 | V15 深度分析 |
| KR19 | EventBus API 增强 | P2 | V15 深度分析 |
| KR20 | query 互斥保护 | P2 | V15 深度分析 |
