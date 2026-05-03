# 设计文档：improve-codebase-architecture Skill 知识积累体系

> 日期: 2026-05-03
> 状态: 待实施
> 范围: neptune-engine/.claude/skills/improve-codebase-architecture/

---

## 一、背景与动机

### 现状问题

`improve-codebase-architecture` skill 已执行 21 个版本的架构优化迭代（v1-v21），覆盖从内部治理到企业级能力的完整演进。但存在以下问题：

1. **没有持久化的架构知识** — v1-v21 的结论分散在各自目录，没有积累成可复用的架构原则或决策记录
2. **每次探索从零开始** — Explore 阶段不读取历史认知，可能重复建议已深化或已决策的内容
3. **decisions/ 和 research-docs/ 目录为空** — 设计时预留但未落地
4. **历史不可追溯** — 21 个版本堆叠，无总览，无法快速理解演进脉络

### 设计目标

将 skill 从"一次性工具"升级为"持续积累的架构知识库"：

- 每次迭代积累架构认知（原则、决策、研究事实）
- 下次 Explore 时读取历史，避免重复分析
- skill 目录为真相来源，docs/ 为视图
- 最小侵入现有流程

### 约束

- 只服务 neptune-engine 项目，不考虑通用性
- 不使用外部 hook 机制，靠 skill 流程内嵌规则控制
- 遵循项目"渐进式改造"原则

### 与现有文档体系的关系

现有 SKILL.md 中引用了 `docs/adr/` 和 `../grill-with-docs/` 的格式文件（`ADR-FORMAT.md`、`CONTEXT-FORMAT.md`）。实际情况：

- `docs/adr/` 目录在项目中不存在
- `../grill-with-docs/` skill 目录不存在（grill-with-docs 位于 `neptune-lab/.claude/skills/`，路径引用有误）
- 这些引用是当前 SKILL.md 的断裂点

**决策：**

- ARCHITECTURE-DECISIONS.md **替代** `docs/adr/`，作为 skill 内部的轻量决策记录（增量追加，低门槛）
- 不创建 `docs/adr/` 目录；如果未来决策足够重要需要正式 ADR，再按需创建
- SKILL.md 中对 `../grill-with-docs/` 的引用（CONTEXT-FORMAT.md、ADR-FORMAT.md）保留，因为 grill-with-docs skill 实际存在于 `neptune-lab/.claude/skills/grill-with-docs/`
- `docs/architecture-design.md` 中已有 11 条架构原则（F1-F5 强制 + G1-G6 建议），这些将**迁移**到 ARCHITECTURE-PRINCIPLES.md，`docs/architecture-design.md` 的原则章节变为指向 skill 的引用

---

## 二、文件体系设计

### 2.1 目录结构

```
improve-codebase-architecture/
├── SKILL.md                      # 主入口（小幅修改，增加知识读写规则）
├── LANGUAGE.md                   # 架构术语（不变）
├── DEEPENING.md                  # 深化指导（不变）
├── INTERFACE-DESIGN.md           # 接口设计（不变）
│
├── ARCHITECTURE-PRINCIPLES.md    # 【新增】架构原则 — 不变约束
├── ARCHITECTURE-DECISIONS.md     # 【新增】关键决策记录 — 增量追加
├── KNOWLEDGE.md                  # 【新增】认知索引 — 每次迭代更新
│
├── decisions/                    # 【激活】详细决策文件（按需）
├── research-docs/                # 【激活】研究事实记录（按需）
│
├── upgrade-versions/             # 【保留】历史迭代记录
│   └── SUMMARY.md                # 【新增】v1-v21 总览
└── SYNC-LOG.md                   # 【新增】docs/ 同步记录
```

### 2.2 文件职责

