# O6 Phase 2 分析报告：B 类混合字段处理策略

> 生成时间：2026-04-26
> 结论：**不需要复杂的双向同步机制**，采用更务实的方案

---

## 一、B 类字段重新分析

### 1.1 原始 B 类字段列表

根据 T3 的字段分类文档，B 类字段包括：

| 字段 | 类型 | 说明 |
|------|------|------|
| `settings` | `SettingsJson` | 配置 |
| `verbose` | `boolean` | 详细输出 |
| `mainLoopModel` | `ModelSetting` | 主循环模型 |
| `mainLoopModelForSession` | `ModelSetting` | Session 模型 |
| `kairosEnabled` | `boolean` | Kairos 激活 |
| `fastMode` | `boolean` | 快速模式 |
| `effortValue` | `EffortValue` | 努力值 |
| `advisorModel` | `string | undefined` | 顾问模型 |
| `authVersion` | `number` | 认证版本 |
| `denialTracking` | `DenialTrackingState | undefined` | 拒绝追踪 |

### 1.2 实际代码分析

通过分析 `src/state/onChangeAppState.ts`，发现这些字段的变更会触发**外部副作用**：

```typescript
// mainLoopModel 变更 → 更新 settings.json
if (newState.mainLoopModel !== oldState.mainLoopModel) {
  updateSettingsForSource('userSettings', { model: newState.mainLoopModel })
  setMainLoopModelOverride(newState.mainLoopModel)
}

// verbose 变更 → 更新 globalConfig + settings.json
if (newState.verbose !== oldState.verbose) {
  updateGlobalConfig({ verbose: newState.verbose })
  updateSettingsForSource('userSettings', { verbose: newState.verbose })
}
```

**关键发现**：
1. 这些字段的变更会**同步到 settings.json 文件**
2. 变更会**更新全局单例**（如 `globalConfig.verbose`）
3. 变更来源主要是 **UI 层**（用户通过 /config 修改）

---

## 二、为什么不需要双向同步机制

### 2.1 数据流向分析

```
┌─────────────┐
│   UI 层     │  ← 主要修改来源
│  (React)    │
└──────┬──────┘
       │ setState
       ↓
┌─────────────┐
│  AppState   │  ← 持有真实值
│   (Store)   │
└──────┬──────┘
       │ onChangeAppState
       ↓
┌─────────────┐
│ 外部副作用   │  ← 更新 settings.json, globalConfig
└─────────────┘
       │
       ↓ (读取)
┌─────────────┐
│ 核心逻辑层   │  ← 只读取，不修改
└─────────────┘
```

**核心逻辑层是只读消费者**，不需要修改这些字段。

### 2.2 核心逻辑层如何访问 B 类字段

通过 **React Hook** 或 **直接访问 AppState**：

```typescript
// 方式 1：在 React 组件中
const verbose = useAppState(s => s.verbose)

// 方式 2：在非 React 代码中
const store = useAppStateStore()
const verbose = store.getState().verbose
```

核心逻辑层不需要持有这些字段的副本，直接读取 AppState 即可。

---

## 三、务实的解决方案

### 3.1 保持现状

**B 类字段保留在 AppState 中**，不迁移到 EngineState。

**理由**：
1. ✅ 它们通过 settings.json 持久化，属于配置管理范畴
2. ✅ 它们的变更会触发外部副作用，不适合放在 engine 层
3. ✅ 核心逻辑层可以通过现有机制访问（useAppState / store.getState）
4. ✅ UI 层是主要的修改来源，保持不变
5. ✅ 避免引入复杂的双向同步逻辑（循环更新、性能问题）

### 3.2 EngineState 只持有 A 类字段

EngineState 保持 Phase 1 的设计，只包含纯核心状态：

```typescript
class EngineState {
  // A 类字段（18 个）
  tasks: { [taskId: string]: TaskState }
  mcp: { clients, tools, commands, resources, pluginReconnectKey }
  plugins: { enabled, disabled, commands, errors, installationStatus, needsRefresh }
  toolPermissionContext: ToolPermissionContext
  // ... 等
}
```

### 3.3 Phase 3 重点是迁移依赖方

**真正的优化**在于让核心逻辑层**直接使用 EngineState**，而不是迁移 B 类字段：

```typescript
// 之前：核心逻辑通过 AppState 访问 A 类字段
const tasks = useAppState(s => s.tasks)

// 之后：核心逻辑直接使用 EngineState
const engineState = useEngineState()
const tasks = engineState.tasks
```

---

## 四、Phase 2 调整建议

### 4.1 取消原 Phase 2 计划

**原计划**：B 类字段接口化 + 双向同步机制
**调整后**：**跳过 Phase 2**，直接进入 Phase 3

### 4.2 新的执行顺序

```
Phase 1 ✅：A 类字段迁移到 EngineState（已完成）
Phase 2 ❌：B 类字段接口化（取消 - 不需要）
Phase 3 ⏳：核心依赖方迁移（重点 - ~61 文件）
```

### 4.3 Phase 3 重点

1. **识别核心逻辑层文件**（~61 个）
2. **修改这些文件**，将 A 类字段访问从 `useAppState` 改为 `useEngineState`
3. **保持 UI 层不变**，继续使用 `useAppState`

---

## 五、风险评估

| 风险项 | 原计划（双向同步） | 务实方案（保持现状） |
|-------|:-----------------:|:------------------:|
| 数据不一致 | 🔴 高（循环更新） | 🟢 低（单一真实来源） |
| 性能问题 | 🟡 中（同步开销） | 🟢 低（无额外开销） |
| 代码复杂度 | 🔴 高（接口+同步） | 🟢 低（保持现有架构） |
| 维护成本 | 🟡 中 | 🟢 低 |
| 核心目标达成 | ✅ | ✅ |

---

## 六、结论

**建议**：
1. ✅ **保持 Phase 1 成果**（EngineState 已创建）
2. ❌ **取消 Phase 2**（不需要双向同步）
3. ⏳ **直接进入 Phase 3**（核心依赖方迁移）

**理由**：
- B 类字段更适合保留在 AppState（配置管理、外部副作用）
- 核心逻辑层可以通过现有机制访问（useAppState / store.getState）
- 避免引入不必要的复杂性和风险
- 核心目标（核心逻辑脱离 React）已在 Phase 1 实现基础

---

## 七、后续行动

1. 向 team-lead 汇报分析结果，建议调整计划
2. 如果批准，直接开始 Phase 3：核心依赖方迁移
3. 重点放在让核心逻辑层直接使用 EngineState

---

**附件**：
- 原字段分类：`.tmp_docs/appstate-field-classification.md`
- Phase 1 完成报告：`auto-upgrade/v5/02-o6-phase1-completion.md`
