# V7 深度研究报告：CLI 与框架边界梳理

> 版本: v7
> 主题: CLI 启动代码迁移可行性研究 + 无用代码清理
> 日期: 2026-04-26
> 状态: Phase 1 完成

---

## 一、框架现状分析

### 1.1 当前 CLI 与框架的耦合现状

当前 `src/` 目录下，CLI 特有代码与框架核心代码高度混合：

```
src/
├── main.tsx (6971行) ──────────── CLI 启动编排器（Commander.js + 核心逻辑混合）
├── migrations/ (11文件) ────────── CLI 启动配置迁移
├── keybindings/ (16文件) ───────── 终端快捷键系统（被 126+ 文件引用）
├── commands/ (60+子目录, 400文件) ── Slash 命令系统
├── screens/ (3有效文件, 7299行) ─── 终端 UI 页面（REPL/Doctor/Resume）
├── cli/ (128文件, 12857行) ──────── CLI 传输/IO/headless 层
├── vim/ (5文件, 1513行) ─────────── Vim 输入模式状态机
├── components/ ─────────────────── UI 组件库
├── hooks/ ──────────────────────── React UI hooks
│
│ ── 以上均为 CLI/UI 特有 ──
│ ── 以下为框架核心 ──
│
├── engine/ (55文件) ────────────── 框架包装层（零 CLI 依赖）
├── QueryEngine.ts ──────────────── 核心 agent loop
├── query.ts ────────────────────── LLM API 调用
├── tools.ts + tools/ ──────────── 55+ 内置工具
├── state/AppState.tsx ──────────── 应用状态
├── context.ts ──────────────────── 上下文构建
├── services/ ───────────────────── 服务层（API/MCP/Auth/Analytics）
├── utils/ ──────────────────────── 工具函数
└── types/ ──────────────────────── 核心类型定义
```

### 1.2 main.tsx 的组成分析

| 分类 | 行数 | 占比 | 说明 |
|------|------|------|------|
| **CLI 特有** | ~5,500 | 79% | Commander.js 定义(1200行)、子命令注册(900行)、CLI 参数处理和分支(3400行) |
| **框架核心** | ~1,000 | 14% | 设置加载、权限初始化、工具注册、MCP 配置/连接、模型解析、AppState 构建 |
| **边界模糊** | ~470 | 7% | init()、setup()、信任对话框、环境变量、钩子执行 |

### 1.3 engine/ 目录的 CLI 依赖现状

engine/ 对 CLI/UI 层的依赖极其干净：

| CLI/UI 模块 | engine/ 是否引用 | 耦合类型 |
|-------------|-----------------|----------|
| keybindings/ | **零引用** | — |
| migrations/ | **零引用** | — |
| screens/ | **零引用** | — |
| components/ | **零引用** | — |
| vim/ | **零引用** | — |
| main.tsx | **零引用** | — |
| commands/ | 仅 2 处 `import type { Command }` | 编译时类型依赖 |
| hooks/sessionHooks | 仅 1 处 `import type { SessionHooksState }` | 编译时类型依赖 |

**结论**: engine/ 仅存在 3 处类型级耦合（`import type`），零运行时依赖。框架核心已与 CLI 层基本解耦。

### 1.4 CLI 特有模块的引用关系图

```
                    ┌─────────────────────────┐
                    │    main.tsx (CLI入口)     │
                    │   Commander.js + 启动编排  │
                    └─────┬──────┬──────┬───────┘
                          │      │      │
              ┌───────────┘      │      └───────────┐
              ▼                  ▼                   ▼
    ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
    │   migrations/    │ │  keybindings/│ │   commands/      │
    │  仅 main.tsx 引用│ │ 126+文件引用 │ │  QueryEngine 运行 │
    │  (CLI 启动迁移)  │ │ (终端快捷键) │ │  时依赖          │
    └─────────────────┘ └──────────────┘ └─────────────────┘
              │                  │                   │
              │ 无框架核心引用    │ 无框架核心引用     │ QueryEngine 调用
              │                  │                   │ getSlashCommandToolSkills()
              ▼                  ▼                   ▼
    ┌─────────────────────────────────────────────────────────┐
    │                 engine/ (框架核心)                        │
    │         零运行时 CLI 依赖，仅 3 处类型引用                 │
    └─────────────────────────────────────────────────────────┘
```