| 文件 | 性质 | 内容 | 更新时机 |
|------|------|------|----------|
| SKILL.md | 稳定 | 主入口，包含流程和知识读写规则 | 流程变更时 |
| LANGUAGE.md | 不变 | 架构术语定义 | — |
| DEEPENING.md | 不变 | 深化指导 | — |
| INTERFACE-DESIGN.md | 不变 | 接口设计指导 | — |
| ARCHITECTURE-PRINCIPLES.md | 稳定 | 架构原则（从 docs/architecture-design.md F1-F5/G1-G6 迁移 + 迭代积累） | 发现新原则或原则被推翻时 |
| ARCHITECTURE-DECISIONS.md | 增长 | 每条决策一行摘要，复杂决策链接到 decisions/ 详情 | 每次迭代做决策时追加 |
| KNOWLEDGE.md | 迭代更新 | 模块状态、待办列表、研究事实索引（指向 research-docs/） | 每次迭代结束时更新 |
| decisions/ | 按需 | 跨 3+ 模块或需 100+ 字解释的决策详细文件 | 复杂决策时 |
| research-docs/ | 按需 | 研究事实的详细记录 | 发现需持久化的事实时 |
| upgrade-versions/ | 增长 | 每次迭代的完整记录（保持现有模式） | 每次迭代 |
| SUMMARY.md | 一次性 | v1-v21 历史总览（五阶段划分在回顾时确定） | 当前做一次 |
| SYNC-LOG.md | 增长 | 同步到 docs/ 的记录 | 每次同步时追加 |

**KNOWLEDGE.md 与 okr-roadmap.md 的关系：**
- KNOWLEDGE.md 是模块级粒度（哪个模块什么状态）
- `docs/okr-roadmap.md` 是版本级粒度（哪个版本哪些 KR）
- KNOWLEDGE.md 是 okr-roadmap.md 的输入之一，两者不冲突

### 2.3 真相来源与同步

- **skill 目录 = 真相来源**：所有架构知识的完整原始信息存储在此
- **docs/ = 视图**：从 skill 同步的提炼结论

同步目标：
- `docs/architecture-design.md` ← 替换第三节"架构设计原则"的表格内容为 ARCHITECTURE-PRINCIPLES.md 的引用（指向 skill 目录），保持文档其余部分不变
- 不创建 `docs/adr/` 目录（由 ARCHITECTURE-DECISIONS.md 替代）
- `docs/okr-roadmap.md` 的更新由执行流程保证，不纳入 SYNC-LOG 追踪
- 每次同步记录到 SYNC-LOG.md

---

## 三、SKILL.md 流程修改

### 3.1 Explore 阶段：增加知识加载

在现有"Read existing documentation first"之后、Agent tool 探索之前，插入：

```
然后读取 skill 积累的架构认知：
- ARCHITECTURE-PRINCIPLES.md — 当前架构原则
- KNOWLEDGE.md — 已知的模块状态、已深化/待深化列表
- ARCHITECTURE-DECISIONS.md — 历史决策（扫描最近 10 条）

带着这些认知去探索，而非从零开始。
对已深化的模块，不做重复建议。
对已决策的方案，不重新建议（除非有新的证据）。
```

### 3.2 Grilling 阶段：增加知识写入

在现有 grilling 流程中增加规则：

```
决策结晶时的写入规则：
1. 确定了一条新的架构原则 → 追加到 ARCHITECTURE-PRINCIPLES.md
2. 做出了一个架构决策 → 追加到 ARCHITECTURE-DECISIONS.md
3. 发现了需要持久化的研究事实 → 写入 research-docs/，在 KNOWLEDGE.md 研究事实栏目添加索引链接
4. 复杂决策（跨 3+ 模块或需 100+ 字解释）→ 在 decisions/ 下创建单独文件，在 ARCHITECTURE-DECISIONS.md 表格中链接
```

### 3.3 迭代结束：增加 Reflect 步骤

**触发条件：**

- 当用户明确表示"本次迭代完成"时触发（如"可以了"、"完成了"、"进入收尾"等信号）
- 如果一次 Explore 产生多个候选，**全部候选处理完毕后统一 Reflect**
- 如果用户中途放弃某个候选，不触发 Reflect；但如果放弃后有明确的其他工作完成，仍然触发

**执行内容：**

```
1. 更新 KNOWLEDGE.md：
   - 标记本次深化的模块
   - 更新模块状态（已深化/待深化/跳过）
   - 记录新发现的待深化候选
   - 研究事实栏目添加索引链接（指向 research-docs/）

2. 同步到 docs/：
   - 架构原则有变化 → 替换 docs/architecture-design.md 第三节内容为指向 skill 的引用
   - 关键决策 → 记录到 SYNC-LOG.md

3. 创建 upgrade-versions/v{N+1}/ 记录本次迭代（保持现有模式）
```

**容错机制：**

- Reflect 步骤中的文件更新按顺序执行：先 KNOWLEDGE.md → 再 SYNC-LOG.md → 最后 docs/ 同步
- 如果中途 context window 溢出，已写入的文件保持有效，未写入的下次迭代时补齐
- KNOWLEDGE.md 顶部的"最后更新"时间戳可用于判断上次 Reflect 是否完整

