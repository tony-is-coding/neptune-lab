# V8 用户需求

## 版本
- **版本**: v8
- **记录时间**: 2026-04-27

---

## 一、优化目标

engine/ 完全零 CLI 依赖，清理已知死代码和边界模糊点，消除框架→CLI 反向依赖，为 V9 核心启动提取扫清障碍。

## 二、关注范围

### OKR 路线图 KR（6 项）

| KR | 描述 | 来源 | 工作量估算 |
|----|------|------|-----------|
| KR1 | engine/ 零 CLI import — 消除 3 处 `import type` 依赖 | V7-O2 | 1h |
| KR2 | Command 类型下沉到 `types/` 层 | V7-O3 | 2h |
| KR3 | migrations 迁移到 `cli/` 目录 | V7-O4 | 2h |
| KR4 | 删除 `migrateAutoUpdatesToSettings.ts` 死代码 | V7-O1 | 0.5h |
| KR5 | keybindings/vim/cli 归属文档化 | V7-O5/O9/O10 | 2h |
| KR6 | lint:layers + tsc + 全量测试通过 | 质量门槛 | — |

### 新增：反向依赖消除（V7 遗留）

V7 迁移后仍有 20 处框架→CLI 反向依赖，需评估并逐步消除：

1. **commands.ts** — 从 CLI 加载 124 个命令实现（过渡方案）
2. **UI 组件导入** — MessageResponse、ComputerUseApproval 等
3. **类型导入** — SuggestionItem、BridgePermissionCallbacks 等
4. **功能模块** — poorMode、bridgeEnabled、upstreamproxy 等

## 三、优先方向

1. 死代码清理（KR4）— 风险最低
2. 类型解耦（KR1/KR2）— engine/ 零 CLI import
3. 反向依赖评估与消除 — 梳理 20 处依赖的优先级和消除方案
4. 归属文档化（KR5）— 明确模块边界
5. 质量门槛（KR6）— 最终验证

## 四、特殊约束

- **包装不替代**：不动核心 agent loop / tool system / query engine
- **最小改动**：优先包裹和外扩
- **渐进式**：每个 KR 做到位再继续
- **质量门槛**：lint:layers 零违规、tsc 零错误、全量测试通过

## 五、完成标准

- engine/ 目录零 CLI import（包括 import type）
- 框架→CLI 反向依赖数量显著减少（有消除计划）
- lint:layers 零违规
- tsc 零错误
- 全量测试通过

## 六、参考文档

- [OKR 路线图 V8](../../docs/okr-roadmap.md#三v8内部架构收尾)
- [架构设计](../../docs/architecture-design.md)
- [V7 执行记录](../v7/00-execution-record.md)