---

## 二、框架目标对齐分析

| 框架目标 | 当前状态 | 差距 | 影响 |
|----------|----------|------|------|
| 嵌入业务应用、随宿主进程启动 | engine/ 已可用，但 main.tsx 混合了 CLI 逻辑 | 中 | SDK 使用者需要绕过 CLI 启动逻辑 |
| 核心 agent loop 不变 | ✅ 已满足 | 无 | — |
| CLI/Web/App/服务端复用 | CLI 代码与核心混合在 src/ 下 | 高 | 无法独立打包框架 |
| 框架轻量化 | CLI 特有代码占 src/ 约 60%+ | 高 | SDK 包含大量无用 CLI 代码 |
| 零 UI 依赖的 headless 运行 | engine/ 已满足，但核心模块（QueryEngine）依赖 Command 类型 | 低 | 仅类型依赖，易解决 |
| 最小改动现有代码 | 需要迁移而非重写 | — | 迁移方案需要保持兼容性 |

---

## 三、优化清单（TOP 10，按优先级排序）

### 优先级评估维度

| 维度 | 权重 |
|------|------|
| 对框架轻量化的贡献 | 30% |
| 实施风险（低=好） | 25% |
| 实施工作量（小=好） | 20% |
| 用户/开发者价值 | 15% |
| 对现有功能的影响（小=好） | 10% |

| # | 优化重点 | 优先级 | 工作量 | 风险 |
|---|----------|--------|--------|------|
| O1 | migrations 死代码清理 | P0 | 0.5h | 极低 |
| O2 | engine/ 类型依赖解耦（消除 3 处 import type） | P0 | 1h | 低 |
| O3 | Command 类型下沉到 types/ 层 | P1 | 2h | 低 |
| O4 | migrations 目录整体迁移评估 | P1 | 2h | 低 |
| O5 | keybindings/ 归属确认与文档化 | P2 | 1h | 无 |
| O6 | main.tsx 核心启动逻辑提取 | P2 | 4h | 中 |
| O7 | commands/ 中 compact 命令核心化 | P3 | 3h | 中 |
| O8 | screens/ + components/ 外迁方案 | P3 | 6h | 中 |
| O9 | cli/ 传输层框架关系梳理 | P3 | 3h | 低 |
| O10 | vim/ 独立性评估与归属决策 | P4 | 1h | 无 |

---

## 四、每个优化点的详细 OKR 描述

### O1: migrations 死代码清理

**优化重点**: 删除确认无引用的迁移文件

**优化目标**: 清除 `migrateAutoUpdatesToSettings.ts` 死代码

**关键结果**:
- KR1: 删除 `migrateAutoUpdatesToSettings.ts`（零引用、零调用）
- KR2: tsc 编译通过，现有测试不受影响

**预期收益**: 减少代码维护负担，消除混淆

**对框架的影响**:
- 是否破坏"包装不替代"原则: 否（纯删除，无修改）
- 正向影响: 代码更清晰
- 负面影响: 无
- 实施风险: 极低（已确认零引用）

**符合框架目标**: 框架轻量化

**依赖关系**: 无

---

### O2: engine/ 类型依赖解耦

**优化重点**: 消除 engine/ 对 CLI 层的 3 处 `import type` 依赖

**优化目标**: engine/ 目录零 CLI 模块依赖（包括类型级）

