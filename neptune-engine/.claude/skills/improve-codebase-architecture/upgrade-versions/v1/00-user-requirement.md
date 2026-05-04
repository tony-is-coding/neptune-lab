# 用户需求记录

> 记录时间: 2026-04-27

## 原始需求

按照 OKR 目标优化

## 需求澄清

1. **优化目标**: 架构治理 — 分层边界修复
2. **关注范围**: engine/ 目录，消除向上穿透和反向依赖
3. **目标版本**: V11（OKR 路线图下一个里程碑）
4. **特殊约束**: 无额外约束，遵循 OKR 路线图优先级

## V11 核心目标

engine/ 依赖方向 100% 单向，消除所有向上穿透和反向依赖。

### 当前问题基线
- engine/ 向上穿透 src/ 根文件: 35+ 处
- utils/services 反向引用 engine/: 34 个文件
- ICommandProvider 不存在于 engine/: 命令硬编码为空数组
- lint:layers 可能存在违规

### 完成标准
- engine/ 零向上穿透 import
- utils/services 零反向引用 engine/
- lint:layers 零违规
- 2626+ 测试通过
