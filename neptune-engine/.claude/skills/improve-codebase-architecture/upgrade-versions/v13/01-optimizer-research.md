# V13 框架深度分析报告

> 版本：V13
> 分析日期：2026-04-28
> 分析范围：claude-code/ 整体框架（性能、效果、架构设计三维度）
> 前置版本：V12（SDK 质量与生产就绪，14 任务已完成）

---

## 一、框架现状分析

### 1.1 整体架构成熟度

经过 V1-V12 共 12 轮优化，`src/engine/` SDK 核心层已具备：

| 维度 | 当前状态 | 评价 |
|------|---------|------|
| 物理分离 | CLI 代码已迁出，engine/ 零直接 React import | ✅ 成熟 |
| 分层治理 | lint:layers CI 守护，engine/ 无循环依赖 | ✅ 成熟 |
| Provider 体系 | 7 个 Provider + BaseProvider 抽象 + 错误分类 | ✅ 基本可用 |
| 事件系统 | EventBus 推+拉双路，Hook 拦截管道，无限递归防护 | ✅ 成熟 |
| 存储层 | ISessionStore + IBackend<T> 双体系 | ⚠️ 两套并存未统一 |
| 资源管理 | destroy + gracefulShutdown + dispose 链 | ⚠️ 存在泄漏风险 |
| 测试覆盖 | 395 用例，20 个测试文件 | ⚠️ 约 60%，目标 90% |
| SDK 发布 | package.json exports 配置了，但构建产物缺失 | ❌ 不可发布 |

### 1.2 代码规模

| 区域 | 文件数 | 说明 |
|------|--------|------|
| engine/ | ~80 | SDK 核心，状态良好 |
| services/ | ~284 | CC 原始服务，稳定 |
| utils/ | ~816 | CC 工具函数，稳定 |
| 其他 src/ | ~200 | types/constants/bootstrap 等 |

### 1.3 关键风险摘要

通过 5 维度并行深度扫描（API 表面、依赖关系、SDK 轻量化、运行时性能、错误处理），发现以下系统性风险：

1. **SDK 类型安全缺失**：`query()` 返回类型等同于 `any`，事件系统无类型映射
2. **SDK 发布流程断裂**：构建产物不存在，package.json 配置自相矛盾
3. **React 类型穿透**：engine/ 通过 Tool.ts → toolTypes.ts 间接依赖 React 类型
4. **资源泄漏风险**：destroyed Session 滞留内存、进行中查询不会被取消、全局状态与实例生命周期绑定
5. **Provider 缺乏弹性**：无重试、无熔断、错误码声明但未使用
6. **cc-runtime 抽象不完整**：仅覆盖 QueryEngine 创建路径，Provider/Bootstrap/Hooks 绕过直接引用

---

## 二、框架目标对齐分析

| 项目目标（project-purpose.md） | 当前对齐度 | 差距 | V13 优化覆盖 |
|-------------------------------|-----------|------|-------------|
| 嵌入业务应用（Express/Koa/Electron） | 70% | SDK 不可独立发布，类型不安全 | 优化 1, 2, 3 |
| 被 CLI/Web/App 服务端复用 | 80% | 资源泄漏影响长时运行服务 | 优化 4, 5 |
| 支持多 Session 并发 | 75% | Session 内存滞留，无并发保护 | 优化 4, 7 |
| 支持暂停/恢复/事件监听 | 85% | 事件无类型安全，无背压保护 | 优化 1, 10 |
| 零 UI 依赖 | 90% | React 类型穿透到 .d.ts | 优化 3 |
| 独立 npm install | 30% | 构建产物缺失，依赖未拆分 | 优化 2, 7 |
| API 文档完整覆盖 | 40% | 无 API 文档生成流程 | 优化 9 |
| 测试覆盖 ≥ 90% | 60% | 395 用例，log/storage 未覆盖 | 优化 8, 10 |
| SDK 包 < 2MB | ❌ 不可测 | 当前无独立 SDK 构建 | 优化 2, 7 |
| 接入成本 < 1 天 | 60% | 示例可运行但类型混乱 | 优化 1, 2, 9 |

---

## 三、优化清单（TOP 10，按优先级排序）

### 优化 1：SDK 公共 API 类型安全加固（P0）

**优化重点**：让 SDK 用户获得完整的编译时类型安全

**优化目标**：`query()` 返回精确的联合类型，事件系统支持类型映射，公共 API 零 `any`

