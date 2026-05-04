# SessionContext 字段分组说明

## 背景

SessionContext 原有 30+ 字段，随着 CC 代码迁移到 engine/，需要明确区分哪些字段是 engine/ 实际使用的，哪些是为了 CC 兼容性保留的。

## 字段分组

### [ENGINE] engine/ 实际使用的字段

这些字段是 engine/ 代码中直接访问的：

- `sessionId` - 会话 ID，用于标识和跟踪会话
- `cwd` - 当前工作目录，用于文件操作和路径解析
- `projectRoot` - 项目根目录，用于项目级别操作
- `memoryPath` - 用户记忆路径，可选，用于记忆隔离

**使用位置**：
- `AgentEngine.ts` 中设置 `sessionCtx.memoryPath`
- `SessionContextStorage.ts` 中通过 `getCwd()` 访问 `cwd`
- 各种工具通过 `getSessionId()` 访问 `sessionId`

### [CC_COMPAT] CC 原始代码通过 SessionContextStorage 访问的字段

这些字段虽然不在 engine/ 中直接使用，但 CC 原始代码通过 SessionContextStorage 的辅助函数访问：

- `parentSessionId` - 父会话 ID
- `originalCwd` - 原始工作目录
- `modelUsage` - 模型使用记录
- `mainLoopModelOverride` - 主循环模型覆盖
- `initialMainLoopModel` - 初始主循环模型
- `modelStrings` - 模型字符串

**使用位置**：
- CC 原始代码通过 `getSessionContext()` 获取完整上下文
- QueryEngine 等组件通过辅助函数间接访问

### [CC_INTERNAL] CC 原始代码内部使用的字段

这些字段仅在 CC 原始代码内部使用，engine/ 不直接访问：

- 成本统计字段：`totalCostUSD`, `totalAPIDuration`, 等
- 性能统计字段：`turnHookDurationMs`, `turnToolDurationMs`, 等
- 会话配置字段：`isInteractive`, `isRemoteMode`, `sessionBypassPermissionsMode`, 等
- Agent 相关字段：`agentColorMap`, `agentColorIndex`
- 其他 CC 特性字段：`scheduledTasksEnabled`, `sessionCronTasks`, 等

**保留原因**：
- 保持与 CC 原始代码的兼容性
- 支持未来可能的 engine/ 功能扩展
- 避免破坏现有的 CC 功能

## 未来优化方向

1. **逐步迁移**：随着 engine/ 功能增加，可能需要更多 CC 字段
2. **字段清理**：如果某些 CC 字段确认不再使用，可以考虑移除
3. **类型分离**：未来可能将 SessionContext 拆分为 EngineSessionContext 和 CCSessionContext

## 注意事项

- 修改字段分组时，确保同步更新 `createDefaultSessionContext` 函数
- 添加新字段时，明确标注属于哪个分组
- 删除字段前，确认没有代码（CC 或 engine/）在使用
