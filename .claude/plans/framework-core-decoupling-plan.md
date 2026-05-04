# 框架核心解耦重构计划

**创建时间**: 2026-04-25
**优先级**: P0/P1
**执行方式**: 并行开发

---

## 一、项目目标

将 Claude Code 核心模块解耦，支持多 Session 并发和非 CLI 宿主复用。

### 核心目标
1. **bootstrap/state.ts 迁移** - 解除进程级单例限制
2. **Tool 接口分离** - 核心逻辑与 UI 渲染解耦
3. **ToolUseContext 分离** - 支持 non-CLI 环境

---

## 二、任务分解

### Task 1: bootstrap/state.ts Per-Session 状态迁移

**目标**: 将 per-session 字段迁移到 SessionContext

**Per-Session 字段清单** (需迁移):
```typescript
// 核心会话标识
sessionId: SessionId
parentSessionId: SessionId | undefined
cwd: string
originalCwd: string
projectRoot: string

// 模型相关
modelUsage: { [modelName: string]: ModelUsage }
mainLoopModelOverride: ModelSetting | undefined
initialMainLoopModel: ModelSetting
modelStrings: ModelStrings | null

// 统计相关
totalCostUSD: number
totalAPIDuration: number
totalToolDuration: number
turnHookDurationMs: number
turnToolDurationMs: number
turnToolCount: number
turnHookCount: number
startTime: number
lastInteractionTime: number
totalLinesAdded: number
totalLinesRemoved: number

// 会话状态
isInteractive: boolean
sessionSource: string | undefined
sessionBypassPermissionsMode: boolean
scheduledTasksEnabled: boolean
sessionCronTasks: SessionCronTask[]
sessionCreatedTeams: Set<string>

// Agent 相关
agentColorMap: Map<string, AgentColorName>
agentColorIndex: number

// 其他
hasUnknownModelCost: boolean
strictToolResultPairing: boolean
userMsgOptIn: boolean
```

**保留进程级字段** (不迁移):
```typescript
// 真正的进程级状态
meter: Meter | null
loggerProvider: LoggerProvider | null
meterProvider: MeterProvider | null
tracerProvider: BasicTracerProvider | null
inMemoryErrorLog: Array<{...}>
inlinePlugins: Array<string>
useCoworkPlugins: boolean
```

**实施步骤**:
1. 创建 `SessionContext` 接口
2. 使用 `AsyncLocalStorage` 实现上下文传递
3. 创建 `getSessionContext()` / `setSessionContext()` API
4. 逐步迁移 237 个引用文件
5. 保留向后兼容的 deprecated 函数

**验收标准**:
- 所有 per-session 字段可通过 SessionContext 访问
- 现有测试全部通过
- 新增多 Session 并发测试

---

### Task 2: Tool 接口分离

**目标**: 将 Tool 接口拆分为 CoreTool + UITool

**当前 Tool 接口** (~20+ 方法):
```typescript
// 核心方法 (CoreTool)
name: string
description: string
inputSchema: z.ZodType
inputJSONSchema?: ToolInputJSONSchema
isEnabled: () => boolean
isReadOnly: () => boolean
isConcurrencySafe: () => boolean
prompt: () => Promise<string>
call: (input, context) => Promise<ToolResult>

// UI 方法 (UITool)
userFacingName: () => string
renderToolUseMessage: () => React.ReactNode
renderToolResultMessage: () => React.ReactNode
renderToolUseProgressMessage: () => React.ReactNode
renderGroupedToolUse: () => React.ReactNode
renderQuickAction: () => React.ReactNode
// ... 更多 UI 方法
```

**目标架构**:
```typescript
// CoreTool - 核心逻辑，可在任何环境使用
interface CoreTool {
  name: string
  description: string
  inputSchema: z.ZodType
  inputJSONSchema?: ToolInputJSONSchema
  isEnabled: () => boolean
  isReadOnly: () => boolean
  isConcurrencySafe: () => boolean
  prompt: () => Promise<string>
  call: (input: I, context: CoreToolContext) => Promise<ToolResult>
  checkPermissions?: (input: I, context: CoreToolContext) => Promise<PermissionResult>
}

// UITool - UI 渲染，仅 CLI 环境需要
interface UITool {
  userFacingName: () => string
  renderToolUseMessage: (props) => React.ReactNode
  renderToolResultMessage: (props) => React.ReactNode
  renderToolUseProgressMessage: (props) => React.ReactNode
  // ...
}

// 完整 Tool = CoreTool + UITool (CLI 环境)
type Tool = CoreTool & Partial<UITool>
```

