# V4 用户需求文档

## 优化主题
架构分层进阶 — V3 第二批优化

## 需求来源
V3 研究报告（01-optimizer-research.md）中的第二批优化建议，用户确认继续执行。

## 优化清单

### O3: QueryEngine.ts 移除 UI 组件懒加载
- **现状**: QueryEngine.ts 通过 `require('src/components/MessageSelector.js')` 懒加载 UI 组件
- **目标**: 消息过滤逻辑通过配置/回调注入，QueryEngine 不直接依赖 UI 组件
- **风险**: 中（需理解 MessageSelector 使用场景）
- **符合目标**: 嵌入业务应用、服务端任务系统

### O9: 引入层间 import 规则（lint/barrier）
- **现状**: 无自动化工具防止跨层违规 import
- **目标**: 配置 eslint/biome 规则，禁止 L2 层 import L4 层
- **风险**: 低
- **符合目标**: 架构守护机制

### O10: engine/ 公共 API 导出规范化
- **现状**: 外部代码直接引用 engine/ 内部文件，79 个引用散落各处
- **目标**: 创建 engine/index.ts 统一公共导出入口
- **风险**: 低（机械性修改）
- **符合目标**: SDK 化、降低接入成本

### O13: console 输出通道统一
- **现状**: 核心层中散落 console.log 调用，非 CLI 场景干扰宿主输出
- **目标**: 核心层输出通过 LogUtil 统一分级，UI 输出通过专门通道
- **风险**: 低（已有 console-replace-manifest.md 清单）
- **符合目标**: 框架轻量、嵌入业务应用

## 约束条件
1. **最小改动原则**: 最小改动现有代码，优先包裹和外扩
2. **Agent Loop 不变**: 核心 agent loop 尽量不变
3. **渐进式改造**: 每阶段必须满足结构验证、行为验证、目标验证
4. **V3 成果不受影响**: 已完成的类型解耦不能回退

## 成功标准
- QueryEngine.ts 不再 require 任何 components/ 路径
- L2 层存在可执行的 import 规则检查
- engine/ 有统一的公共 API 入口
- 核心层 console.log 调用减少 50%+
- `bunx tsc --noEmit` 零错误
- `bun test` 全部通过
