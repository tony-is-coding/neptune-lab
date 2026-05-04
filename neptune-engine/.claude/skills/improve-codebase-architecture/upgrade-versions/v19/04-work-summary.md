# V19 工作总结

> 版本：V19
> 日期：2026-04-29
> Commit：5e2f2bd
> 分支：optimize/v19-provider-runtime-types → main（Fast-forward merge）

---

## 一、版本概述

V19 是 Agent Engine SDK 的 **Provider 运行时激活版本**。核心改动是将 7 个已实现但从未调用的 ProviderAdapter 接入运行时调用链，同时完成 Provider 配置类型安全、CircuitBreaker 熔断启用、SDK 入口统一等 9 项优化。SDK 用户现在可以通过代码配置选择 Provider、传入 API Key、获得 IDE 类型提示。

---

## 二、变化清单

### 新增
- `engine/provider/types/ProviderConfigs.ts` — 7 个 Provider 独立配置类型（AnthropicProviderConfig 等）
- `engine/provider/types/index.ts` — 配置类型统一导出
- `engine/types/query-engine.ts` — QueryEngine 屏障文件
- `engine/types/system-prompt.ts` — SystemPrompt 屏障文件
- `engine/types/settings.ts` — Settings 屏障文件
- `engine/types/tool-extension.ts` — SDKTool 接口定义
- `QueryEngineConfig.customDeps` — 依赖注入扩展点
- `AgentEngineConfig.toolsets` — 工具集按需加载配置
- BaseProvider CircuitBreaker 实例 + EventBus 事件发布
- CircuitBreaker.onStateChanged 回调机制

### 修改
- `ProviderConfig` 从 `interface { type?; config?: Record<string, unknown> }` 改为 discriminated union type
- `ProviderQueryParams.messages/tools` 从 `unknown[]` 改为 `Message[]/Tools`
- `OriginalQueryEngineBridge.buildQueryEngineConfig()` 改为 async，支持 ProviderAdapter callModel 注入
- `QueryEngine.submitMessage()` 透传 customDeps 给 query()
- 7 个 Provider 子类消除 `as any[]` 类型断言
- `engine/index.ts` 补充 Backend/Permission 导出
- `src/index.ts` 补充 Provider/CCRuntime/ToolAdapter 导出
- `CircuitBreaker` 增加状态变化回调通知

### 删除
- `engine/provider/LLMRuntime.ts` — 合并到 ProviderAdapter
- `engine/provider/__tests__/LLMRuntime.test.ts` — 随 LLMRuntime 删除
- `ProviderRegistry.getRuntime()` — duck typing 方法移除

---

## 三、新增特性列表

### 特性 1：Provider 运行时接入
- **描述**：AgentEngine 的 LLM 调用现在走 ProviderAdapter → CircuitBreaker → executeWithRetry
- **使用方式**：`AgentEngine.create({ provider: { type: 'openai', config: { apiKey: 'sk-xxx' } } })`
- **影响范围**：AgentEngine.query() 调用链

### 特性 2：Provider 配置类型安全
- **描述**：7 个 Provider 各有独立配置类型，IDE 自动补全可用
- **使用方式**：`provider: { type: 'anthropic', config: { apiKey: '...', model: 'claude-3.5-sonnet', baseURL: '...' } }`
- **影响范围**：AgentEngineConfig.provider

### 特性 3：API Key 代码注入
- **描述**：SDK 用户通过配置对象传入 API Key，不再依赖环境变量
- **使用方式**：`config: { apiKey: 'sk-xxx' }`
- **影响范围**：多租户场景、Serverless/容器化部署

### 特性 4：CircuitBreaker 熔断保护
- **描述**：LLM 调用具备弹性：连续失败自动熔断，429/网络错误自动重试
- **使用方式**：自动生效，每个 Provider 有独立熔断器
- **影响范围**：Provider callModel 包装

### 特性 5：SDK 入口统一
- **描述**：`engine/index.ts` 和 `src/index.ts` API 表面一致
- **使用方式**：从任一入口导入均可获得完整 SDK API
- **影响范围**：SDK 集成者

### 特性 6：工具集按需加载
- **描述**：SDK 模式可按需加载工具组，不加载全量 55+ 工具
- **使用方式**：`AgentEngine.create({ toolsets: ['core', 'filesystem'] })`
- **影响范围**：SDK 轻量化、内存占用

---

## 四、用户体验改进