**关键结果**:
- KR1: `engine/EngineState.ts` 不再 `import type { Command }` from `../commands.js`
- KR2: `engine/bridge/OriginalQueryEngineBridge.ts` 不再 `import type { Command }` from `../../commands.js`
- KR3: `engine/EngineState.ts` 不再 `import type { SessionHooksState }` from `../utils/hooks/sessionHooks.js`
- KR4: lint:layers 检查 engine/ 零 CLI 引用通过

**实施方案**:
1. 将 `Command` 类型从 `src/commands.ts` 提取到 `src/types/command.ts`（如果尚未存在）
2. 在 engine/types/ 中定义 `EngineCommand` 接口（只包含框架需要的字段）
3. 将 `SessionHooksState` 类型提取到 `src/types/` 或 `engine/types/` 中

**预期收益**: engine/ 完全独立于 CLI 层，可为 SDK 独立打包

**对框架的影响**:
- 是否破坏"包装不替代"原则: 否（类型移动，逻辑不变）
- 正向影响: 框架层完全解耦，可独立发布
- 负面影响: 无
- 实施风险: 低（仅移动类型定义）

**符合框架目标**: 嵌入业务应用、框架轻量化

**依赖关系**: 无

---

### O3: Command 类型下沉到 types/ 层

**优化重点**: 将 `Command` 接口定义从 commands.ts 移到 types/ 核心类型层

**优化目标**: L1 核心类型层包含 Command 类型定义，消除 L2 对 L4 的类型依赖

**关键结果**:
- KR1: `src/types/command.ts` 包含完整的 Command 接口定义
- KR2: `commands.ts` 从 `types/command.ts` 导入类型而非自行定义
- KR3: `QueryEngine.ts` 从 `types/command.ts` 导入 Command 类型
- KR4: lint:layers 验证 L2 不再依赖 L4 的 commands 模块获取类型

**实施方案**:
1. 分析当前 `src/commands.ts` 中 Command 类型的完整定义
2. 将类型定义移到 `src/types/command.ts`
3. 更新所有 import 路径

**预期收益**: 分层架构更规范，QueryEngine 不再类型依赖 CLI 命令模块

**对框架的影响**:
- 正向影响: 符合分层标准中 L1→L2→L3→L4 的单向依赖
- 实施风险: 低（类型移动，需更新 import 路径）

**符合框架目标**: 架构分层规范化

**依赖关系**: 可与 O2 并行

---

### O4: migrations 目录整体迁移评估

**优化重点**: 评估 migrations/ 整体迁移到 CLI 宿主的可行性

**优化目标**: migrations 代码从框架核心 src/ 中移除，由 CLI 入口单独管理

**关键结果**:
- KR1: 确认所有 10 个活跃迁移仅被 main.tsx 引用（已确认）
- KR2: 确认 engine/ 和核心模块零引用 migrations（已确认）
- KR3: 制定迁移方案：migrations 保留在 src/ 但标记为 CLI-only，或移到 cli/ 目录

**分析结论**:
- migrations/ 仅被 `main.tsx` 的 `runMigrations()` 调用（第 585-612 行）
- 在 CLI 启动流程的 `preAction` hook 中执行（第 1320 行）
- engine/ 和核心模块完全不引用
- 所有迁移都是 CLI 特有的配置文件格式演化（GlobalConfig 版本迁移）

**迁移方案**:
```
方案A: 迁移到 src/cli/migrations/（推荐）
  - 保持 src/ 内的组织一致性
  - 明确标记为 CLI-only
  - main.tsx 的 import 路径简单调整

方案B: 迁移到独立 claude-code-cli/ 项目
  - 完全解耦
  - 但增加了跨项目依赖管理
  - 当前阶段不推荐
```

**预期收益**: 框架核心 src/ 不包含 CLI 启动配置迁移逻辑

**对框架的影响**:
- 正向影响: 代码归属更清晰
- 实施风险: 低（仅移动文件和更新 import 路径）

**符合框架目标**: 框架轻量化