---

## 四、文件内容格式

### 4.1 ARCHITECTURE-PRINCIPLES.md

```markdown
# 架构原则

> 记录时间: {日期}
> 来源: v1-v21 历史回顾

## 核心原则（不可违反）

### P1: 包装不替代
框架核心是扩展 Claude Code，不是从头构建。
**Why:** CC 核心逻辑稳定可靠，重写风险远大于包裹。
**Scope:** 所有对 claude-code/ 的改动。

### P2: engine/ 零向上穿透
engine/ 目录不依赖上层 src/ 根文件。
**Why:** SDK 独立性要求核心层不耦合宿主。
**Scope:** engine/ 目录内所有 import。

...（从 v1-v21 提炼）

## 扩展原则（迭代积累）

### P{N}: {标题}
{描述}
**Why:** {为什么}
**Scope:** {适用范围}
**Since:** v{N}
```

### 4.2 ARCHITECTURE-DECISIONS.md

```markdown
# 架构决策记录

| ID | 日期 | 简述 | 上下文 | 结论 | 状态 |
|----|------|------|--------|------|------|
| D1 | {日期} | {简述} | {上下文} | {结论} | 活跃/废弃/待定 |

## 详细决策

{仅复杂决策展开，简单决策保留在表格中}
```

### 4.3 KNOWLEDGE.md

```markdown
# 架构认知索引

> 最后更新: {日期} | 版本: v{N}

## 模块状态

| 模块 | 状态 | 关键版本 | 备注 |
|------|------|----------|------|
| {模块名} | 已治理/已深化/待办/跳过 | V{n} | {说明} |

## 已知待办

- [ ] {待办项}

## 研究事实索引

> 详细内容见 research-docs/ 目录

- [{事实标题}](research-docs/{文件名}.md) — {一句话摘要}
```

### 4.4 SUMMARY.md（upgrade-versions/）

v1-v21 的历史总览，包含五阶段演进、反复出现的主题、关键转折点。此文件一次性创建，后续不更新。

### 4.5 SYNC-LOG.md

```markdown
# Docs 同步记录

| 日期 | 源文件 | 目标文件 | 同步内容 |
|------|--------|----------|----------|
| {日期} | ARCHITECTURE-PRINCIPLES.md | docs/architecture-design.md | 同步 P1-P5 |
```

---

## 五、实施步骤

### 阶段 1：初始化（当前）

1. 创建 ARCHITECTURE-PRINCIPLES.md — 从 `docs/architecture-design.md` F1-F5/G1-G6 迁移 + v1-v21 回顾补充
2. 创建 ARCHITECTURE-DECISIONS.md — 从 v1-v21 的 01-optimizer-research.md 和 04-work-summary.md 提炼关键决策
3. 创建 KNOWLEDGE.md — 从 v1-v21 回顾建立模块状态索引
4. 创建 upgrade-versions/SUMMARY.md — v1-v21 历史总览（五阶段划分在回顾时确定）
5. 创建 SYNC-LOG.md — 初始为空

### 阶段 2：修改 SKILL.md

1. Explore 阶段增加知识加载规则（在 SKILL.md 第 40 行"Then use the Agent tool"之前插入）
2. Grilling 阶段增加知识写入规则（在 SKILL.md 第 69 行"Side effects happen inline"段落中追加）
3. 增加 Reflect 步骤（在 SKILL.md 末尾"### 3. Grilling loop"之后新增"### 4. Reflect"）

### 阶段 3：验证

1. 触发一次 /improve-codebase-architecture
2. 验证 Explore 阶段能正确加载历史知识
3. 验证 Grilling 阶段能正确写入决策
4. 验证 Reflect 步骤能正确更新 KNOWLEDGE.md 和同步 docs/

---

## 六、验收标准

1. skill 目录内存在完整的 6 个新文件
2. SKILL.md 包含 3 处流程修改
3. 下次使用 skill 时，Explore 阶段能读取历史认知
4. 架构原则数量 >= 11 条（从 docs/architecture-design.md F1-F5/G1-G6 迁移）
5. 架构决策记录 >= 10 条（从 v1-v21 回顾提炼）
6. KNOWLEDGE.md 模块状态 >= 10 条
7. docs/architecture-design.md 第三节已替换为指向 skill 目录的引用
