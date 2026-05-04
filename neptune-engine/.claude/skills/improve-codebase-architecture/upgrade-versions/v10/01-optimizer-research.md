# V10 优化研究报告 — 物理分离切割 + 启动完善 + React 解耦 + 架构文档

> 版本: v10
> 分析时间: 2026-04-27
> 分析范围: src/ + claude-code-cli/src/ + docs/
> 分析基准: architecture-design.md + okr-roadmap.md + V9 执行报告

---

## 一、框架现状分析

### 1.1 V9 后框架纯净度

V9 完成反向依赖归零和 context/ 完整迁移后的状态：

| 指标 | 数值 |
|------|------|
| 框架→CLI 反向依赖 | **0 条**（V9 归零） |
| .tsx 文件 | **18 个**（框架内残留） |
| React 运行时导入 | **25 个文件**（含类型定义文件） |
| Ink 运行时导入 | **0 个**（V9 已清除） |
| package.json react 依赖 | `"react": "^19.2.4"` |
| initializeEngine 完成度 | 骨架版（模型解析+工具注册已实现，5 个 TODO） |
| 总文件数 | 1,309 个 (.ts/.tsx) |

### 1.2 React 残留详细分析

**18 个 .tsx 文件分类**：

| 分类 | 文件 | React 用途 | 解耦方案 |
|------|------|-----------|---------|
| **核心 React** | state/AppState.tsx | createContext + Provider + hooks | 需深度解耦 |
| **UI 组件桥** | services/remoteManagedSettings/securityCheck.tsx | Ink render | 已通过 ComponentRegistry 解耦 |
| **UI 组件桥** | utils/computerUse/wrapper.tsx | JSX 渲染 | 已通过 ComponentRegistry 解耦 |
| **UI 组件桥** | utils/computerUse/toolRendering.tsx | JSX 渲染 | 已通过 ComponentRegistry 解耦 |
| **UI 组件桥** | utils/claudeInChrome/toolRendering.tsx | JSX 渲染 | 已通过 ComponentRegistry 解耦 |
| **UI 组件桥** | utils/processUserInput/processBashCommand.tsx | JSX 渲染 | 已通过 ComponentRegistry 解耦 |
| **纯逻辑 .tsx** | tasks/LocalAgentTask/LocalAgentTask.tsx | **无 React** | 重命名为 .ts |
| **纯逻辑 .tsx** | tasks/LocalShellTask/LocalShellTask.tsx | **无 React** | 重命名为 .ts |
| **纯逻辑 .tsx** | tasks/RemoteAgentTask/RemoteAgentTask.tsx | **无 React** | 重命名为 .ts |
| **纯逻辑 .tsx** | tasks/InProcessTeammateTask/InProcessTeammateTask.tsx | **无 React** | 重命名为 .ts |
| **工具文件** | services/mcp/MCPConnectionManager.tsx | require('react') 条件导入 | 评估移除 |
| **工具文件** | utils/highlightMatch.tsx | React 导入 | 评估移除 |
| **工具文件** | utils/plugins/performStartupChecks.tsx | React 导入 | 评估移除 |
| **工具文件** | utils/processUserInput/processSlashCommand.tsx | React 导入 | 评估移除 |
| **工具文件** | utils/staticRender.tsx | React + Ink render | CLI 专用，评估迁移 |
| **工具文件** | utils/status.tsx | React 导入 | 评估移除 |
| **工具文件** | utils/statusNoticeDefinitions.tsx | React 导入 | 评估移除 |
| **工具文件** | utils/teleport.tsx | useAppState hook | 需解耦 |

### 1.3 AppState.tsx React 依赖分析

**AppState.tsx（238 行）React 使用**：

| React API | 行号 | 用途 |
|-----------|------|------|
| `React.createContext` | L50, L53, L71 | 创建 AppStoreContext、MailboxContext、HasAppStateContext |
| `useState` | L89 | 创建 store 实例 |
| `useEffect` | L101, L129 | bypass permissions 检查、settings 变更监听 |
| `useCallback` | L123 | onSettingsChange 回调 |
| `useMemo` | L135 | mailbox 实例 |
| `useContext` | L62, L79, L150, L234 | 获取 Context 值 |
| `useSyncExternalStore` | L191, L235 | 订阅外部 store |
| JSX Provider | L138-144 | 嵌套 Provider 渲染 |

