# V8 优化研究报告 — 内部架构收尾

> 版本: v8
> 分析时间: 2026-04-27
> 分析范围: src/ 全量代码 + claude-code-cli/src/ 边界检查
> 分析基准: architecture-design.md + okr-roadmap.md + 架构优化原则

---

## 一、框架现状分析

### 1.1 V8 OKR 路线图 KR 状态复核

| KR | 描述 | 路线图预估 | 实际状态 |
|----|------|-----------|---------|
| KR1 | engine/ 零 CLI import | 1h | ✅ **已完成** — engine/ 零 CLI 依赖（V7 已达成） |
| KR2 | Command 类型下沉到 types/ 层 | 2h | 🔄 **部分完成** — ICommandProvider 接口已定义，但注入机制是空桩 |
| KR3 | migrations 迁移到 cli/ 目录 | 2h | ✅ **已完成** — migrations 已在 claude-code-cli/src/ 下 |
| KR4 | 删除 migrateAutoUpdatesToSettings.ts 死代码 | 0.5h | ✅ **已完成** — 文件已不存在 |
| KR5 | keybindings/vim/cli 归属文档化 | 2h | ⬜ **待做** — keybindings 已在 CLI，但文档未更新 |
| KR6 | lint:layers + tsc + 全量测试通过 | — | ⬜ **待验证** — 质量门槛 |

**关键发现**：KR1/KR3/KR4 三个 KR 在 V7 中已经完成。V8 的核心工作量集中在 **KR2（命令解耦）** 和 **新增的反向依赖消除**。

### 1.2 反向依赖全景（19 个框架文件 → CLI 包）

| 依赖类别 | 涉及文件数 | 导入条目数 | 风险等级 |
|----------|-----------|-----------|---------|
| Commands 命令注册 | 1 (commands.ts) | ~110 | 🔴 高 |
| UI 组件 (React/Ink) | 8 | 10 | 🔴 高 |
| Bridge 桥接模块 | 3 | 3 | 🟡 中 |
| poorMode 功能 | 2 | 2 | 🟡 中 |
| SSETransport 传输 | 1 | 1 | 🟡 中 |
| upstreamproxy 代理 | 1 | 1 | 🟢 低 |
| KeybindingSetup 快捷键 | 1 | 1 | 🟢 低 |
| **合计** | **19 个文件** | **~130 条** | — |

### 1.3 残留在框架中的 React 依赖

以下 **11 个文件** 仍包含 `import React`，属于 CLI 层但仍在 src/ 中：

| 文件 | 类型 | 门控 |
|------|------|------|
| `context/notifications.tsx` | React hook + Context | 无门控 |
| `context/voice.tsx` | React Context | feature('VOICE_MODE') |
| `context/stats.tsx` | React Context Provider | 无门控 |
| `context/mailbox.tsx` | React Context Provider | 无门控 |
| `context/fpsMetrics.tsx` | React Context Provider | 无门控 |
| `context/promptOverlayContext.tsx` | React Context Provider | 无门控 |
| `state/AppState.tsx` | React Context Provider | 无门控 |
| `buddy/useBuddyNotification.tsx` | React hook | feature('BUDDY') |
| `buddy/CompanionCard.tsx` | Ink UI 组件 | feature('BUDDY') |
| `utils/teleport.tsx` | Teleport 组件 | 无门控 |
| `services/mcp/MCPConnectionManager.tsx` | React Context | 无门控 |
| `services/remoteManagedSettings/securityCheck.tsx` | Ink UI 对话框 | 无门控 |

### 1.4 死代码/孤立代码

| 代码 | 位置 | 引用数 | 判断 |
|------|------|--------|------|
| `jobs/classifier.ts` | src/jobs/ | **零引用** | 死代码，可直接删除 |
| `buddy/` 目录 (7 文件) | src/buddy/ | 2 处外部引用 | CLI 纯功能，feature('BUDDY') 门控 |
| `proactive/` 目录 (3 文件) | src/proactive/ | 3 处动态引用 | CLI 纯功能，feature 门控 |
| `migrations/src/` 嵌套目录 | claude-code-cli/src/migrations/src/ | 零引用 | 误操作产物，可删除 |

---

## 二、框架目标对齐分析

