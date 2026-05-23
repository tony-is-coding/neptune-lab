---
name: code-review
description: Use when reviewing code, diffs, pull requests, implementation plans, or completed changes for correctness and risk.
---

# 代码审查

## 原则

先找 bug 和风险。不要用表扬或宽泛总结开头。

## 流程

1. 明确审查范围：文件、diff、分支或计划。
2. 阅读足够的上下文来验证行为，不只看风格。
3. 先输出 findings，按严重程度排序。
4. 每个 finding 都绑定文件/行号或具体行为路径。
5. 只有当测试缺失会保护真实行为风险时，才提出缺失测试。
6. 如果没有发现问题，直接说明，并补充剩余验证限制。

## Finding 格式

- 严重级别：`P0`、`P1`、`P2` 或 `P3`。
- 标题：描述具体行为，不写空泛建议。
- 证据：文件/行号或精确流程。
- 影响：说明会破坏用户、调用方、数据或维护性中的哪一项。
- 修复方向：给出简洁修正建议。

## 避免

- 只提风格问题，除非它隐藏真实维护风险。
- 没有失败路径的泛泛建议。
- 在 findings 前重复实现摘要。