**消费者统计**：

| 消费方 | 导入方式 | 文件数 |
|--------|---------|--------|
| 框架 src/ | `import type { AppState }` | 48（类型导入，无 React 运行时） |
| 框架 src/ | `useAppState` 等 React hooks | **6**（需修改） |
| CLI claude-code-cli/src/ | `useAppState` 等 React hooks | 117（CLI 侧，不影响 SDK） |
| CLI claude-code-cli/src/ | `AppStateProvider` | 4 |

**关键发现**：框架内仅 **6 个文件**使用 React hooks 运行时，**48 个文件**仅使用类型导入。AppState 解耦的影响面比预期小得多。

### 1.4 initializeEngine.ts 差距分析

**已完成**（~200 行有效逻辑）：
- EngineConfig 接口（~100 字段配置）
- 模型解析（L340-357）
- 工具注册（L366-379）
- 辅助函数：createDefaultEngineConfig、validateEngineConfig

**5 个 TODO**：

| TODO | 行号 | 估计行数 | 复杂度 | 依赖 |
|------|------|---------|--------|------|
| 权限上下文初始化 | L363 | ~490 行 | 高 | main.tsx:2701-2714 |
| coordinator mode 工具过滤 | L372 | ~10 行 | 低 | main.tsx:2883-2890 |
| SyntheticOutputTool | L373 | ~30 行 | 低 | main.tsx:2904-2930 |
| 命令加载 | L385 | ~20 行 | 低 | main.tsx:~2966 |
| Agent 加载 | L389 | ~20 行 | 低 | main.tsx:~2970 |

**未提取的核心逻辑**（main.tsx 中）：

| 逻辑 | 行数 | 复杂度 | 依赖 |
|------|------|--------|------|
| 设置加载 | ~160 行 | 中 | Commander options |
| MCP 配置解析+连接 | ~680 行 | 高 | Commander options + MCP client |
| AppState 构建 | ~210 行 | 中 | 多个初始化函数 |
| Store 创建 | ~5 行 | 低 | AppState |
| Session 恢复 | ~60 行 | 低 | transcript.jsonl |

### 1.5 目录归属分析

**src/ 当前目录**（1,309 个文件）：

| 目录 | 文件数 | SDK 核心 | CLI 专用 | 评估 |
|------|--------|---------|---------|------|
| engine/ | 57 | ✅ | — | SDK 核心，保留 |
| utils/ | 807 | 大部分 | 小部分 | 需逐模块评估 |
| services/ | 283 | 大部分 | 小部分 | 需逐模块评估 |
| types/ | 35 | ✅ | — | SDK 核心，保留 |
| constants/ | 22 | ✅ | — | SDK 核心，保留 |
| bootstrap/ | 2 | ✅ | — | SDK 核心，保留 |
| query/ | 5 | ✅ | — | SDK 核心，保留 |
| state/ | 8 | ✅ | — | SDK 核心，需 React 解耦 |
| tasks/ | 14 | ✅ | — | SDK 核心，保留 |
| skills/ | 25 | ✅ | — | SDK 核心，保留 |
| entrypoints/ | 14 | 部分 | 部分 | SDK 类型保留，CLI 入口迁移 |
| memdir/ | 9 | ✅ | — | SDK 核心，保留 |
| assistant/ | 5 | ✅ | — | SDK 核心，保留 |
| coordinator/ | 2 | ✅ | — | SDK 核心，保留 |
| proactive/ | 2 | ✅ | — | SDK 核心，保留 |
| plugins/ | 2 | ✅ | — | SDK 核心，保留 |
| schemas/ | 2 | ✅ | — | SDK 核心，保留 |
| outputStyles/ | 1 | — | ✅ | CLI 输出格式，评估迁移 |
| jobs/ | 1 | — | ✅ | CLI 任务分类，评估迁移 |

**关键发现**：大部分目录是 SDK 核心能力，不需要迁移。物理分离的重点在于：
1. 框架内 .tsx 文件的 React 依赖清除
2. utils/ 和 services/ 中少量 CLI 专用模块识别和迁移
3. package.json 中 react 依赖的移除

