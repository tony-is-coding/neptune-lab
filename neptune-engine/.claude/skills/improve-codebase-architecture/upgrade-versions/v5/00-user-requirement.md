# V5 用户需求文档

## 优化主题
核心层深度解耦 — V3 第三批优化

## 需求来源
V3 研究报告（01-optimizer-research.md）中的第三批优化建议，用户确认继续执行。

## 优化清单

### O1: Tool 系统 CoreTool/UITool 完整分离
- **现状**: Tool 接口约 40% 方法是 UI 渲染相关
- **目标**: CoreTool 接口只含核心方法（call/description/inputSchema/checkPermissions 等），UITool 含渲染方法
- **风险**: 中（~35 个工具实现文件需调整）
- **符合目标**: headless/SDK 独立运行、packages/agent-tools 独立打包

### O6: AppState 核心状态与 UI 状态分离
- **现状**: AppState 混合核心运行时状态和 UI 渲染状态，直接依赖 React Context
- **目标**: 核心状态迁移到 engine 层 EngineState，UI 通过订阅获取
- **风险**: 高（AppState 是系统枢纽，几乎所有组件依赖）
- **符合目标**: 非 React 环境运行、packages/agent 独立

### O14: Hook 系统与 UI 解耦
- **现状**: hooks.ts（5177行）包含 UI 相关缓冲机制
- **目标**: Hook 执行核心逻辑零 UI 依赖
- **风险**: 中（核心文件，5177行）
- **符合目标**: headless/SDK 模式完整工作

### O15: REPL.tsx 拆分
- **现状**: `screens/REPL.tsx` 共 6314 行，UI 与核心逻辑混合
- **目标**: 核心逻辑下沉到 engine 层，UI 聚焦于渲染编排
- **风险**: 中（UI 与核心的最大交汇点）
- **符合目标**: 核心逻辑可被其他 UI 复用

## 约束条件
1. **最小改动原则**: 最小改动现有代码，优先包裹和外扩
2. **Agent Loop 不变**: 核心 agent loop 尽量不变
3. **渐进式改造**: 每阶段满足结构验证、行为验证、目标验证
4. **V3/V4 成果不受影响**: 已完成的解耦和分层不能回退

## 依赖关系
```
O1 ──→ O6 ──→ O14 ──┐
                      ├──→ O15
O15 依赖 O6+O14 ─────┘
```

## 成功标准
- Tool 接口完成 CoreTool/UITool 分离，~35 个工具调整完成
- AppState 核心状态可在非 React 环境使用
- Hook 系统核心逻辑零 UI 依赖
- REPL.tsx < 1500 行
- `bunx tsc --noEmit` 零错误
- `bun test` 全部通过
