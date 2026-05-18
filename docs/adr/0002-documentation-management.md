# 0002: 统一文档管理规范

- **日期**: 2026-05-18
- **状态**: accepted
- **决策者**: Neptune 架构专家

## 背景

项目文档分散在多个目录下，存在以下问题：
1. 4 个 `superpowers/` 目录散落在不同产品中，混淆了工具链产物与项目文档
2. `docs/references/` 下约 60+ 外部学习资料与项目文档混在一起
3. ADR 体系形同虚设（仅 1 条记录，模板过于简陋）
4. neptune-engine 存在 `ARCHITECTURE.md` 和 `architecture-design.md` 内容重叠
5. 散落的过程文档无归属（engine-execution-trace.md、prompt-assembly-analysis.md）
6. `PROJECT_RULE.md` 与 `docs/governance/repo-conventions.md` 职责重叠

## 决策

建立四层文档分级体系（L1 决策层 → L4 参考层），统一目录结构和命名规范，强化 ADR 生命周期管理。详见 `docs/DOCUMENTATION.md`。

## 方案对比

| 方案 | 优势 | 劣势 | 备注 |
|------|------|------|------|
| 四层分级 + ADR 强化（选定） | 清晰分层、低摩擦、可追溯 | 需要一次性迁移成本 | |
| 维持现状 + 补充 README | 零迁移成本 | 问题持续恶化，新人上手困难 | |
| 全部集中到 docs/ | 物理集中 | 产品独立性丧失，大仓库难导航 | |

## 后果

### 正面
- 文档有明确归属，不再散落
- ADR 有完整生命周期，决策可追溯
- 新人通过 CONTEXT-MAP.md → CONTEXT.md → docs/ 三级导航快速定位
- 过期文档有明确的清理规则

### 负面
- 需要一次性迁移现有文档（本次完成）
- superpowers/ 目录中的 plans/specs 需要团队确认是否保留

### 风险
- 团队不遵循规范 → 缓解：在 CLAUDE.md 中强制引用规范，CI 可加 lint 检查