---

## 二、框架目标对齐分析

| 项目目标 | 当前差距 | V10 可改善程度 |
|---------|---------|-------------|
| 物理分离 | react 仍在 package.json，18 个 .tsx 文件残留 | 🔴 高 — AppState 解耦 + .tsx 清理 |
| 零 UI 依赖 | 6 个框架文件使用 React hooks 运行时 | 🟡 中 — 6 个文件需修改，影响面可控 |
| 独立发布 | initializeEngine 仅骨架，启动链不完整 | 🟡 中 — 填充 TODO + 完整提取 |
| 嵌入式 SDK | AppState Provider 阻塞 headless 路径 | 🟡 中 — 解耦后 headless 可行 |
| 文档完备 | 架构文档模块说明不全 | 🟢 中 — 文档补充任务 |
| 多 Session 并发 | 无直接影响 | 🟢 低 |

---

## 三、优化清单（按优先级排序，TOP 10）

### O1: AppState React 解耦（最高优先级）

- **优化重点**：将 AppState.tsx 的 React Provider 和 hooks 拆分，框架提供纯 JS 状态访问路径
- **优化目标**：SDK 可通过纯 JS 创建和访问 AppState，不依赖 React Provider
- **关键结果**：
  - KR1: 创建 `state/createAppStateStore.ts` — 纯 JS 函数 `createAppStateStore(initialState, onChange)` 返回 store 实例
  - KR2: AppState.tsx 仅保留 React Provider 包装（调用纯 JS 函数），框架核心通过纯 JS 函数获取 store
  - KR3: 框架内 6 个 React hooks 消费者改为直接使用 store API（getState/setState/subscribe）
  - KR4: initializeEngine.ts 内部使用纯 JS 路径创建 store
- **预期收益**：headless/SDK 模式可独立创建状态，零 React 运行时依赖
- **对框架的影响**：
  - 破坏原则？ — 否，状态管理本质不变，仅改变访问方式
  - 正向影响：SDK 可独立运行，initializeEngine 可完整实现
  - 负面影响：需修改 6 个框架文件 + 1 个 CLI 文件
  - 风险：中 — AppState 是全局状态根节点，但消费者少（仅 6 个运行时）
- **符合框架目标**：核心状态零 React（F3）、独立发布
- **依赖关系**：无，应最先执行（阻塞 O2）

### O2: initializeEngine 完善提取

- **优化重点**：将 main.tsx 中剩余的核心启动逻辑提取到 initializeEngine.ts
- **优化目标**：initializeEngine() 可完整独立启动引擎，包含完整的状态初始化链
- **关键结果**：
  - KR1: 实现 5 个 TODO（权限上下文、工具过滤、命令加载、Agent 加载）
  - KR2: 提取设置加载逻辑（~160 行）到 initializeEngine
  - KR3: 提取 MCP 配置解析和连接（~680 行）— 这是最复杂的部分
  - KR4: 提取 AppState/Store 构建（~210 行）— 依赖 O1 完成
- **预期收益**：SDK 可通过 initializeEngine() 完整启动，无需 CLI
- **对框架的影响**：
  - 破坏原则？ — 否，提取不改变行为
  - 正向影响：核心启动可测试、可复用
  - 风险：高 — MCP 配置与 Commander options 深度耦合，需逐块解耦
- **符合框架目标**：独立发布、嵌入式 SDK
- **依赖关系**：依赖 O1（AppState 解耦后才能构建 Store）

### O3: 框架 .tsx 文件 React 清理

- **优化重点**：清除框架内不必要的 React 依赖，将纯逻辑 .tsx 重命名为 .ts
- **优化目标**：框架内 .tsx 文件从 18 个降至 ≤5 个（仅保留真正需要 React 的文件）
- **关键结果**：
  - KR1: 4 个 task .tsx 文件重命名为 .ts（不含 React，仅 .tsx 扩展名）
  - KR2: 评估 utils/staticRender.tsx 等 UI 渲染文件的归属（移到 CLI 或通过 ComponentRegistry 解耦）
  - KR3: 评估 utils/highlightMatch.tsx、utils/status.tsx 等文件的 React 必要性