| 项目目标 (project-purpose.md) | 当前差距 | V8 可改善程度 |
|------------------------------|---------|-------------|
| 物理分离：claude-code/ 只含 SDK 核心 | 19 个文件反向依赖 CLI | 🟡 中 — 减少 50%+ 反向依赖 |
| 零 UI 依赖：SDK 零 React/Ink | 11 个 React 文件残留 | 🟡 中 — 清理 buddy/jobs 等可废弃模块 |
| 独立发布：可 npm install 使用 | commands.ts 硬编码 CLI 命令 | 🔴 高 — ICommandProvider 完成后框架不再硬绑 CLI |
| 嵌入式 SDK：随宿主进程启动 | Notification 类型含 React | 🟡 中 — 提取 Notification 类型 |
| 多 Session 并发 ≥ 10 | 无直接影响 | 🟢 低 |
| 测试覆盖 ≥ 90% | 2813 tests pass | 🟢 维持 |
| 分层违规：零 (lint:layers) | 当前零违规 | 🟢 维持 |

---

## 三、优化清单（按优先级排序，TOP 10）

### O1: ICommandProvider 注入机制实现（最高优先级）

- **优化重点**：完成 commands.ts 的命令解耦，消除框架对 CLI 命令实现的硬编码依赖
- **优化目标**：框架通过 ICommandProvider 接口获取命令，CLI 在启动时注入具体实现
- **关键结果**：
  - KR1: DefaultCommandProvider 类实现 14 个接口方法，委托 commands.ts 现有函数
  - KR2: setCommandProvider/getCommandProvider 从空桩变为真实注入机制
  - KR3: CLI 启动时调用 setCommandProvider() 注入，QueryEngine 通过接口消费
  - KR4: commands.ts 中的 110 条 CLI import 可以逐步迁移到 CLI 侧
- **预期收益**：框架核心不再硬编码 CLI 命令实现，SDK 可独立运行无需 CLI 命令模块
- **对框架的影响**：
  - 破坏"包装不替代"原则？ — 否，接口委托模式符合包装原则
  - 正向影响：消除最大反向依赖点（110 条导入），为 V9 核心启动提取扫清障碍
  - 负面影响：无
  - 风险：中等 — commands.ts 有 25+ 上游消费者，需要逐步迁移
- **符合框架目标**：物理分离、独立发布、嵌入式 SDK
- **依赖关系**：无前置依赖

### O2: UI 组件反向依赖消除

- **优化重点**：8 个框架文件导入了 CLI 的 React/Ink 组件，需通过注册模式或类型提取解耦
- **优化目标**：框架核心不直接依赖 CLI 的 UI 组件实现
- **关键结果**：
  - KR1: MessageResponse、BashModeProgress、ComputerUseApproval 等 UI 组件通过 ComponentRegistry 获取
  - KR2: SuggestionItem 类型从 CLI 组件中提取到 types/ 层
  - KR3: IdeOnboardingDialog 等通过动态 import + 注册模式解耦
- **预期收益**：框架核心零 CLI UI 组件依赖，headless 模式可完全独立运行
- **对框架的影响**：
  - 破坏原则？ — 否，遵循 G6 组件注册模式
  - 正向影响：消除 8 个文件的 CLI 依赖
  - 负面影响：引入 ComponentRegistry 抽象层
  - 风险：中等 — 涉及 toolRendering 等运行时路径
- **符合框架目标**：零 UI 依赖、物理分离
- **依赖关系**：可与 O1 并行

### O3: Notification 类型提取

- **优化重点**：`Notification` 类型定义在 `context/notifications.tsx`（React 文件）中，但被 4 个核心文件引用
- **优化目标**：将 Notification 类型提取到 `types/` 层，消除核心文件的 React 间接依赖
- **关键结果**：
  - KR1: `types/notification.ts` 定义纯数据 Notification 类型（去除 JSXNotification 的 React.ReactNode）
  - KR2: Tool.ts、toolContext.ts、AppStateStore.ts、claude.ts 改为从 types/ 导入
  - KR3: context/notifications.tsx 改为从 types/ 导入并扩展 JSX 版本
- **预期收益**：核心类型零 React 依赖，为 context/ 目录迁移到 CLI 层扫清障碍
- **对框架的影响**：
  - 破坏原则？ — 否，类型提取是安全的重构
  - 正向影响：消除 4 个核心文件的 React 间接依赖
  - 负面影响：需要定义两套 Notification 类型（纯数据 + JSX 扩展）
  - 风险：低 — 纯类型层面的调整
- **符合框架目标**：核心状态零 React、零 UI 依赖
- **依赖关系**：前置于 O8（context/ 目录迁移）

### O4: parseSSEFrames 提取到框架核心

- **优化重点**：Gemini 客户端通过 5 级相对路径 (`../../../../../`) 引用 CLI 的 SSE 解析函数
- **优化目标**：将纯工具函数 parseSSEFrames 提取到框架核心 utils/
- **关键结果**：
  - KR1: `utils/sse.ts` 包含 parseSSEFrames + SSEFrame 类型
  - KR2: gemini/client.ts 从框架内部导入，消除跨包引用
  - KR3: CLI 的 SSETransport.ts 也改为从框架导入（或保留本地副本）