**依赖关系**: O1 完成后（先清理死代码再迁移）

---

### O5: keybindings/ 归属确认与文档化

**优化重点**: 明确 keybindings/ 属于 L4 TUI 层，框架 SDK 不包含

**优化目标**: 在架构文档中明确 keybindings 的层级归属和使用边界

**关键结果**:
- KR1: 架构文档明确标注 keybindings/ 为 L4（TUI 层）
- KR2: lint:layers 规则确认 L1/L2/L3 不引用 keybindings
- KR3: 确认 engine/ 零引用 keybindings（已验证）

**分析结论**:
- keybindings/ 被 126+ 文件引用，全部是 L4 层（components/、screens/、hooks/、commands/）
- engine/ 零引用
- 它是完整的终端快捷键系统，包含：
  - 从 `@anthropic/ink` re-export 的类型和 hook（6 个文件）
  - 默认键绑定配置（defaultBindings.ts，11KB）
  - 用户自定义配置加载（loadUserBindings.ts，热重载）
  - Zod Schema 验证、保留快捷键、显示格式化等
- **不能删除**，但明确属于 CLI 宿主层

**预期收益**: 框架打包时可排除 keybindings（L4 整体排除）

**对框架的影响**:
- 正向影响: 归属明确，不影响框架
- 实施风险: 无（仅文档和 lint 规则）

**符合框架目标**: 架构分层规范化

**依赖关系**: 无

---

### O6: main.tsx 核心启动逻辑提取

**优化重点**: 从 main.tsx 的 1000 行框架核心逻辑中提取可复用的启动编排

**优化目标**: 框架核心启动逻辑独立于 Commander.js 和 Ink UI

**关键结果**:
- KR1: 识别并提取 main.tsx 中的框架核心启动逻辑：
  - 设置加载（L709-811）
  - 权限初始化（L2692-2735）
  - 工具注册（L2870-2921）
  - MCP 配置解析和连接（L2272-2406, L3575-3632）
  - 模型解析（L3066-3073）
  - AppState 构建（L4282-4402）
  - Store 创建（L3901-3904）
- KR2: 提取后的逻辑可在非 CLI 环境中复用
- KR3: main.tsx 仅保留 CLI 编排逻辑

**实施方案**:
```
提取为 src/engine/bootstrap/ 或类似目录：
  - buildToolPermissionContext() — 权限初始化
  - resolveModel() — 模型解析
  - loadMcpConfig() — MCP 配置加载
  - buildAppState() — 核心状态构建
  - initializeSession() — 会话初始化

这些函数当前散落在 main.tsx 的 Commander.js action handler 中，
需要提取为独立模块，main.tsx 调用它们。
```

**预期收益**: SDK 使用者可直接调用核心启动函数，不需要通过 CLI 命令行

**对框架的影响**:
- 正向影响: 大幅提升框架可用性
- 负面影响: main.tsx 重构范围大
- 实施风险: 中（需仔细测试 CLI 启动流程不受影响）

**符合框架目标**: 嵌入业务应用、降低接入成本

**依赖关系**: O3 完成后（类型下沉后提取更干净）

---

### O7: commands/ 中 compact 命令核心化

**优化重点**: 评估 commands/ 中哪些命令逻辑是框架核心需要的

**优化目标**: 确认 prompt 类型命令的框架价值，明确命令系统的归属

**关键结果**:
- KR1: 确认 `compact` 命令的上下文压缩逻辑属于框架核心能力
- KR2: 确认 `prompt` 类型命令（commit/review/security-review 等）作为 Skill 扩展点
- KR3: 确认 `local-jsx` 类型命令完全属于 CLI UI 层