- **预期收益**：减少框架 React 表面积，向零 React 目标靠近
- **对框架的影响**：
  - 破坏原则？ — 否
  - 正向影响：减少 React 编译负担，清理代码
  - 风险：低 — 主要是重命名和评估
- **符合框架目标**：零 UI 依赖
- **依赖关系**：可与 O1 并行（task 文件重命名无依赖）

### O4: package.json React 依赖移除

- **优化重点**：从 claude-code/package.json 移除 react 运行时依赖
- **优化目标**：SDK 打包后零 React 依赖
- **关键结果**：
  - KR1: O1/O3 完成后，确认框架内无 React 运行时导入
  - KR2: 将 react 移到 peerDependencies 或 devDependencies
  - KR3: 验证 SDK 可在没有 react 的环境中运行
- **预期收益**：SDK 包大小减少，安装更轻量
- **对框架的影响**：
  - 破坏原则？ — 否
  - 正向影响：SDK 真正零 React
  - 风险：中 — 需确保所有 .tsx 文件的 React 使用已处理
- **符合框架目标**：零 UI 依赖、独立发布
- **依赖关系**：依赖 O1 + O3 完成

### O5: 物理分离目录归属决策

- **优化重点**：明确 claude-code/ 和 claude-code-cli/ 的最终目录边界
- **优化目标**：输出目录归属决策表，为物理切割做准备
- **关键结果**：
  - KR1: 评估 utils/ 和 services/ 中每个模块的 SDK/CLI 归属
  - KR2: 识别 CLI 专用模块（outputStyles、jobs、部分 utils）
  - KR3: 输出"应迁移/应保留"决策表，含理由
- **预期收益**：物理切割有清晰的行动指南
- **对框架的影响**：无代码变更，纯分析
- **符合框架目标**：物理分离
- **依赖关系**：无，可与 O1/O2 并行

### O6: 架构文档全面补充

- **优化重点**：补充 architecture-design.md 中每个模块的详细说明
- **优化目标**：每个目录都有清晰的职责说明、关键文件列表、依赖关系
- **关键结果**：
  - KR1: 采集 src/ 下每个一级目录的模块说明
  - KR2: 更新 architecture-design.md 目录树，添加每个模块的职责描述
  - KR3: 在 project-purpose.md 中补充完整的客户端/服务端/SDK 三层架构图
- **预期收益**：文档与代码一致，新人可快速理解架构
- **对框架的影响**：无代码影响
- **符合框架目标**：可维护性
- **依赖关系**：可在代码变更前先做（记录当前状态），代码变更后再更新

### O7: CLI→框架 导入路径规范化

- **优化重点**：CLI 通过 `../../../src/` 相对路径导入，改为包引用
- **优化目标**：CLI 通过 `import { ... } from 'claude-code'` 引用 SDK API
- **关键结果**：
  - KR1: 定义 claude-code/package.json 的 exports 字段
  - KR2: 将 CLI 中高频导入路径改为包引用
  - KR3: 验证 CLI 功能正常
- **预期收益**：物理分离后的标准引用方式
- **对框架的影响**：
  - 风险：中 — 需要调整大量导入路径
- **符合框架目标**：物理分离、独立发布
- **依赖关系**：建议在 O5 决策完成后执行

### O8: state.ts 进程单例 SDK/CLI 归属分析

- **优化重点**：bootstrap/state.ts（1,759 行）有 ~100 getter/setter，需识别哪些是 SDK 必需、哪些是 CLI 特有
- **优化目标**：明确 state.ts 中每个字段/方法的归属
- **关键结果**：
  - KR1: 分析 state.ts 中所有 getter/setter 的消费者
  - KR2: 按消费者分布标注 SDK 核心 / CLI 专用 / 共享
  - KR3: 输出归属分析表
- **预期收益**：为 state.ts 的后续拆分提供依据
- **对框架的影响**：纯分析，无代码变更
- **符合框架目标**：物理分离
- **依赖关系**：无

### O9: MCP 配置提取到 initializeEngine

