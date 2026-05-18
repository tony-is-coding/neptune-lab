# ADR（架构决策记录）规范

> 本文档定义 ADR 的编号规则、生命周期管理和编写流程。

---

## 一、什么是 ADR

ADR（Architecture Decision Record）记录项目中重要的架构决策。它回答一个核心问题：**为什么我们选择了这个方案而不是其他方案？**

**适用场景：**
- 技术选型（数据库、框架、协议）
- 架构模式变更（单体→微服务、同步→异步）
- 跨模块接口设计决策
- 重大规范变更（文档规范、代码规范）
- 放弃某个方案的决策

**不适用场景：**
- 具体功能的实现细节（用 feature-design 文档）
- Bug 修复（用 commit message）
- 日常重构（除非改变了架构边界）

---

## 二、编号规则

### 格式

```
{NNNN}-{short-slug}.md
```

- `NNNN`：4 位数字，从 0001 开始递增
- `short-slug`：小写字母 + 连字符，简短描述决策主题
- 编号一旦分配不可复用（即使 ADR 被废弃）

### 示例

```
0001-mono-repo-structure.md
0002-documentation-management.md
0003-session-store-postgresql.md
0004-redis-cache-strategy.md
```

### 编号分配

- 新建 ADR 时取当前最大编号 +1
- 不允许跳号
- 不允许在中间插入

---

## 三、生命周期

```
提议(proposed) → 已接受(accepted) → [已废弃(deprecated) | 已替代(superseded)]
```

| 状态 | 含义 | 可变更为 |
|------|------|----------|
| **proposed** | 正在讨论，尚未生效 | accepted / deprecated |
| **accepted** | 已生效，团队遵循 | deprecated / superseded |
| **deprecated** | 不再适用，但无替代方案 | — |
| **superseded by NNNN** | 被新 ADR 替代 | — |

**规则：**
- ADR 内容一旦 accepted 就不可修改正文（只能追加「补充说明」章节）
- 需要修改决策时，创建新 ADR 并将旧 ADR 标记为 superseded
- deprecated/superseded 的 ADR 永久保留，不删除

---

## 四、ADR 模板

```markdown
# {NNNN}: {决策标题}

- **日期**: YYYY-MM-DD
- **状态**: proposed | accepted | deprecated | superseded by [NNNN](./NNNN-xxx.md)
- **决策者**: {参与决策的人/角色}

## 背景

[什么问题驱动了这个决策？当前的痛点是什么？]

## 决策

[我们决定做什么？用一两句话概括核心决策。]

## 方案对比

| 方案 | 优势 | 劣势 | 备注 |
|------|------|------|------|
| 方案 A（选定） | ... | ... | |
| 方案 B | ... | ... | |

## 后果

### 正面
- [决策带来的好处]

### 负面
- [决策带来的代价或约束]

### 风险
- [潜在风险及缓解措施]

## 补充说明

[accepted 后如需补充上下文，在此追加，注明日期]
```

---

## 五、ADR 索引

在 `docs/adr/README.md` 中维护索引表：

```markdown
# 架构决策记录索引

| 编号 | 标题 | 状态 | 日期 |
|------|------|------|------|
| [0001](./0001-mono-repo-structure.md) | Mono-Repo 结构规范 | accepted | 2026-05-03 |
| [0002](./0002-documentation-management.md) | 文档管理规范 | accepted | 2026-05-18 |
```

**维护规则：**
- 每次新增/变更 ADR 状态时同步更新索引
- 索引按编号升序排列
- deprecated/superseded 的条目保留在索引中（不删除）

---

## 六、编写流程

1. **发起**：创建 ADR 文件，状态设为 `proposed`
2. **讨论**：团队 review（可通过 PR 或 issue 讨论）
3. **决定**：达成共识后将状态改为 `accepted`
4. **执行**：按决策内容实施
5. **演进**：如需变更，创建新 ADR，旧 ADR 标记为 `superseded`

**低摩擦原则：**
- 不需要所有人签字，决策者确认即可
- 小决策可以先实施再补 ADR（但必须补）
- ADR 不需要长篇大论，核心是「为什么选这个」