**实施步骤**:
1. 定义 `CoreTool` 和 `UITool` 接口
2. 创建 `CoreToolContext` 类型
3. 修改现有 Tool 实现适配新接口
4. 更新 `tools.ts` 注册逻辑
5. 非 CLI 环境只使用 CoreTool

**验收标准**:
- CoreTool 可独立使用
- 现有 CLI 功能不受影响
- 新增 non-CLI 环境测试

---

### Task 3: ToolUseContext 分离

**目标**: 将 ToolUseContext 拆分为 CoreToolContext + UIToolContext

**当前 ToolUseContext 字段**:
```typescript
// 核心字段 (CoreToolContext)
cwd: string
signal: AbortSignal
readFileCache: FileStateCache
getAppState: () => AppState
setAppState: (fn) => void
canUseTool: CanUseToolFn
abortController: AbortController

// UI 回调 (UIToolContext)
setToolJSX: (jsx) => void
appendSystemMessage: (msg) => void
sendOSNotification: (msg) => void
openMessageSelector: (options) => void
// ...
```

**目标架构**:
```typescript
// CoreToolContext - 核心上下文
interface CoreToolContext {
  cwd: string
  signal: AbortSignal
  readFileCache: FileStateCache
  getAppState: () => AppState
  setAppState: (fn: (prev: AppState) => AppState) => void
  canUseTool: CanUseToolFn
  abortController: AbortController
  // 移除所有 UI 回调
}

// UIToolContext - UI 上下文 (扩展 CoreToolContext)
interface UIToolContext extends CoreToolContext {
  setToolJSX: (jsx: React.ReactNode) => void
  appendSystemMessage: (message: SystemMessage) => void
  sendOSNotification: (message: string) => void
  openMessageSelector: (options: MessageSelectorOptions) => void
  // ...
}
```

**实施步骤**:
1. 定义 `CoreToolContext` 接口
2. 定义 `UIToolContext` 接口（继承 CoreToolContext）
3. 修改 Tool.call() 签名接受 CoreToolContext
4. CLI 环境传入 UIToolContext
5. 更新所有 Tool 实现

**验收标准**:
- Tool 在 non-CLI 环境可用 CoreToolContext
- CLI 功能正常使用 UIToolContext
- 类型安全，无运行时错误

---

## 三、依赖关系

```
Task 1 (bootstrap/state.ts) ──┐
                               ├──→ 集成测试
Task 2 (Tool 接口) ───────────┤
                               │
Task 3 (ToolUseContext) ───────┘
```

三个任务可并行开发，最后进行集成测试。

---

## 四、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 大量文件修改 | 🔴 高 | 使用渐进式迁移，保留向后兼容 |
| 类型错误 | 🟠 中 | 严格类型检查，增量验证 |
| 运行时错误 | 🟠 中 | 完善测试覆盖，分阶段验证 |
| 功能回归 | 🟠 中 | 回归测试，功能验证 |

---

## 五、验收标准

### 功能验收
- [ ] 所有现有测试通过
- [ ] 新增多 Session 并发测试
- [ ] 新增 non-CLI 环境测试
- [ ] e2e-cli 集成验证通过

### 性能验收
- [ ] 无性能退化
- [ ] 内存使用合理

### 代码质量
- [ ] TypeScript 严格模式通过
- [ ] 无新增 lint 错误
- [ ] 代码覆盖率不降低

---

## 六、时间估算

| 任务 | 预估工作量 |
|------|-----------|
| Task 1 | 大型重构 |
| Task 2 | 中型重构 |
| Task 3 | 中型重构 |
| 集成测试 | 中型 |
| 总计 | 大型项目 |

---

*计划完成，等待用户确认后进入团队组建阶段*