- **预期收益**：消除最深的跨包依赖链，Gemini provider 完全独立于 CLI
- **对框架的影响**：
  - 破坏原则？ — 否，纯工具函数提取
  - 正向影响：消除 Gemini client 的 CLI 依赖，SSE 解析可复用
  - 负面影响：无
  - 风险：极低 — 零依赖的纯函数，已有测试覆盖
- **符合框架目标**：独立发布、物理分离
- **依赖关系**：无前置依赖，可立即执行

### O5: Bridge 循环依赖消除

- **优化重点**：AppStateStore、product.ts、config.ts 反向导入 CLI 的 bridge/ 模块
- **优化目标**：消除框架→CLI bridge 的 3 处反向依赖
- **关键结果**：
  - KR1: BridgePermissionCallbacks 类型提取到 types/ 层
  - KR2: sessionIdCompat 迁移到框架 utils/ 或 state/
  - KR3: bridgeEnabled 功能改为框架内的配置项或状态
- **预期收益**：消除 Bridge 模块的循环依赖
- **对框架的影响**：
  - 破坏原则？ — 否，类型和配置提取
  - 正向影响：bridge 模块单向依赖
  - 负面影响：bridge 功能可能需要少量适配
  - 风险：低中等 — bridge 是 feature-gated 功能
- **符合框架目标**：物理分离、单向分层依赖 (F2)
- **依赖关系**：无前置依赖

### O6: poorMode 依赖消除

- **优化重点**：query/stopHooks.ts 和 SessionMemory 动态导入 CLI 的 poorMode 模块
- **优化目标**：isPoorModeActive 状态由框架内管理，不依赖 CLI 命令实现
- **关键结果**：
  - KR1: 在 engine/ 或 state/ 中定义 poorMode 状态管理（基于 bootstrap/state.ts）
  - KR2: CLI 的 poor 命令修改框架状态，框架核心读取状态
  - KR3: stopHooks.ts 和 sessionMemory.ts 从框架内部读取 poorMode 状态
- **预期收益**：消除 2 处运行时 CLI 依赖，query 核心不依赖 CLI 命令
- **对框架的影响**：
  - 破坏原则？ — 否，状态提取符合框架设计
  - 正向影响：query 子系统完全独立于 CLI
  - 负面影响：需要在框架中新增 poorMode 状态点
  - 风险：低 — 改为状态读取模式
- **符合框架目标**：独立发布、核心状态零 CLI 依赖
- **依赖关系**：无前置依赖

### O7: buddy/ 目录废弃评估

- **优化重点**：buddy/ 是纯 CLI 娱乐功能（宠物系统），不应存在于框架核心
- **优化目标**：评估 buddy/ 的废弃可行性，若确认可废则迁移到 CLI 或删除
- **关键结果**：
  - KR1: buddy/ 目录（7 文件）迁移到 claude-code-cli/src/ 或标记为废弃
  - KR2: 清理 messages.ts 和 attachments.ts 中的 2 处 buddy 外部引用
  - KR3: 移除框架核心对 buddy 模块的任何导入
- **预期收益**：减少框架体积，消除 2 个 React 文件
- **对框架的影响**：
  - 破坏原则？ — 否，CLI 纯功能移除
  - 正向影响：框架更轻量
  - 负面影响：BUDDY feature 不可用（但这是 CLI 独有功能）
  - 风险：极低 — feature('BUDDY') 门控，2 处引用
- **符合框架目标**：轻量化框架
- **依赖关系**：无前置依赖

### O8: context/ 目录归属确认与迁移准备

- **优化重点**：context/ 全部是 React Context，属于 CLI 层，但 Notification 类型渗入核心
- **优化目标**：明确 context/ 的 CLI 归属，完成 Notification 类型提取后的迁移准备
- **关键结果**：
  - KR1: 完成 O3（Notification 类型提取）后，确认 context/ 可安全迁移到 CLI
  - KR2: 将 context/ 目录迁移到 claude-code-cli/src/context/（或标记为待迁移）
  - KR3: 更新架构文档标注 context/ 归属
- **预期收益**：消除 6 个 React 文件（context/ 目录），框架 React 残留从 11 降至 5
- **对框架的影响**：
  - 破坏原则？ — 否，CLI 功能归还
  - 正向影响：大幅减少框架 React 污染
  - 负面影响：需确保 Notification 类型已提取（依赖 O3）
  - 风险：中等 — 需先完成类型提取
- **符合框架目标**：核心状态零 React、物理分离
- **依赖关系**：依赖 O3 完成

### O9: 死代码清理

