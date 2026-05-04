# V13 工作总结

> 版本：V13
> 核心主题：SDK 类型安全、发布就绪、资源管理、Provider 弹性、轻量化
> Commit：ba34b44 → main (no-ff merge)
> 日期：2026-04-28

---

## 一、版本概述

V13 通过 5 维度深度代码分析识别 10 个优化点，组建 2 人开发团队 3 阶段递进交付。核心改动：SDK 公共 API 获得完整编译时类型安全、Provider 层增加企业级重试/熔断机制、资源管理消除内存泄漏风险、engine/ 彻底切断 React 类型穿透。

**关键数据**：53 文件改动，+2,517/-159 行，7 个新模块，51 个新测试用例，446 测试全部通过。

---

## 二、变化清单

### 新增

| 类别 | 内容 | 影响 |
|------|------|------|
| EngineEventMap | `engine/types/engine-events.ts` — 类型安全事件映射 | on()/once() 编译时捕获事件名和 payload 类型错误 |
| CircuitBreaker | `engine/provider/CircuitBreaker.ts` — 三态熔断器 | Provider 连续失败 N 次后快速失败 |
| RetryConfig | `BaseProvider` 内置重试配置 | RATE_LIMIT/NETWORK_ERROR 自动指数退避重试 |
| toolTypes.ui.ts | `types/toolTypes.ui.ts` — CLI 专用 React 类型 | SDK 与 CLI 类型物理分离 |
| log 模块测试 ×4 | `engine/log/__tests__/` — 4 个测试文件 | ConsoleLogProvider/JsonLog/MDC/LogUtil 完整测试覆盖 |
| classifyQueryError | `AgentEngine.ts` — 查询错误分类器 | SDK 用户可区分 AUTH/RATE_LIMIT/NETWORK 错误 |
| EngineError cause 链 | `errors.ts` — 错误构造函数增加 cause 参数 | 通过 error.cause 追溯底层错误 |
| TIMEOUT_ERROR / TOOL_ERROR | `errors.ts` — 2 个新错误码 | 超时和工具执行错误有独立错误码 |

### 修改

| 类别 | 内容 | 影响 |
|------|------|------|
| query() 返回类型 | `AsyncGenerator<SDKMessage>` → `AsyncGenerator<QueryEvent>` | SDK 用户获得精确的联合类型，IDE 自动补全 |
| on()/once() 签名 | 增加 `EngineEventMap` 泛型约束 | 编译时捕获事件名拼写错误 |
| AgentEngineConfig | tools/skills 提升到顶层（兼容旧格式） | 配置更直觉，减少嵌套 |
| SessionInfo/SessionMetadata | 合并为统一 SessionMetadata 类型 | 消除 id vs sessionId 的概念混淆 |
| collectText/waitForResult | 从独立函数改为 AgentEngine 实例方法（保留旧导出） | 更面向对象的 API |
| getEventBus() | 返回 ReadOnlyEventBus 接口 | 防止用户调用内部 emit()/hook() |
| destroy() | 增加 AbortController 取消活跃查询 | 长时运行服务不再泄漏资源 |
| destroySession() | 立即从 Map 移除 Session | 修复 destroyed Session 无限期驻留内存 |
| tokenBudgetStates | 从模块级全局 Map 改为 SessionManager 实例属性 | 多 AgentEngine 实例不串扰 |
| gracefulShutdown | 默认 exit: true → exit: false | SDK 不再强制退出宿主进程 |
| destroy 时序 | engine:stopped 移到 destroyed=true 之后 | 事件监听器看到一致状态 |
| package.json exports | default 指向 dist/、移除通配符导出 | SDK 可独立发布，不暴露内部实现 |
| EventBus | 新增 maxListeners 限制（默认 50）+ TTL timer 清理 | 防止监听器泄漏和 Timer 泄漏 |
| LogUtil | 新增 setLevel() 静态方法 | 生产环境运行时调整日志级别 |
| Tool.ts | 7 处 React.ReactNode → unknown | engine/ 零 React 类型穿透 |
| toolTypes.ts | ReactNode → unknown，拆分 CLI 版本 | SDK .d.ts 零 React 引用 |
| CCRuntime | 新增 createFileStateCache() + hasPermissionsToUseTool() | bridge/ 零直接穿透 import |
| BaseProvider.classifyError | 新增 529→RATE_LIMIT、502/503→NETWORK_ERROR | HTTP 服务端错误正确分类 |
| tsconfig.sdk.json | 扩大排除范围（proactive/coordinator/AppState.tsx/tsx） | SDK 构建更干净 |
| package.json | mcp-chrome-bridge → optionalDependencies | SDK 模式不强制安装 |

