# Neptune Engine 深度分析与重构规划（v2 — 自证修订版）

> 日期：2026-05-20
> 状态：规划阶段（仅分析，不动代码）
> 修订原因：v1 版本基于 subagent 二手报告，多处推论与事实不符。本版本所有论断均经过亲自代码核查。

---

## 零、自证报告：v1 中的错误判断

| v1 论断 | 事实 | 修正 |
|---------|------|------|
| "engine/ 依赖 services/ 是违规" | engine/types/mcp.ts 是**屏障文件**，明确用 `export type` 防止 value 穿透；scripts/lint-layers.sh 主动守卫此边界 | 这是**架构设计**，不是违规 |
| "src/ui/ 在 SDK 包中泄漏" | src/index.ts 完全未导出 ui/；tsconfig.json 在 `exclude` 中明确排除 src/ui/** | 已经隔离，**不是问题** |
| "bootstrap/state.ts 被 200+ 文件引用" | 实际 123 个文件，且全部集中在 utils/services/（CC 原始代码固有耦合） | 数字夸大；engine/ **零依赖** |
| "理想架构应大幅重构目录" | 现有 engine/ 已遵循"包装不替代"原则，README 文档清晰，分层 lint 已就位 | 大幅重构会**违反 P1 包装不替代原则** |
| "需要 Phase 4 拆分 utils/" | utils/ 是 CC 原始代码遗产，移动会导致与 Claude Code 上游同步困难 | 不应该动 |

**核心反思：v1 把 CC 原始代码遗产当作"我们的债务"。这是误判。**

---

## 一、重新定位：Neptune Engine 是什么？

它是 **Claude Code 源码的工程化包装产品**。

**两层架构是设计，不是缺陷**：
- **L_inner（CC 原始）** — 1300+ 文件的 Claude Code 源码（query.ts, services/, utils/, tools.ts...）。这是**只读的"内核"**，必须保持与上游同步能力。
- **L_outer（engine/）** — 174 文件的 SDK 包装层。这是**我们写的代码**，承担所有架构约束。

类比：Linux 内核（CC）+ glibc（engine/）。glibc 不应该重写内核，只提供清晰的系统调用接口。

**这意味着重构的范围必须限定在：**
1. ✅ engine/ 内部（我们的代码）
2. ✅ 真正的死代码（确认零引用）
3. ✅ 公共 API 边界（package.json exports, src/index.ts）
4. ❌ utils/, services/, query.ts 等 CC 原始代码（除非有明确同步策略）

---

## 二、事实数据（亲自核查）

### 2.1 文件统计

| 模块 | 文件数 | 性质 |
|------|--------|------|
| src/ 总计 | 1487 | — |
| src/utils/ | 805 | CC 原始 + 少量我们的代码 |
| src/services/ | 282 | CC 原始 |
| src/engine/ | 174 | **我们写的 SDK 层** |
| 嵌套 src/ 死代码 | 202 | 全部 stub，零引用 |

### 2.2 死代码核查结论

**确认 100% 安全删除的文件：**

| 类别 | 文件数 | 验证方法 |
|------|--------|----------|
| 嵌套 src/ 目录 | 202 | `grep "from.*src/(utils|services|state)/src/"` → 0 引用 |
| 根目录调试脚本 | 2 (test-du.ts, test-import.ts) | 不在 build entry，不在 tsconfig include 路径 |
| .jsx 残留 stub | 1 (securityCheck.jsx) | .tsx 同名实现存在；CLI 引用走 .tsx |
| 无效 .js stub | 2 (controlTypes.js, runtimeTypes.js) | 含 `export type` 在 .js 中是无效语法 |

**总计 207 个文件可零风险删除。**

### 2.3 测试基线

```
3314 tests / 3190 pass / 124 fail
```

**项目已存在 124 个失败测试**，主要在 langfuse / OpenAI provider 区域。这是**重要前提**：任何重构必须能区分"我引入的回归"vs"已存在的失败"。

### 2.4 已有的架构守卫（值得保护）

- `scripts/lint-layers.sh` — engine/ 不能 import React/components/screens/keybindings；不能向 ../../utils, ../../services 做 value 穿透
- `engine/types/*.ts` — 屏障文件模式，type re-export 防穿透
- `bootstrap/state.ts` 头部注释：`DO NOT ADD MORE STATE HERE`
- `SessionContextBridge` POC — 已经在解耦全局状态
- `tsconfig.json` exclude `src/ui/**` — UI 与 SDK 类型隔离

**这些都是已经做对的事，不要破坏。**

---

## 三、真正的问题（修订版）

### 3.1 真正的痛点（按严重度）

| # | 问题 | 严重度 | 类型 |
|---|------|--------|------|
| 1 | 202 个嵌套 src/ stub 文件污染 IDE 搜索/类型检查 | 🔴 高 | 死代码 |
| 2 | 124 个 baseline failing tests | 🔴 高 | 测试质量 |
| 3 | package.json `name: "claude-code-best"` 与 SDK 身份不符 | 🟡 中 | 元数据 |
| 4 | 30 个 @cli-only 文件混在 src/ 中，没有视觉边界 | 🟡 中 | 组织 |
| 5 | bootstrap/state.ts 解耦工作未完成（POC 已在做） | 🟢 低 | 进行中 |
| 6 | engine/cc-runtime/HeadlessToolRegistry.ts 未在 engine/index.ts 导出 | 🟢 低 | 一致性 |

### 3.2 不是问题（v1 误判）

| v1 误判 | 真相 |
|---------|------|
| utils/ 太大需要拆分 | utils/ 是 CC 原始代码，拆分会破坏与上游同步 |
| engine/ 依赖 services/ 是违规 | 已通过屏障文件 + lint 脚本规范化 |
| ui/ 在 SDK 包中 | 已通过 tsconfig exclude + 不在 exports 中隔离 |
| 需要重组顶层目录 | 与"包装不替代"原则冲突 |

---

## 四、修订后的重构计划

### Phase 0：清理死代码（立即执行，零风险）

**目标**：删除 207 个零引用文件，让 SDK 信号显现。

**操作清单（顺序执行）**：

1. **清理嵌套 src/ 目录**（最大收益）
   - 删除 29 个 `src/**/src/` 目录（202 文件）
   - 验证：`bun test` 测试数应保持 3314（不应减少 — stub 不应被任何测试引用）

2. **删除根目录调试脚本**
   - `test-du.ts`, `test-import.ts`

3. **删除 .jsx 残留**
   - `src/services/remoteManagedSettings/securityCheck.jsx`

4. **删除无效 .js stub**
   - `src/entrypoints/sdk/controlTypes.js`
   - `src/entrypoints/sdk/runtimeTypes.js`

5. **特殊处理 agentSdkTypes.js**
   - 该文件导出运行时数组（HOOK_EVENTS, EXIT_REASONS）
   - 验证 build 是否依赖：`grep -r "agentSdkTypes" src/`
   - 若有 .ts 同名文件提供相同导出，删除 .js；否则保留

6. **修复主树 stub**
   - `src/constants/querySource.ts` — `export type QuerySource = any`
   - 验证：找到真实定义来源（应该在 entrypoints/sdk/coreTypes.ts），改为 type re-export

**验证矩阵**：

| 检查项 | 预期 |
|--------|------|
| `bun test` | 3190 pass / 124 fail（与基线一致） |
| `bunx tsc --noEmit` | 错误数与基线一致 |
| `bun run build` | 成功 |
| `bun run lint:layers` | 通过 |

### Phase 1：建立可见边界（1 周）

**目标**：让 SDK 用户和贡献者一眼看清"哪些是 SDK，哪些是 CC 原始代码"。

**操作**：

1. **添加 src/CC-LEGACY.md**
   - 列出哪些目录/文件来自 Claude Code 上游
   - 说明同步策略和修改约束

2. **整合 @cli-only 标记**
   - 当前 30 个 @cli-only 散落各处
   - 在 src/index.ts 顶部添加段落明确说明排除规则
   - 考虑添加 ESLint 规则：@cli-only 文件不能被 src/index.ts 直接 export

3. **完善 package.json exports**
   - 当前 exports 已经分层
   - 验证 `tsc --emitDeclarationOnly --paths` 能否独立编译每个 export
   - 在 README 中明确"SDK 用户应该 import 什么"

4. **修复元数据**
   - `name: "claude-code-best"` → 考虑改为 `"@neptune-lab/engine"` 或保留但澄清
   - 评估对发布管道的影响

### Phase 2：清理 baseline failing tests（2-4 周）

**目标**：把 124 fail → 0 fail，建立干净基线。

**前置条件**：Phase 0 完成。

**策略**：
1. 按测试组分类（langfuse / openai / 其他）
2. 每类单独 PR 修复
3. 拒绝"先跳过失败测试"的捷径 — 失败的测试是真实信号

### Phase 3：完成 SessionContextBridge POC（已在进行中）

**目标**：完成 bootstrap/state.ts 的渐进式解耦。

**状态**：T5/T6/T7/T8 注释显示 POC 已经实施中，无需新规划。

**操作**：跟进现有 TODO，不引入新方案。

---

## 五、不应该做的事（避免屎上雕花）

| ❌ 不要做 | 原因 |
|----------|------|
| 重组 src/ 目录到 core/ services/ platform/ | 违反"包装不替代"，破坏与 CC 上游同步 |
| 把 utils/ 拆分到多个顶层目录 | 同上 |
| 重写 query.ts | 1773 行实战验证代码，重写收益远低于风险 |
| 把 services/ 改造为按需注入 | CC 原始代码深度耦合，需求未验证就改造是过度设计 |
| 从头设计"理想架构" | 这不是新项目，存量约束是设计输入 |

---

## 六、立即可执行（已经准备好）

**Phase 0 是零风险操作。** 验证完成：
- 207 个文件确认零引用
- 测试基线已记录（3190 pass / 124 fail）
- 验证矩阵已定义

需要我执行吗？

执行计划：
```bash
# 1. 删除嵌套 src/ 目录（29 个目录，202 文件）
find src -type d -name 'src' -path 'src/*' -exec rm -rf {} +

