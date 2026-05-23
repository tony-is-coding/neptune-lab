---
name: feature-slice
description: Use when implementing a new user-visible feature or cross-module behavior across frontend, backend, engine, or shared packages.
---

# 功能切片

## 原则

实现最小完整纵向切片，用端到端行为证明功能成立。编辑前明确设计，完成后通过公开行为验证。

## 流程

1. 事前反思：目标、用户结果、涉及包、边界、数据/API contract、主要风险。
2. 在每个受影响包里先检查现有模式，再决定代码形状。
3. 跨多个模块时，先给简短实现计划。
4. 从稳定契约向内实现：shared 类型或 API contract → backend/engine 行为 → UI。
5. 在用户或调用方依赖的接口层新增或更新测试。
6. 对每个触达层运行针对性验证。
7. 自检：切片完整、契约和调用方一致、没有孤立 UI/API 路径、错误处理到位、验证证据已记录。

## 边界

- 不扩大到无关重构。
- 只有在能减少真实重复、隐藏有意义复杂度，或符合项目既有模式时才新增抽象。
- `shared/` 改动视为跨包 API 变化。

## 最终回复格式

先说明现在可工作的行为。然后按层总结实现、验证、剩余风险。