**分析结论**:
- commands/ 中 60+ 子目录，绝大多数是 `local-jsx` 类型（纯 CLI UI）
- `prompt` 类型命令本质上是"预定义的 prompt 模板"，框架不需要直接包含
- `compact` 命令的压缩逻辑已在 `services/compact/` 中实现，命令只是 UI 入口
- `getSlashCommandToolSkills()` 是 QueryEngine 唯一运行时依赖，但它获取的是 Skill 列表

**预期收益**: 明确 commands 的归属：命令系统完全属于 CLI 宿主层

**对框架的影响**:
- 正向影响: 框架不需要命令系统
- 实施风险: 中（QueryEngine 需要适配 Skill 发现机制）

**符合框架目标**: 框架轻量化

**依赖关系**: O3 完成后

---

### O8: screens/ + components/ 外迁方案

**优化重点**: 制定 screens/ 和 components/ 从框架核心分离的方案

**优化目标**: 框架 SDK 包不包含任何 React/Ink UI 组件

**关键结果**:
- KR1: 确认 screens/ 完全属于 L4（已验证，engine/ 零引用）
- KR2: 确认 components/ 完全属于 L4（已验证，engine/ 零引用）
- KR3: 制定打包策略：SDK 打包时排除 .tsx 文件和 React 依赖

**分析结论**:
- screens/（7299行）：REPL.tsx + Doctor.tsx + ResumeConversation.tsx，纯终端 UI
- components/：UI 组件库，被 screens 和 hooks 引用
- engine/ 零引用 screens 和 components
- 依赖方向完全正确：screens → 引擎层（单向）

**预期收益**: SDK 可独立于终端 UI 打包

**对框架的影响**:
- 正向影响: SDK 体积大幅减小
- 实施风险: 中（需确认打包配置正确排除）

**符合框架目标**: 框架轻量化、嵌入业务应用

**依赖关系**: O6 完成后（核心启动逻辑提取后，UI 层可完全独立）

---

### O9: cli/ 传输层框架关系梳理

**优化重点**: 梳理 cli/ 目录（headless/SDK/传输层）与框架核心的关系

**优化目标**: 明确 cli/ 在架构中的归属

**关键结果**:
- KR1: 确认 cli/ 中 headless 模式（print.ts, structuredIO.ts）的框架价值
- KR2: 确认 cli/transports/（SSE/WebSocket/Hybrid）属于传输层实现
- KR3: 明确 headless 模式是否属于框架核心还是 CLI 扩展

**分析结论**:
- cli/（128 文件，12857 行）包含：
  - `print.ts`（5612 行）：headless 模式核心输出，引用 `src/engine/log`
  - `structuredIO.ts`（863 行）：结构化 I/O
  - `transports/`（5 个）：SSE/WebSocket/Hybrid/CCR 传输
  - `handlers/`（7 个）：命令处理器
- engine/ 不引用 cli/ 目录
- cli/ 是 CLI 应用特有的传输和 IO 层

**归属判断**: cli/ 完全属于 CLI 宿主层，但其中 `print.ts` 的 headless 输出逻辑
对 SDK 使用者有参考价值（如何消费 QueryEngine 的 Message 流）

**预期收益**: 明确 SDK 的 headless 使用方式

**对框架的影响**:
- 实施风险: 低（仅文档和参考代码）

**符合框架目标**: 降低接入成本

**依赖关系**: 无

---

### O10: vim/ 独立性评估与归属决策

**优化重点**: 评估 vim/ 模块是否值得保留在框架中

**优化目标**: 明确 vim/ 的归属

**关键结果**:
- KR1: 确认 vim/（5 文件，1513 行）是完全独立的纯函数模块
- KR2: 确认 vim/ 不依赖任何 UI 框架（React/Ink）或核心引擎
- KR3: 决定 vim/ 归属（CLI UI 层 vs 独立工具包）

**分析结论**:
- vim/ 是纯函数式的输入模式状态机
- 仅依赖 `../utils/Cursor.js` 和 `../utils/intl.js`
- 完全可移植，无副作用
- 但它服务于 CLI 终端输入，框架 SDK 不需要