### 删除

| 类别 | 内容 | 影响 |
|------|------|------|
| 通配符导出 | `"./*": "./src/*.ts"` | 不再暴露任意内部源文件 |
| engine/ React 类型穿透 | 3 处间接 React 依赖 | SDK 用户无需安装 @types/react |
| bridge/ 直接穿透 import | 4 处对 utils/ 的直接 import | 所有 CC 模块访问通过 CCRuntime |
| 静默 catch 块 | 8 处无日志的 catch | 所有 catch 块至少有 debug/warn 日志 |
| 原始 Error 抛出 | 4 处在 engine/ 内部 | 全部改为 EngineError |

### 修复

| Bug | 修复 |
|-----|------|
| query() 返回类型等同于 any | 改为 QueryEvent 精确联合类型 |
| destroyed Session 内存泄漏 | destroySession 后立即从 Map 移除 |
| destroy() 不取消活跃查询 | 新增 AbortController 机制 |
| tokenBudgetStates 多实例串扰 | 改为 SessionManager 实例属性 |
| gracefulShutdown 强制退出宿主进程 | 默认改为 exit: false |
| engine:stopped 事件时序不一致 | 移到 destroyed=true 之后 |
| exports.default 指向源码非构建产物 | 改为指向 dist/ |
| 通配符导出暴露所有内部文件 | 移除，只保留设计好的公共路径 |

---

## 三、新增特性列表

### 1. Provider 重试与熔断

**描述**：Provider 层新增自动重试和熔断机制，SDK 用户无需自行实现。

**使用方式**：
```typescript
const engine = AgentEngine.create({
  provider: {
    type: 'anthropic',
    retry: { maxRetries: 3, backoffMs: 1000 },
    circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 30000 }
  }
})
```

**影响范围**：所有 7 个 Provider 适配器

### 2. 类型安全的事件系统

**描述**：`on()`/`once()` 现在支持泛型事件映射，编译时捕获事件名和 payload 类型错误。

**使用方式**：
```typescript
engine.on('session:created', (payload) => {
  // payload 自动推断为 { sessionId: string; workspace: string }
})

engine.on('error', (payload) => {
  // payload 自动推断为 { error: Error; source: string; ... }
})
```

**影响范围**：AgentEngine 事件监听 API

### 3. EngineError 错误链

**描述**：EngineError 现在支持 cause 参数，可以追溯到最底层原始错误。

**使用方式**：
```typescript
try {
  for await (const msg of engine.query(sid, 'hello')) { ... }
} catch (error) {
  if (error instanceof EngineError) {
    console.log(error.code)        // RATE_LIMIT
    console.log(error.cause)       // 原始 API 错误
    console.log(error.cause?.message)  // "Rate limit exceeded"
  }
}
```

**影响范围**：所有 Provider 适配器、storage 模块、ProviderRegistry

### 4. 运行时日志级别调整

**描述**：生产环境运行时动态调整日志级别，无需重启。

**使用方式**：
```typescript
import { LogUtil } from 'claude-code-best/engine'
LogUtil.setLevel('debug')  // 临时降低到 debug 排查问题
// ...排查完毕
LogUtil.setLevel('warn')   // 恢复
```

**影响范围**：日志系统

---

## 四、用户体验改进

