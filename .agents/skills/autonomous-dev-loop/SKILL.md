---
name: autonomous-dev-loop
description: Use when the user wants Codex to implement, fix, test, verify, and self-review with minimal interruption while asking only for key product or safety decisions.
---

# 自动研发闭环

## 原则

端到端接管研发循环。用户只参与关键决策；常规实现、测试失败、review 修复由 Codex 自动处理。

## 默认流程

1. 结论先行做事前反思：目标、影响范围、边界、风险、验证计划。
2. 选择工作模式：
   - 窄范围 bug、回归、失败测试、局部问题，使用 `quick-fix`。
   - 跨模块或跨层的新行为，使用 `feature-slice`。
3. 编辑前先检查现有代码和本地模式。
4. 实现最小完整改动。
5. 运行最小有效验证。
6. 验证失败时自动诊断、修复、重跑；最多两轮，仍失败则升级给用户。
7. 按 `code-review` 的方式自查最终 diff：问题优先，按严重程度排序。
8. 对清晰且在范围内的 P0/P1/P2 问题自动修复。
9. review 修复后重新运行针对性验证。
10. 最终自检：需求满足、边界遵守、验证已记录、剩余风险明确。

## 只有这些情况才问用户

- 产品行为存在多个合理选择。
- 公共 API、shared contract、数据库 schema、迁移或数据语义会变化。
- 需要新增依赖、外部服务、凭证或付费资源。
- 需要破坏性操作、大范围删除、reset、force push 或不可逆迁移。
- 两轮自动修复失败，或失败指向互相冲突的根因。
- 唯一可行修复会扩大到用户请求之外。

## 停止条件

- 编辑代码后，不要在未验证或未说明阻塞原因时结束。
- 没有命令和结果，不要声称完成。
- 不要静默忽略 code-review findings；修复它们，或说明为什么保留。

## 最终回复格式

先说完成了什么。然后说明：改动区域、验证命令和结果、review 结果、剩余风险或需要用户决策的点。