- **优化重点**：清理确认无引用的死代码和误操作产物
- **优化目标**：删除所有确认无引用的孤立文件
- **关键结果**：
  - KR1: 删除 `jobs/classifier.ts`（零引用，172 字节）
  - KR2: 删除 `claude-code-cli/src/migrations/src/` 嵌套目录（误操作产物）
  - KR3: 确认并清理其他可能的孤立文件
- **预期收益**：减少代码体积，消除维护噪音
- **对框架的影响**：
  - 破坏原则？ — 否
  - 正向影响：代码更清洁
  - 负面影响：无
  - 风险：极低 — 零引用文件
- **符合框架目标**：轻量化框架
- **依赖关系**：无前置依赖，可立即执行

### O10: 归属文档更新与架构对齐

- **优化重点**：更新架构文档反映 V7-V8 的实际变化，明确模块归属
- **优化目标**：architecture-design.md 和 CLAUDE.md 准确反映当前代码状态
- **关键结果**：
  - KR1: 更新 architecture-design.md — 标注哪些模块已迁移到 CLI、哪些是待迁移
  - KR2: 更新 CLAUDE.md — 反映 claude-code-cli/ 的存在和导入规则
  - KR3: 为每个残留 React 文件和 CLI 反向依赖标注归属和迁移计划
- **预期收益**：团队对代码归属有统一认知，避免误操作
- **对框架的影响**：
  - 破坏原则？ — 否
  - 正向影响：文档与代码一致
  - 负面影响：无
  - 风险：无
- **符合框架目标**：可维护性
- **依赖关系**：建议在 O1-O9 完成后统一更新

---

## 四、优化点依赖关系

```
O9 (死代码清理) ← 无依赖，可立即执行
O4 (parseSSEFrames 提取) ← 无依赖，可立即执行
O5 (Bridge 循环依赖) ← 无依赖，可与 O4 并行
O6 (poorMode 依赖消除) ← 无依赖，可与 O4 并行
O7 (buddy 废弃评估) ← 无依赖，可与 O4 并行

O1 (ICommandProvider 实现) ← 无依赖，但工作量最大
O2 (UI 组件反向依赖) ← 可与 O1 并行

O3 (Notification 类型提取) ← 无依赖，但 O8 依赖它
    │
    └──→ O8 (context/ 迁移) ← 依赖 O3 完成

O10 (文档更新) ← 在 O1-O9 完成后统一更新
```

**建议执行顺序**：
1. **第一批（低风险、无依赖）**：O9 + O4 + O7 — 立即可做
2. **第二批（核心解耦）**：O1 + O2 + O5 + O6 — 并行推进
3. **第三批（依赖链）**：O3 → O8 — 顺序执行
4. **第四批（收尾）**：O10 — 最后统一更新

---

## 五、与 V8 OKR 的映射

| OKR KR | 对应优化点 | 备注 |
|--------|-----------|------|
| KR1 engine/ 零 CLI import | ✅ 已完成 | V7 已达成 |
| KR2 Command 类型下沉 | **O1** ICommandProvider 实现 | 核心任务 |
| KR3 migrations 迁移 | ✅ 已完成 | V7 已达成 |
| KR4 死代码删除 | **O9** 死代码清理 | 范围扩大 |
| KR5 归属文档化 | **O10** 文档更新 | 含反向依赖文档 |
| KR6 质量门槛 | 所有优化点的验证标准 | 贯穿始终 |
| 新增：反向依赖消除 | **O1-O8** | 19 文件 130 条导入 |

---

## 六、后续行动建议

1. **优先执行 O9 + O4**：零风险、立即可见成果，为后续工作热身
2. **重点投入 O1**：ICommandProvider 是 V8 的核心交付物，完成后框架与 CLI 的命令耦合将消除
3. **并行推进 O5 + O6**：Bridge 和 poorMode 的依赖消除可与 O1 同时进行
4. **O3 → O8 链路**：Notification 类型提取是 context/ 迁移的前置条件，需按顺序执行
5. **O7 buddy 废弃**：与用户确认是否保留 buddy 功能后再决定删除还是迁移
6. **O10 统一更新**：所有代码变更完成后，统一更新架构文档

---

## 附录：研究数据来源

- engine/ 目录全量扫描 — 零 CLI 依赖确认
- commands.ts 803 行分析 — 93 个命令模块导入 + 25+ 上游消费者
- 19 个反向依赖文件 — 按 5 级相对路径深度搜索
- ICommandProvider 存根分析 — 14 个接口方法 + 12 个现成实现
- parseSSEFrames 源码分析 — 纯工具函数，零外部依赖
- Notification 类型分析 — TextNotification | JSXNotification（含 React.ReactNode）
- buddy/proactive/context 归属分析 — 特性门控 + 引用链追踪