| 改进 | 之前 | 之后 |
|------|------|------|
| query() 类型安全 | SDKMessage 等同于 any | QueryEvent 精确联合类型，IDE 自动补全 |
| 事件类型安全 | on(type: string, payload: unknown) | on<K extends keyof EngineEventMap>(type: K, payload: EngineEventMap[K]) |
| 错误区分 | 所有错误都是 EXECUTION_ERROR | 分类为 AUTH/RATE_LIMIT/NETWORK/PROVIDER_NOT_FOUND/TIMEOUT/TOOL |
| SDK 发布 | 不可发布（exports 指向源码） | exports.default 指向 dist/，通配符导出移除 |
| SDK 安全 | 通配符导出暴露所有内部文件 | 只暴露设计好的公共路径 |
| React 依赖 | SDK 用户需安装 @types/react | engine/ 零 React 类型引用 |
| 配置复杂度 | extensions.tools（三层嵌套） | tools 直接在顶层（兼容旧格式） |
| 进程安全 | gracefulShutdown 默认退出宿主 | 默认 exit: false |
| 资源泄漏 | destroyed Session 滞留内存 | 立即从 Map 移除 |
| 长时运行 | destroy 不取消活跃查询 | AbortController 取消机制 |

---

## 五、技术改进

### 架构层面

| 改进 | 说明 |
|------|------|
| 类型安全体系 | EngineEventMap + QueryEvent + Session 导出，公共 API 零 any |
| Provider 弹性 | CircuitBreaker 三态熔断 + RetryConfig 指数退避 |
| 模块边界 | bridge/ 零直接穿透 import，所有 CC 访问通过 CCRuntime |
| React 隔离 | toolTypes 拆分为核心+UI，engine/ 零 React 类型穿透 |
| 错误规范化 | EngineError cause 链 + 8 处 catch 日志 + 4 处原始 Error 消除 |

### 代码质量

| 指标 | V12 | V13 | 变化 |
|------|-----|-----|------|
| engine/ 测试用例 | 395 | 446 | +51 (+13%) |
| engine/ expect() | 738 | 787 | +49 |
| engine/ 测试文件 | 20 | 24 | +4 |
| React 类型穿透 | 3 处 | 0 | -100% |
| 静默 catch | 8 处 | 0 | -100% |
| 原始 Error | 4 处 | 0 | -100% |
| bridge 穿透 | 4 处 | 0 | -100% |
| 通配符导出 | 1 处 | 0 | -100% |

---

## 六、已知问题和后续计划

### 遗留问题

| 问题 | 优先级 | 说明 |
|------|--------|------|
| SDK 构建（build:sdk）失败 | P1 | packages/builtin-tools 引用 claude-code-cli，需解耦 |
| Provider LLMRuntime 子接口 | P2 | CCRuntime 已扩展，但 7 个 Provider 的 LLM API 未封装到统一接口 |
| e2e_cli 适配 | P2 | T10 API 变更后 e2e_cli 需要更新 |
| engine/ 测试覆盖率 | P2 | 约 70%，距 90% 目标仍有差距 |

### 后续优化方向

1. **修复 SDK 构建问题**：解耦 packages/builtin-tools → claude-code-cli 跨包引用
2. **LLMRuntime 接口**：封装 7 个 Provider 的 LLM API 调用
3. **e2e_cli 回归验证**：基于新公共 API 更新
4. **API 文档生成**：基于 TypeDoc 生成公共 API 文档

---

## 七、文档维护记录

| 文档 | 操作 | 说明 |
|------|------|------|
| docs/architecture-design.md | 更新 | 补充 V13 新增模块（CircuitBreaker/EngineEventMap/错误体系） |
| docs/okr-roadmap.md | 更新 | V13 进度标记、新增 KR |
| auto-upgrade/v13/00-execution-record.md | 更新 | Phase 4 完成标记 |
| auto-upgrade/v13/multi-phase-execute-record.md | 更新 | Phase 4 完成记录 |