**关键结果**：
- KR1：`query()` 返回类型从 `AsyncGenerator<SDKMessage>` 改为 `AsyncGenerator<QueryEvent>`，QueryEvent 包含 5 种变体的精确联合类型
- KR2：`on()/once()` 支持泛型事件映射 `EngineEventMap`，编译时捕获事件名和 payload 类型错误
- KR3：`ISessionStore` 的 `Session` 类型依赖问题解决——导出 `Session` 或改用 `SessionSnapshot`

**预期收益**：
- SDK 用户从"盲猜字段"变为"IDE 自动补全"，开发效率提升 3-5x
- 编译时捕获类型错误，减少运行时 bug
- 与 OpenAI/Stripe 等企业级 SDK 的 API 质量对齐

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，仅修改 engine 层类型定义和导出
- 正向影响：公共 API 变得更严谨，SDK 用户更信任框架
- 负面影响：部分类型变更可能需要 e2e_cli 更新 import
- 实施风险：低——纯类型层面修改，不影响运行时行为

**符合框架目标**：project-purpose.md "功能完整性 > API 稳定" + "开发体验 > 接入成本 < 1 天"

**依赖关系**：无前置依赖

---

### 优化 2：SDK 发布就绪度修复（P0）

**优化重点**：修复 package.json 配置和构建流程，使 SDK 可以独立发布

**优化目标**：`bun run build:sdk` 产出可发布的 dist/ 目录，npm pack 验证通过