- **优化重点**：从 main.tsx 提取 ~680 行 MCP 配置解析和连接逻辑
- **优化目标**：SDK 可独立配置和管理 MCP 连接
- **关键结果**：
  - KR1: 提取 MCP server 配置解析（去 Commander options 依赖）
  - KR2: 提取 MCP 连接建立和工具发现
  - KR3: 通过 EngineConfig.mcpServers 传入配置
- **预期收益**：SDK 完整 MCP 能力
- **对框架的影响**：
  - 风险：高 — MCP 逻辑复杂，与 main.tsx 深度耦合
- **符合框架目标**：嵌入式 SDK
- **依赖关系**：依赖 O1（AppState 解耦）+ O2 部分（启动框架已搭建）

### O10: V10 验收标准定义和 CI 准备

- **优化重点**：定义 V10 的完成标准和验证方案
- **优化目标**：V10 完成后可明确回答"物理分离做了什么"
- **关键结果**：
  - KR1: 定义框架零 React 运行时的验证方法
  - KR2: 定义 initializeEngine 完整性的测试用例
  - KR3: 定义物理分离后 CLI 回归验证方案
- **预期收益**：清晰的质量门槛
- **对框架的影响**：无
- **符合框架目标**：质量保证
- **依赖关系**：无

---

## 四、优化点依赖关系

```
O1 (AppState React 解耦)      ← 最高优先级，无依赖
O3 (.tsx React 清理)           ← 无依赖，可与 O1 并行
O5 (目录归属决策)              ← 无依赖，纯分析
O6 (架构文档补充)              ← 无依赖，文档任务
O8 (state.ts 归属分析)         ← 无依赖，纯分析
O10 (验收标准定义)             ← 无依赖

O2 (initializeEngine 完善)     ← 依赖 O1
  │
  └──→ O9 (MCP 配置提取)       ← 依赖 O1 + O2
         │
         └──→ O4 (React 依赖移除) ← 依赖 O1 + O3
                │
                └──→ O7 (导入路径规范化) ← 依赖 O4 + O5
```

**建议执行顺序**：

1. **第一批（并行，低风险）**：O3 + O5 + O6 + O8 + O10
   - O3: task .tsx 重命名（5 分钟）
   - O5: 目录归属分析
   - O6: 文档补充
   - O8: state.ts 分析
   - O10: 验收标准

2. **第二批（核心，最高优先级）**：O1
   - AppState React 解耦 — 解锁 O2/O4/O9

3. **第三批（大工程）**：O2 + O9
   - initializeEngine 完善 — 最大工作量

4. **第四批（收尾）**：O4 + O7
   - React 依赖移除 + 导入路径规范化

---

## 五、与 V10 OKR 的映射

| 用户需求 | 对应优化点 | 备注 |
|---------|-----------|------|
| V10 物理分离切割 | O5 + O7 + O8 | 目录归属 + 导入规范化 + state.ts 分析 |
| initializeEngine 完善 | O2 + O9 | 启动提取 + MCP 配置提取 |
| AppState React 解耦 | O1 + O3 + O4 | 解耦 + 清理 + 依赖移除 |
| 架构文档全面补充 | O6 | 文档任务 |

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| AppState 解耦影响 CLI 117 个消费者 | 高 | AppState.tsx 保留 Provider 壳，CLI 消费者不修改 |
| MCP 配置提取复杂度（~680 行） | 高 | 分阶段提取，先接口后实现 |
| initializeEngine 与 main.tsx 同步维护 | 中 | 提取后 main.tsx 调用 initializeEngine，不重复维护 |
| state.ts 归属模糊 | 中 | 先分析后决策，不做不确定的迁移 |

---

## 七、后续行动建议

1. **O1 最先启动**：AppState 解耦是解锁 V10 全部后续工作的关键
2. **O3 立即执行**：4 个 task .tsx 重命名是零风险快速产出
3. **O5+O8 并行分析**：为物理切割准备决策数据
4. **O6 文档先行**：记录当前架构，代码变更后更新
5. **O2 分阶段推进**：先完成 TODO，再提取大块逻辑（设置、MCP）
6. **O9 最后攻坚**：MCP 配置是最复杂的提取，放在 O1+O2 之后