# 2. 删除根目录调试脚本
rm test-du.ts test-import.ts

# 3. 删除 .jsx 残留
rm src/services/remoteManagedSettings/securityCheck.jsx

# 4. 删除无效 .js stub
rm src/entrypoints/sdk/controlTypes.js src/entrypoints/sdk/runtimeTypes.js

# 5. 验证
bun test 2>&1 | tail -5
bunx tsc --noEmit 2>&1 | tail -5
bun run build 2>&1 | tail -5
```

---

## 七、终极目标的重新定义

**v1 的目标**："让开发者 5 分钟理解 SDK"
**v2 的目标**：保持上面的目标，**同时不破坏与 CC 上游的同步能力**。

这个限制条件至关重要。Neptune Engine 的长期价值不是"漂亮的目录结构"，而是：
1. 跟上 Claude Code 的能力演进
2. 在此之上提供清晰的 SDK 抽象
3. 让产品层（neptune-ai 等）享受 CC 进化红利而不感知 CC 内部变化

engine/ 已经做对了 80% 的事。剩下 20% 是清理死代码 + 完成 in-progress 的 POC。**不是大手术。**

---

## 八、致读者

我在 v1 中提出的"理想架构"图（core/ services/ platform/ 三层重组）是错误的。

错误根源：把 CC 原始代码当作我们的代码来评判。

正确的工程心态：**对存量代码保持谦卑**。1300+ 文件不是凭空写出来的，每行都对应过真实问题。除非我能逐一回答这些问题，否则不该建议大规模重组。

剩下的真正可做的事：删 207 个死代码文件，修 124 个失败测试，完成 SessionContextBridge POC。

仅此而已。但这已经足够。
