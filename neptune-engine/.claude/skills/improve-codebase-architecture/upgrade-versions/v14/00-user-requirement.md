# V14 用户需求

> 记录时间：2026-04-28

## 核心需求

按照 OKR 路线图继续优化，完成 V5 剩余的 20% 工作。

## 优先级排序

1. **P1 — SDK 构建修复**（KR8）：`build:sdk` 因 packages/builtin-tools 跨包引用失败，这是发布阻塞项
2. **P2 — API 文档生成**（KR10）：TypeDoc 覆盖公共方法，V5 KR1 遗留
3. **P2 — e2e_cli 适配**（KR12）：V13 API 变更后 e2e_cli 需要更新
4. **P2 — 测试覆盖率提升**（KR11）：engine/ 从 ~70% 到 90%
5. **P2 — Provider LLMRuntime**（KR9）：7 个 Provider 的 LLM API 调用统一封装

## 约束

- 不破坏已有功能
- 实时更新 OKR 路线图进度
- 遵循"包装不替代"原则