| 改进 | 改变前 | 改变后 |
|------|--------|--------|
| Provider 选择 | 只能通过环境变量 | 代码配置 `provider.type` |
| API Key | 只能环境变量 | 代码注入，多租户可用 |
| 配置类型提示 | `Record<string, unknown>` 无提示 | discriminated union，IDE 自动补全 |
| SDK 入口 | 两个入口导出不一致 | 统一 API 表面 |
| LLM 调用弹性 | 无重试/熔断 | CircuitBreaker + 指数退避重试 |
| 工具加载 | 55+ 全量加载 | SDK 模式按需加载 |
| Provider 接口 | 两套并行（LLMRuntime + ProviderAdapter） | 单一 ProviderAdapter 接口 |

---

## 五、技术改进

### 架构层面
- **Provider 运行时链路打通**：AgentEngine → QueryEngine → query() → customDeps → ProviderAdapter callModel
- **类型系统统一**：LLMRuntime 合并到 ProviderAdapter，消除两套 Provider 抽象
- **SDK API 表面统一**：engine/index.ts 和 src/index.ts 导出对齐

### 代码质量
- `as any[]` 从 7 个 Provider 子类中完全消除
- `as unknown as` 从 Bridge 层 4 处降至 2 处
- LLMRuntime.ts（72 行）+ LLMRuntime.test.ts（77 行）删除，减少维护负担
- ProviderRegistry.getRuntime() duck typing 移除

### 穿透依赖
- 新增 3 个屏障文件（query-engine、system-prompt、settings）
- 穿透依赖总量持续下降

---

## 六、已知问题和后续计划

### 遗留技术债
1. **Provider 测试编译错误**（~15 个）：ProviderQueryParams 类型变更导致 mock 数据类型不匹配，需后续修复
2. **Bridge 层 2 处 as unknown as**：AppState 结构性不兼容，需文档说明保留原因
3. **CircuitBreaker 测试**：protected circuitBreaker 属性测试访问需改为 public getter
4. **穿透依赖**：实际总量仍约 60+ 条（含 DefaultCCRuntime 9 条不可消除的 require），目标 < 10 未达成

### 后续优化方向
1. **修复测试编译错误**：更新 Provider 测试的 mock 数据类型
2. **集成测试**：验证 Provider 运行时接入的端到端流程
3. **穿透依赖持续治理**：继续新增屏障文件，向 < 30 目标推进
4. **性能测试**：验证 CircuitBreaker 在生产负载下的表现
5. **V7+ 分布式能力**：基于 V19 Provider 运行时基础，推进分布式会话编排

---

## 七、OKR 路线图对齐

| OKR 目标 | V19 进展 | 状态 |
|----------|---------|------|
| Provider 运行时接入 | T1 customDeps + T7 CircuitBreaker | ✅ 完成 |
| 配置完善 | T2 discriminated union + T6 API Key 注入 | ✅ 完成 |
| 穿透依赖治理 | T4 新增 3 个屏障文件 | ⚠️ 持续推进 |
| API 类型统一 | T5 SDKTool + T8 LLMRuntime 合并 | ✅ 完成 |
| SDK 入口统一 | T3 双向补充导出 | ✅ 完成 |
| 轻量化 | T9 toolsets 按需加载 | ✅ 完成 |
| 文档一致性 | T10（13 个文档） | ⏳ 延后 |

---

## 八、文档维护记录

### 需要更新的文档（3 个核心文档）

| 文档 | 严重程度 | 更新内容 |
|------|---------|---------|
| `docs/architecture-design.md` | 高 | LLMRuntime 引用清理；Provider 运行时/配置类型/熔断器描述更新；穿透数量更新；engine 文件数量修正 |
| `docs/project-purpose.md` | 中 | engine 文件数量更新；SDK 能力补充 V19 新增特性；示例代码更新 |
| `docs/okr-roadmap.md` | 高 | 新增 V19 版本记录；Provider 空壳描述更新为已实现；穿透数据更新；V7+ 规划基于 V19 重写 |

### V19 新增 KR 发现

基于执行过程中发现的新问题，建议加入 OKR 路线图：
1. **Provider 测试修复**：~15 个 Provider 测试因类型变更需修复（P1）
2. **CircuitBreaker 公共 API**：circuitBreaker 从 protected 改为 public getter + 测试（P2）
3. **Bridge AppState 类型兼容**：消除剩余 2 处 as unknown as（P2，需 QueryEngineConfig 改造）