**归属判断**: vim/ 属于 CLI 宿主层（L4）

**预期收益**: 归属明确

**对框架的影响**:
- 实施风险: 无

**符合框架目标**: 框架轻量化

**依赖关系**: 无

---

## 五、优化点依赖关系

```
O1 (死代码清理)
 │
 └──→ O4 (migrations 迁移)
       │
       └──→ [后续版本]

O2 (engine 类型解耦) ←── 可并行
 │
O3 (Command 类型下沉) ←── 可并行
 │
 └──→ O6 (main.tsx 核心提取)
       │
       ├──→ O7 (commands 核心化)
       │
       └──→ O8 (screens/components 外迁)

O5 (keybindings 归属) ←── 独立，无依赖
O9 (cli 传输层梳理)  ←── 独立，无依赖
O10 (vim 归属决策)   ←── 独立，无依赖
```

**推荐执行顺序**:

| 批次 | 优化项 | 说明 |
|------|--------|------|
| 第一批 | O1 + O5 + O9 + O10 | 死代码清理 + 归属文档化（低风险、高价值） |
| 第二批 | O2 + O3 | engine 类型解耦 + Command 类型下沉 |
| 第三批 | O4 | migrations 迁移到 cli/ |
| 第四批 | O6 + O7 + O8 | 核心启动逻辑提取（高风险、高价值，建议后续版本） |

---

## 六、后续行动建议

### V7 建议范围（轻量级，1-2 天）

聚焦第一批 + 第二批：

1. **O1**: 删除 `migrateAutoUpdatesToSettings.ts`
2. **O5**: keybindings 归属文档化 + lint 规则确认
3. **O9**: cli/ 传输层关系文档化
4. **O10**: vim/ 归属文档化
5. **O2**: engine/ 3 处 import type 解耦
6. **O3**: Command 类型下沉到 types/
7. **O4**: migrations 迁移到 src/cli/migrations/

### V8+ 建议范围（重量级）

8. **O6**: main.tsx 核心启动逻辑提取
9. **O7**: commands 系统归属明确化
10. **O8**: screens/components 打包排除策略

### 关于"迁移到 claude-code-cli 目录"的结论

**当前阶段不建议创建独立的 claude-code-cli 目录**，原因：

1. **engine/ 已足够独立**: 零 CLI 运行时依赖，仅 3 处类型依赖
2. **打包策略可解决**: 通过打包配置排除 L4 层（screens/components/keybindings/commands/）即可
3. **代码仍在快速演进**: Claude Code 上游持续更新，独立目录会增加同步成本
4. **渐进式原则**: 当前更适合在 src/ 内部做好分层（cli/ 目录已经存在），而非拆分项目

**推荐的渐进式路径**:
```
当前: src/ (混合)
  → V7: src/ 内部清晰分层标记 + 死代码清理 + 类型解耦
  → V8: 核心启动逻辑提取为 engine/bootstrap/
  → V9+: 评估是否需要独立 claude-code-cli/ 项目
```

---

## 七、自我检验

| 检验项 | 结果 |
|--------|------|
| 是否完整阅读了所有核心文档？ | ✅ project-purpose.md, architecture-design.md, architecture-layering-standard.md |
| 目标对齐分析是否有事实依据？ | ✅ 基于 4 个深度代码分析 agent 的结果 |
| TOP 10 优化点是否基于实际代码问题？ | ✅ 每个优化点都有具体的文件、行数、引用数据支撑 |
| 每个优化建议是否考虑了架构影响？ | ✅ 每个 OKR 都包含"对框架的影响"分析 |
| 是否有遗漏的重要问题？ | 已覆盖 migrations、keybindings、commands、screens、cli、vim、main.tsx、engine 类型依赖 |
| 是否遵循"包装不替代"原则？ | ✅ 所有优化都是"移动/清理/提取"，不修改核心 agent loop |
