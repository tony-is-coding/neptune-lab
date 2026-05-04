# V7 多阶段执行详细记录

## Phase 0: 需求确认

**时间**: 2026-04-26
**状态**: ✅ 完成

### 需求输入
研究 CLI 启动相关代码是否可以迁移到独立的 `claude-code-cli` 目录，使框架（Agent Engine）不包含 CLI 特有的逻辑。

### 关注范围
| 模块 | 文件数 | 引用范围 | 初步判断 |
|------|--------|----------|----------|
| migrations/ | 11 | 仅 main.tsx | CLI 特有，可迁移 |
| keybindings/ | 16 | 126+ 文件 | 需分析框架/CLI 边界 |
| main.tsx CLI 启动逻辑 | ~1000行 | CLI 入口 | CLI 特有 |
| 其他 CLI 特有模块 | 待研究 | 待研究 | 待研究 |

### 约束条件
- 最小改动现有代码，优先包裹和外扩
- 核心 agent loop 尽量不变
- 不只关注新增框架引用，必须关注整个 claude-code 核心部分

### 用户确认
- 用户确认从"轻量级清理"转向"框架边界梳理"方向
- 要求综合研究 CLI 与框架的分层可行性

---

## Phase 1: 深度研究

**时间**: 2026-04-26
**状态**: ✅ 完成

### 研究范围
启动 4 个并行研究 agent：
1. main.tsx CLI 启动逻辑分析（6971 行）
2. commands/ 目录结构分析（60+ 子目录，400 文件）
3. screens/ + vim/ + cli/ 目录分析
4. engine/ 对 CLI 模块的依赖分析

### 研究发现

#### 1. main.tsx 组成
| 分类 | 行数 | 占比 |
|------|------|------|
| CLI 特有 | ~5,500 | 79% |
| 框架核心 | ~1,000 | 14% |
| 边界模糊 | ~470 | 7% |

#### 2. engine/ 依赖现状
- 零 CLI 运行时依赖
- 仅 3 处 `import type` 类型耦合（Command、SessionHooksState）
- 引擎完全独立于 keybindings/migrations/screens/components/vim/main.tsx

#### 3. CLI 模块归属
| 模块 | 归属 | engine 引用 |
|------|------|-------------|
| migrations/ | L4 CLI 启动 | 零 |
| keybindings/ | L4 TUI | 零 |
| commands/ | L4 CLI 应用 | 仅 import type |
| screens/ | L4 TUI | 零 |
| components/ | L4 TUI | 零 |
| cli/ | L4 CLI 传输 | 零 |
| vim/ | L4 输入模式 | 零 |

### 核心结论
**当前阶段不建议创建独立 claude-code-cli/ 项目**。推荐渐进式路径：
- V7: 内部分层标记 + 死代码清理 + 类型解耦
- V8+: 核心启动逻辑提取，评估是否需要独立项目

### TOP 10 优化点
| # | 优化重点 | 优先级 | 工作量 |
|---|----------|--------|--------|
| O1 | migrations 死代码清理 | P0 | 0.5h |
| O2 | engine/ 类型依赖解耦 | P0 | 1h |
| O3 | Command 类型下沉到 types/ | P1 | 2h |
| O4 | migrations 目录迁移 | P1 | 2h |
| O5 | keybindings 归属文档化 | P2 | 1h |
| O6 | main.tsx 核心启动提取 | P2 | 4h |
| O7 | commands compact 核心化 | P3 | 3h |
| O8 | screens/components 外迁 | P3 | 6h |
| O9 | cli 传输层关系梳理 | P3 | 3h |
| O10 | vim 归属决策 | P4 | 1h |

### 产出物
- `auto-upgrade/v7/01-optimizer-research.md`

---

## Phase 2: 任务拆分

**时间**: 2026-04-26
**状态**: ✅ 完成

### 任务计划

8 个任务，3 人团队（architect, developer-a, developer-b），严格依赖链 T1→T2→...→T8

| 任务 | 名称 | 执行角色 | 依赖 |
|------|------|----------|------|
| T1 | 迁移设计文档 | architect | — |
| T2 | claude-code-cli 包骨架 | developer-a | T1 |
| T3 | Command 接口抽象 | developer-a | T2 |
| T4 | 整体文件迁移 git mv | developer-a + developer-b | T3 |
| T5 | 框架核心 import 修复 | developer-a | T4 |
| T6 | CLI 侧 import 修复 | developer-b | T5 |
| T7 | 入口配置 + 启动验证 | developer-a + developer-b | T6 |
| T8 | 端到端验证 + 文档更新 | architect | T7 |

### 产出物
- `auto-upgrade/v7/02-task-plan.md`
- `auto-upgrade/v7/03-migration-design.md`

---

## Phase 3: 团队执行

**时间**: 2026-04-26 ~ 2026-04-27
**状态**: ✅ 完成

### 执行过程

1. **T1-T4**: architect 和 developer-a 完成设计文档、包骨架创建、文件迁移
2. **T5**: developer-a 和 team-lead 修复框架核心 import（Python 脚本批量修复 700+ 文件）
3. **T6**: developer-b 和 team-lead 修复 packages/builtin-tools/ 和 CLI 侧 import（1000+ → 0 错误）
4. **T7**: team-lead 完成最后 12 个类型编译错误修复（tsc 零错误通过）
5. **T8**: team-lead 生成执行报告，代码合入 main

### 关键成果

| 指标 | 值 |
|------|-----|
| 文件变更 | 1479 |
| 新增行数 | +9188 |
| 删除行数 | -5384 |
| tsc 错误 | 2273 → 0 |
| builtin-tools 错误 | 1000+ → 0 |
| commits | 4 |
| 合并方式 | Fast-forward → main |

### 产出物
- `auto-upgrade/v7/03-execution-report.md`
- 代码已合入 main 分支
