# V12 用户需求

> 创建时间：2026-04-28
> 来源：用户发起 /auto-optimizer，基于 OKR 路线图继续推进

## 优化目标

1. **V11 遗留项收尾**：完成 T18 回归测试、Provider 集成测试、示例对齐、SDK 构建产物
2. **新一轮深度优化**：基于 V11 完成后的代码现状，识别新的高价值优化点
3. **OKR V5 闭环**：确保 OKR 路线图全部 KR 通过

## 关注范围

- 整体框架（src/ 全目录）
- 重点关注：V11 新增模块的质量验证 + 新一轮架构优化探索

## 特殊约束

- 用户已睡觉，按照最佳要求自主决策
- 一次性完成所有优化，不分批
- 遵循"包装不替代"原则

## V11 遗留项清单

| # | 遗留项 | 优先级 | 说明 |
|---|--------|--------|------|
| 1 | T18 回归测试 | P1 | AgentEngine/SessionManager/EventBus/EngineFacade 核心类单元测试 |
| 2 | Provider 集成测试 | P2 | 7 个 Provider 适配器的 query 流程验证 |
| 3 | 示例代码对齐 | P2 | examples/ 与实际 SDK 导出对齐，确保可运行 |
| 4 | SDK 构建产物 | P2 | 基于 tsconfig.sdk.json 产出 dist/sdk.js + .d.ts |
| 5 | lint-layers CI | P3 | 穿透检查加入 CI pipeline |
| 6 | 文档完善 | P2 | architecture-design.md 反映 Provider/Storage/Log/Permissions |