**关键结果**：
- KR1：package.json 的 `exports.default` 指向编译后的 `./dist/` 而非源码 `./src/`，与 `types` 条件一致
- KR2：移除通配符导出 `"./*": "./src/*.ts"`，只保留设计好的公共路径（engine、engine/*）
- KR3：SDK 构建产物通过 `tsconfig.sdk.json` 编译，产出 `dist/sdk/` + `.d.ts` 声明文件
- KR4：`files` 字段包含 `dist` 和 `src`（或改用构建产物），`npm pack` 后验证 import 正常

**预期收益**：
- SDK 可通过 `npm install` 独立安装使用
- 不再暴露内部实现细节（通配符导出是安全隐患）
- SDK 用户获得声明文件，IDE 自动补全完整

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，纯构建配置修改
- 正向影响：达到"独立发布就绪"的里程碑
- 负面影响：构建流程变更需要 CI 适配
- 实施风险：中——需要确保构建产物与源码行为一致

**符合框架目标**：project-purpose.md "独立发布就绪" + "SDK 包 < 2MB"

**依赖关系**：无前置依赖，可与优化 1 并行

---

### 优化 3：React 类型穿透切断（P0）

**优化重点**：彻底消除 engine/ 对 React 类型的传递性依赖

**优化目标**：SDK 的 `.d.ts` 声明文件中零 `React` 引用，SDK 用户无需安装 `@types/react`

**关键结果**：
- KR1：`src/types/toolTypes.ts` 中 `UITool` 的 `ReactNode` 引用拆分为 `toolTypes.ts`（核心）+ `toolTypes.ui.ts`（UI 部分，含 React）
- KR2：`src/Tool.ts` 中 7 处 `React.ReactNode` 返回类型改为 `unknown` 或抽取到 UI 适配层
- KR3：`engine/tools/ToolAdapter.ts` 中 `null as React.ReactNode` 改为 `null as unknown`
- KR4：SDK 的 `.d.ts` 产物中 `grep -r "react"` 结果为零

**预期收益**：
- SDK 用户安装后无需额外安装 React 类型包
- SDK 包体积进一步减小（排除 React 类型声明）
- 验证"零 UI 依赖"原则真正落地到类型系统

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，类型拆分不影响运行时
- 正向影响：核心状态零 React（F3 原则）从运行时延伸到类型系统
- 负面影响：CLI 侧的 Tool 类型引用需要从 `toolTypes.ts` 改为 `toolTypes.ui.ts`
- 实施风险：低——类型级拆分，IDE 会即时提示需要更新的引用

**符合框架目标**：architecture-design.md "F3 核心状态零 React" + project-purpose.md "零 UI 依赖"

**依赖关系**：优化 2（SDK 构建产物验证需要在类型拆分后执行）

---

### 优化 4：资源生命周期管理闭环（P0）

**优化重点**：修复资源泄漏，确保 SDK 在长时间运行服务中稳定可靠

**优化目标**：AgentEngine.destroy() 保证零资源泄漏，支持优雅取消进行中查询

**关键结果**：
- KR1：`destroySession()` 后 Session 立即从 Map 移除（或确保 GC 定时器默认启动），修复 destroyed Session 无限期驻留内存
- KR2：`destroy()` 中使用 `AbortController` 取消所有活跃的 `query()` AsyncGenerator，修复进行中查询不会被中断
- KR3：`tokenBudgetStates` 从模块级全局 Map 改为 `SessionManager` 实例属性或 `WeakMap`，修复多实例共享全局状态
- KR4：`gracefulShutdown` 默认改为 `exit: false`，修复 SDK 强制退出宿主进程的反模式
- KR5：`destroy()` 中 `engine:stopped` 事件移到 `this.destroyed = true` 之后，修复事件监听器看到不一致状态

**预期收益**：
- 长时间运行的 Web 服务（Express/Koa）不会因 Session 泄漏导致内存增长
- 优雅关机不再意外终止宿主进程
- 多 AgentEngine 实例场景下 token 预算不串扰

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，仅修改 engine 层生命周期管理
- 正向影响：SDK 可安全嵌入长时运行的生产服务
- 负面影响：`query()` 的 AsyncGenerator 中断行为变更，需文档说明
- 实施风险：中——涉及 destroy 时序变更，需要回归测试

**符合框架目标**：project-purpose.md "可靠性" + "支持多 Session 并发" + "长时间运行服务"

**依赖关系**：无前置依赖

---

### 优化 5：Provider 弹性能力补齐（P1）

**优化重点**：为 Provider 层增加重试、熔断、降级机制，达到企业级可靠性标准

**优化目标**：SDK 用户无需自行实现重试逻辑，Provider 自动处理瞬态故障

**关键结果**：
- KR1：`BaseProvider` 新增 `RetryConfig`（maxRetries、backoffMs、retryableErrors），对 RATE_LIMIT(429) 和 NETWORK_ERROR 自动重试
- KR2：新增 `CircuitBreaker` 类，基于错误率和时间窗口实现熔断，Provider 连续失败 N 次后快速失败
- KR3：`AgentEngine.query()` 的 catch 路径使用 `classifyError()` 而非直接抛 `EXECUTION_ERROR`，让 SDK 用户区分 AUTH/RATE_LIMIT/NETWORK 错误
- KR4：`BaseProvider.classifyError()` 增加 HTTP 529(Overloaded) → RATE_LIMIT、502/503 → NETWORK_ERROR 的映射

**预期收益**：
- SDK 用户不需要为每个 Provider 调用写重试逻辑
- API 限流或临时网络故障不会直接暴露为失败
- 错误分类让 SDK 用户可以精确处理（刷新 token / 降级到备用 Provider / 等待重试）

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，重试和熔断是包装层的增强
- 正向影响：Provider 层达到企业级可靠性标准
- 负面影响：重试可能导致请求延迟增加（可配置）
- 实施风险：中——重试逻辑需要正确处理幂等性，需要充分测试

**符合框架目标**：project-purpose.md "可靠性" + "鲁棒性" + "企业级 Agent 需求"

**依赖关系**：无前置依赖

---

### 优化 6：CC Runtime 统一访问层补全（P1）

**优化重点**：扩展 CCRuntime 接口，收拢 engine/ 对 CC 原始模块的直接穿透 import

**优化目标**：engine/ 对 CC 原始模块的所有访问通过 CCRuntime 统一门面，减少耦合

**关键结果**：
- KR1：CCRuntime 接口新增 `createFileStateCache()` 和 `hasPermissionsToUseTool()` 方法，消除 bridge/ 的 4 处直接 CC import
- KR2：定义 `LLMRuntime` 子接口（或扩展 CCRuntime），封装 `queryModelWithStreaming/queryModelOpenAI/queryModelGemini/queryModelGrok`，Provider 适配器通过注入的 runtime 调用 LLM API
- KR3：lint-layers 检查 engine/ 对 `services/` 和 `utils/` 的直接穿透 import 数量减少 50%+

**预期收益**：
- engine/ 与 CC 原始模块的耦合度降低，CC 升级时只需修改 CCRuntime 实现
- 测试更容易：mock CCRuntime 即可隔离所有 CC 依赖
- 架构更清晰：engine/ 真正成为"包装层"

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，本质上是加强"包装"的一致性
- 正向影响：模块边界更清晰，可维护性提升
- 负面影响：新增一层抽象调用，有微小的运行时开销（可忽略）
- 实施风险：中——涉及多个文件的 import 路径变更，需要回归测试

**符合框架目标**：architecture-design.md "F2 单向分层依赖" + project-purpose.md "可维护性"

**依赖关系**：优化 5（Provider 弹性能力在 LLMRuntime 接口上增加 retry/circuitBreaker 配置更自然）

---

### 优化 7：SDK 轻量化与依赖拆分（P1）

**优化重点**：拆分 SDK 和 CLI 的 npm 依赖，使 SDK 包体积最小化

**优化目标**：SDK 核心依赖 ≤ 5 个运行时包，Provider SDK 改为 optionalDependencies

**关键结果**：
- KR1：Provider SDK（`@anthropic-ai/bedrock-sdk`、`@anthropic-ai/vertex-sdk`、`openai`、AWS SDK 等）移至 `optionalDependencies`，按需安装
- KR2：CLI 专用依赖（`react`、`@anthropic/ink`、`figures`、`cli-highlight`、`qrcode` 等 ~20 个）确认不打入 SDK 构建产物
- KR3：SDK 独立构建入口 `build:sdk` 使用 Bun.build 或 Vite，仅打包 engine/ + 必要的 services/ 子集
- KR4：`mcp-chrome-bridge` 移至 `optionalDependencies`，SDK 模式不需要自动安装

**预期收益**：
- SDK 包体积从全量（含 React 全家桶）减小到 < 2MB（目标）
- SDK 安装速度大幅提升（不需要下载 React/Ink 等）
- 企业用户只安装需要的 Provider SDK（如只用 Anthropic，不需要 AWS SDK）

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，纯构建和依赖配置修改
- 正向影响：SDK 发布后的用户体验大幅提升
- 负面影响：需要维护两套构建配置（CLI 全量 + SDK 精简）
- 实施风险：中——构建流程变更需要 CI 适配，optional 依赖需要测试

**符合框架目标**：project-purpose.md "SDK 包 < 2MB" + "轻量化框架"原则

**依赖关系**：优化 2（构建产物修复是前提）+ 优化 3（React 类型切断后才能真正排除 React）

---

### 优化 8：错误处理体系规范化（P1）

**优化重点**：统一 engine/ 的错误处理标准，消除静默吞没和原始 Error 抛出

**优化目标**：engine/ 内部零原始 `Error` 抛出，所有 catch 块有日志，EngineError 支持错误链

**关键结果**：
- KR1：4 处原始 `Error` 抛出（ProviderRegistry、FilesystemBackend、InMemoryBackend、CompositeBackend）改为 `EngineError`
- KR2：8 处静默 catch 块增加 `debug` 或 `warn` 级别日志（通过 LogUtil）
- KR3：`EngineError` 构造函数增加 `options?: { cause?: Error }` 参数，保留原始错误栈
- KR4：`EngineErrorCode` 新增 `TIMEOUT_ERROR`（超时）和 `TOOL_ERROR`（工具执行错误）错误码

**预期收益**：
- SDK 用户可以通过 `error.cause` 追溯到最底层错误
- 运维人员可以通过日志排查静默失败的场景（如文件损坏、JSONL 解析失败）
- 错误码覆盖更完整，SDK 用户可以精确处理每种错误

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，仅修改 engine 层错误处理
- 正向影响：可观测性和调试体验提升
- 负面影响：无
- 实施风险：低——局部修改，不影响核心逻辑

**符合框架目标**：project-purpose.md "错误信息：清晰、可操作"

**依赖关系**：无前置依赖

---

### 优化 9：SDK 配置设计与开发者体验改进（P2）

**优化重点**：降低 SDK 接入复杂度，改进配置 API 和文档可发现性

**优化目标**：新用户 30 分钟内完成从安装到第一次成功调用，IDE 自动补全引导完整链路

**关键结果**：
- KR1：统一 `SessionInfo` 和 `SessionMetadata` 为一个类型（当前有 `id` vs `sessionId` 的混淆）
- KR2：`AgentEngineConfig` 减少嵌套层级——`tools`/`skills` 提升到顶层，`permissions` 和 `options` 合并
- KR3：`collectText()` 和 `waitForResult()` 从独立函数改为 `AgentEngine` 的方法（更直觉的 API）
- KR4：`AgentEngine.create()` 中的动态 `require()` 改为顶层 `import` 或动态 `import()`，修复 ESM 兼容性
- KR5：`getEventBus()` 返回只读接口（`ReadOnlyEventBus`），防止用户调用内部 `emit()`/`hook()` 方法

**预期收益**：
- SDK 配置更直觉，减少用户查看文档的次数
- IDE 自动补全更准确（方法在对象上而非独立函数）
- SDK 可在 ESM 环境（纯 Node.js）运行

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，公共 API 层改进
- 正向影响：接入成本降低，开发者体验提升
- 负面影响：部分 API 签名变更，e2e_cli 需要适配
- 实施风险：中——API 变更需要版本管理和迁移指南

**符合框架目标**：project-purpose.md "接入成本 < 1 天" + "开发体验"

**依赖关系**：优化 1（类型安全加固后改 API 签名更安全）

---

### 优化 10：可观测性体系完善（P2）

**优化重点**：补齐日志模块测试、运行时级别调整、EventBus 背压保护

**优化目标**：SDK 嵌入生产环境后，运维人员可以完整观测 Agent 运行状态

**关键结果**：
- KR1：`engine/log/` 新增完整单元测试（当前零测试），覆盖 LogProvider、JsonLogFormatter、MDC、child logger、日志级别过滤
- KR2：`LogUtil` 新增 `setLevel(level: LogLevel)` 静态方法，支持运行时动态调整日志级别
- KR3：`EventBus` 新增 `maxListeners` 限制（默认 50），超限时输出 warn 日志，防止监听器无限增长
- KR4：`EventBus.on()` 中 TTL timer 的引用被跟踪，`clear()` 时一并清理，修复 Timer 泄漏

**预期收益**：
- 日志模块有测试保障，重构不担心回归
- 生产环境排查问题时可临时降低日志级别到 debug，无需重启
- 防止事件监听器泄漏导致内存增长

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，仅增强现有模块
- 正向影响：生产环境可观测性提升
- 负面影响：无
- 实施风险：低——新增方法和测试，不修改现有行为

**符合框架目标**：project-purpose.md "可维护性" + architecture-design.md "辅助模块 > LogUtil"

**依赖关系**：优化 8（错误处理规范化后，日志输出的错误格式需要一致）

---

## 四、优化点依赖关系

```
优化 1 类型安全 ──────────────────→ 优化 9 配置体验改进
     ↓
优化 2 SDK 发布就绪 ──→ 优化 3 React 切断 ──→ 优化 7 SDK 轻量化

优化 4 资源管理闭环（独立，可与任何优化并行）

优化 5 Provider 弹性 ──→ 优化 6 CC Runtime 补全

优化 8 错误处理规范 ──→ 优化 10 可观测性完善
```

**并行分组建议**：
- **阶段 A**（可全部并行）：优化 1 + 优化 2 + 优化 4 + 优化 8
- **阶段 B**（依赖 A）：优化 3 + 优化 5 + 优化 10
- **阶段 C**（依赖 B）：优化 6 + 优化 7 + 优化 9

---

## 五、与 V12 遗留项的对齐

| V12 遗留项 | V13 覆盖优化 | 说明 |
|-----------|-------------|------|
| Provider 穿透到 services/api（7 处） | 优化 6 | 通过 CCRuntime 统一封装 |
| SDK 构建产物 dist/sdk.js + .d.ts | 优化 2 | 修复构建流程 |
| engine/ 测试覆盖率 ~60% → 90% | 优化 8 + 10 | 补齐 log 模块测试 |
| API 文档覆盖全部公共方法 | 优化 9 | API 签名改进后补文档更有意义 |

---

## 六、后续行动建议

1. **优先执行阶段 A**（优化 1/2/4/8），这 4 个优化无相互依赖且用户价值最高
2. **阶段 A 完成后**，执行优化 3（React 切断）+ 优化 5（Provider 弹性）
3. **最后执行阶段 C**（优化 6/7/9），依赖前面阶段的基础
4. **全程**：优化 10（可观测性）可与任何阶段并行推进

**预估影响范围**：
- 阶段 A：~30 个文件改动，核心是 engine/ 目录
- 阶段 B：~15 个文件改动，涉及 types/ 和 provider/
- 阶段 C：~25 个文件改动，涉及构建配置和公共 API

**风险评估**：
- 总体风险：低到中
- 最高风险点：优化 4（资源管理）的 destroy 时序变更需要充分回归测试
- 缓解措施：每个优化完成后运行全量测试 + e2e_cli 验证
