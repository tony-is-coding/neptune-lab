# Neptune Lab 文档管理规范

> 本文档定义仓库级文档的统一目录结构、分类规则和管理流程。
> ADR 编号: 0002

---

## 一、文档分层原则

文档按 **严谨性** 和 **生命周期** 分为四层：

| 层级 | 目录 | 性质 | 生命周期 |
|------|------|------|----------|
| L1 决策层 | `docs/adr/` | 架构决策记录，不可变 | 永久保留（可标记废弃/替代） |
| L2 设计层 | `{product}/docs/design/` | 功能设计文档，正式 | 随功能演进更新 |
| L3 规范层 | `docs/governance/` | 团队规范、流程约定 | 按需修订 |
| L4 参考层 | `docs/references/` | 外部学习资料、研究笔记 | 可归档删除 |

**关键规则：**
- L1/L2 文档必须基于事实，不允许猜测性内容
- L3 文档修订需通过 ADR 记录变更原因
- L4 文档不影响项目决策，仅供学习参考

---

## 二、仓库级目录结构

```
neptune-lab/
├── CONTEXT-MAP.md              # 仓库导航入口
├── docs/                       # 仓库级文档（跨产品）
│   ├── DOCUMENTATION.md        # 本文档（文档管理规范）
│   ├── adr/                    # 架构决策记录
│   │   ├── README.md           # ADR 索引 + 规范说明
│   │   ├── template.md         # ADR 模板
│   │   ├── 0001-mono-repo-structure.md
│   │   └── ...
│   ├── governance/             # 团队规范
│   │   └── repo-conventions.md
│   └── references/             # 外部参考资料（学习用）
│       ├── claude-reviews-claude/
│       ├── deep-dive-claudecode/
│       └── learn/
├── neptune-engine/
│   ├── CONTEXT.md
│   ├── docs/
│   │   ├── architecture.md     # 架构设计（唯一权威）
│   │   ├── feature-design/     # 功能设计文档
│   │   ├── guides/             # 使用指南
│   │   └── api/                # API 文档
│   └── ...
├── neptune-ai/
│   ├── CONTEXT.md
│   ├── docs/
│   │   ├── design/             # 产品设计文档
│   │   ├── api/                # API 文档
│   │   └── specs/              # 功能规格
│   └── ...
└── shared/
    └── CONTEXT.md
```

---

## 三、各产品文档结构规范

每个产品线（neptune-engine、neptune-ai、neptune-cli）遵循统一的内部文档结构：

```
{product}/
├── CONTEXT.md                  # 产品上下文（必须）
├── docs/
│   ├── design/                 # 设计文档（L2）
│   │   └── {date}-{topic}.md   # 命名格式：日期-主题
│   ├── feature-design/         # 功能设计（仅 engine）
│   │   └── {module}/           # 按模块分目录
│   │       └── {name}-design.md
│   ├── api/                    # API 文档
│   ├── guides/                 # 使用指南
│   └── specs/                  # 功能规格（短期有效）
└── ...
```

**命名规则：**
- 设计文档：`{YYYY-MM-DD}-{topic}.md`（带日期前缀，便于排序和追溯）
- 功能设计：`{name}-design.md`（无日期，随功能演进更新）
- API 文档：`{resource}.md`（按资源命名）

---

## 四、禁止事项

1. **禁止在源码目录内放置设计文档**（如 `src/engine/provider/adapters/DESIGN.md`）
2. **禁止在产品根目录散放文档**（如 `PROJECT_RULE.md`，应合入 CONTEXT.md 或 governance）
3. **禁止 superpowers/ 目录存放项目文档**（superpowers 仅用于 Claude Code skills 工具链产物，不属于项目文档体系）
4. **禁止重复文档**（同一主题只允许一个权威来源）

---

## 五、文档生命周期管理

### 5.1 创建

- 新功能设计 → 在对应产品的 `docs/design/` 或 `docs/feature-design/` 创建
- 架构决策 → 在 `docs/adr/` 创建新 ADR
- 团队规范变更 → 更新 `docs/governance/` 并创建 ADR 记录原因

### 5.2 更新

- 功能设计文档随实现演进更新，保持与代码一致
- 过期内容标记 `> ⚠️ 已过期` 并说明替代文档

### 5.3 归档/删除

- 已废弃的设计文档：标记状态为「已废弃」，保留 6 个月后可删除
- 过程性文档（superpowers/plans、superpowers/specs）：功能上线后归档或删除
- 学习资料（references/）：不再有参考价值时可直接删除

---

## 六、日常迭代流程

```
需求确认 → 创建设计文档(L2) → 实现 → 更新文档 → 如有架构变更则补 ADR(L1)
```

**低摩擦原则：**
- 小改动不需要设计文档，commit message 说清楚即可
- 只有涉及接口变更、架构调整、跨模块影响的改动才需要设计文档
- ADR 只记录「为什么这样做」，不记录「做了什么」（做了什么看 git log）
