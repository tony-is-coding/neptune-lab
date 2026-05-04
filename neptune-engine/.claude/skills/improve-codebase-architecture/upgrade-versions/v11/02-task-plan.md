# V11 任务计划

> 创建时间：2026-04-28
> 基于文档：auto-upgrade/v11/01-optimizer-research.md
> 覆盖范围：OKR 路线图 V1-V5 全部 15 个优化点

---

## 一、项目概述

将 OKR 路线图 V1-V5 的 15 个架构优化点转化为 18 个可执行任务，分 5 个阶段交付。每个任务有明确的文件范围、验证标准和依赖关系。

**执行策略**：3 名开发者并行推进，架构师审核把关，分阶段验收。

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 能力要求 |
|------|------|------|---------|
| team-lead | 1 | 协调任务分配、进度管理、合并决策 | 全局视野、风险判断 |
| architect | 1 | 架构设计审核、代码 review、分层规范把控 | 精通 engine/ 架构、"包装不替代"原则 |
| developer-1 | 1 | V1 CLI 外化 + V2 穿透清理 | 熟悉 CLI/SDK 边界、TypeScript 重构 |
| developer-2 | 1 | V2 工具注册 + V3 Provider 整合 | 熟悉 services/api/、LLM 调用链 |
| developer-3 | 1 | V3 存储 + V4 生产加固 | 熟悉 engine/storage/、日志系统、权限系统 |

**协作方式**：
- architect 审核 developer 的 PR，重点关注分层违规和"包装不替代"原则
- developer 之间通过 task 依赖关系协调，不直接修改他人负责的文件
- team-lead 负责合并和冲突解决

---

## 三、任务阶段规划

### 阶段 A：V1 CLI 外化（4 个任务）

**小目标**：SDK 目录干净，SDK 和 CLI 各自可构建

| 任务 | 执行人 | 并行度 | 预计影响文件 |
|------|--------|--------|-------------|
| T1 CLI 零引用代码迁出 | developer-1 | 独立 | ~10 文件迁出 |
| T2 CLI 条件代码迁出 | developer-1 | 独立 | ~6 文件迁出 |
| T3 figures.ts 边界拆分 | developer-1 | T1,T2后 | ~15 文件变更 |
| T4 SDK 独立构建入口 | architect | T3后 | ~5 文件新增/修改 |

**门禁**：SDK `tsc` 零错误，CLI 全功能回归通过

### 阶段 B：V2 分层治理（5 个任务）

**小目标**：engine/ 零穿透，工具可插拔，外部可引用

| 任务 | 执行人 | 并行度 | 预计影响文件 |
|------|--------|--------|-------------|
| T5 engine/ type import 穿透清理 | developer-1 | 独立 | ~8 文件 |
| T6 engine/ value import 清理 | developer-1 | T5后 | ~7 文件 |
| T7 lint:layers 穿透检查扩展 | developer-3 | 独立 | 1 文件 |
| T8 工具注册可插拔化 | developer-2 | T6后 | ~5 文件 |
| T9 workspace 声明式依赖 | developer-2 | T4后 | ~3 文件 |

**门禁**：lint:layers 零违规，e2e_cli 通过 workspace 引用跑通

### 阶段 C：V3 能力补齐（4 个任务）

**小目标**：Provider 可用，上下文卸载，Backend 抽象

| 任务 | 执行人 | 并行度 | 预计影响文件 |
|------|--------|--------|-------------|
| T10 Provider firstParty 适配 | developer-2 | T6后 | ~4 文件 |
| T11 Provider 其他 6 个适配 | developer-2 | T10后 | ~8 文件 |
| T12 上下文卸载机制 | developer-1 | 独立 | ~5 文件 |
| T13 通用 Backend 抽象 | developer-3 | 独立 | ~6 文件 |

**门禁**：Provider 切换验证通过，卸载 token 下降可测量

### 阶段 D：V4 生产加固（3 个任务）

**小目标**：日志可聚合，权限可审计，并发安全

| 任务 | 执行人 | 并行度 | 预计影响文件 |
|------|--------|--------|-------------|
| T14 日志 JSON + MDC | developer-3 | 独立 | ~4 文件 |
| T15 RBAC 权限策略 + 审计 | developer-3 | T14后 | ~4 文件 |
| T16 并发安全 | developer-1 | T13后 | ~4 文件 |

**门禁**：日志 JSON schema 验证通过，压力测试无泄漏

### 阶段 E：V5 交付验收（2 个任务）

**小目标**：文档完备，验收通过

| 任务 | 执行人 | 并行度 | 预计影响文件 |
|------|--------|--------|-------------|
| T17 API 文档 + 示例 | developer-2 | 阶段C后 | ~10 文件 |
| T18 回归测试 + 配置校验 | developer-1 | 阶段D后 | ~8 文件 |

**门禁**：API 文档 100% 覆盖，CI 全绿

---

## 四、任务清单

### T1：CLI 零引用代码迁出

| 属性 | 内容 |
|------|------|
| **任务目标** | 将 SDK 中零导入者的 CLI 专属文件迁出 |
| **执行人** | developer-1 |
| **依赖** | 无 |
| **对应优化** | 优化 2（CLI 专属代码迁出） |
| **OKR 版本** | V1 |

**具体操作**：

1. 迁出以下文件到 `claude-code-cli/src/utils/`（或标记为 CLI-only）：
   - `src/utils/keyboardShortcuts.ts`（14 行，零导入者）
   - `src/utils/terminalPanel.ts`（195 行，零导入者）
   - `src/utils/suggestions/` 目录（6 文件，1224 行，零导入者）
   - `src/utils/promptEditor.ts`（188 行，零导入者）
2. 在 `src/utils/` 对应位置不保留任何残余
3. 验证 `tsc` 通过

**验证标准**：
- `bunx tsc --noEmit` 零错误
- `grep -r 'keyboardShortcuts\|terminalPanel\|promptEditor\|suggestions/' src/` 仅在 CLI 层有结果
- `bun test` 全部通过（2453+ tests）

---

### T2：CLI 条件代码迁出

| 属性 | 内容 |
|------|------|
| **任务目标** | 将仅有 CLI 导入者的文件迁出，处理残留引用 |
| **执行人** | developer-1 |
| **依赖** | 无（可与 T1 并行） |
| **对应优化** | 优化 2（CLI 专属代码迁出） |
| **OKR 版本** | V1 |

**具体操作**：

1. 迁出以下文件：
   - `src/utils/status.tsx`（493 行，1 导入者：doctorContextWarnings.ts）
   - `src/utils/statusNoticeDefinitions.tsx`（265 行，1 导入者：doctorContextWarnings.ts）
   - `src/constants/spinnerVerbs.ts`（204 行，1 导入者：spawnInProcess.ts）
   - `src/constants/turnCompletionVerbs.ts`（12 行，1 导入者：spawnInProcess.ts）
2. 处理残留引用：
   - `doctorContextWarnings.ts`：提取 status.tsx 中 doctorContextWarnings 需要的纯逻辑部分到 `src/utils/statusNoticeHelpers.ts`（已有，20 行纯逻辑）
   - `spawnInProcess.ts`：将 spinnerVerbs/turnCompletionVerbs 的内联引用改为从 CLI 目录导入
3. 验证 `tsc` 通过

**验证标准**：
- `bunx tsc --noEmit` 零错误
- SDK 层（engine/、services/、utils/ 核心）不再 import status.tsx、statusNoticeDefinitions.tsx
- `bun test` 全部通过

---

### T3：figures.ts 边界拆分

| 属性 | 内容 |
|------|------|
| **任务目标** | 将 figures.ts 拆分为 SDK 核心常量 + CLI 专属常量 |
| **执行人** | developer-1 |
| **依赖** | T1, T2 完成（确保 CLI 文件已迁出，边界清晰） |
| **对应优化** | 优化 3（figures.ts 边界拆分） |
| **OKR 版本** | V1 |

**具体操作**：

1. 分析 `src/constants/figures.ts`（45 行）的所有导出，分类：
   - **SDK 核心**：LIGHTNING_BOLT、PAUSE_ICON、BLOCKQUOTE_BAR、WARNING_ICON、CHECKMARK 等 SDK 逻辑中使用的常量
   - **CLI 专属**：动画帧、spinner chars、UI 装饰等仅终端显示使用的常量
2. 创建 `src/constants/figures-core.ts`：只包含 SDK 核心常量
3. 修改 `src/constants/figures.ts`：从 `figures-core.ts` re-export + 增加导出 CLI 专属常量（保持向后兼容）
4. 更新 13+ 引用文件：SDK 核心文件改为引用 `figures-core.ts`
5. 验证 tsc 通过

**验证标准**：
- `bunx tsc --noEmit` 零错误
- SDK 核心文件（PermissionMode.ts、model.ts、markdown.ts）只引用 figures-core.ts
- CLI 文件可继续从 figures.ts 获取完整常量
- `bun test` 全部通过

---

### T4：SDK 独立构建入口

| 属性 | 内容 |
|------|------|
| **任务目标** | 创建 SDK 专用构建配置，SDK 和 CLI 各自可独立构建 |
| **执行人** | architect |
| **依赖** | T3 完成（SDK 目录干净后才能独立构建） |
| **对应优化** | 优化 4（独立 SDK 构建入口） |
| **OKR 版本** | V1 |

**具体操作**：

1. 审查 `src/index.ts`（150 行），确认全部 ~70 公共导出覆盖完整
2. 创建 `claude-code/tsconfig.sdk.json`：exclude CLI 专属文件（.tsx、terminal/ink 相关）
3. 在 `claude-code/package.json` 增加 SDK 构建脚本：`"build:sdk": "bunx tsc -p tsconfig.sdk.json"`
4. 验证 SDK `tsc` 零错误
5. 确认 CLI 仍通过 `bun run build` 正常构建

**验证标准**：
- `bunx tsc -p tsconfig.sdk.json` 零错误
- `bun run build` CLI 构建正常
- SDK 构建产物不包含 React/Ink 依赖
- `bun test` 全部通过

---

### T5：engine/ type import 穿透清理

| 属性 | 内容 |
|------|------|
| **任务目标** | 将 engine/ 中 ~40 处 type import 穿透改为本地类型声明或类型下沉 |
| **执行人** | developer-1 |
| **依赖** | 阶段 A 完成（V1 CLI 外化完成后目录结构清晰） |
| **对应优化** | 优化 1（穿透依赖清理） — type import 部分 |
| **OKR 版本** | V2 |

**具体操作**：

1. **src/types/ 穿透（16 处）**：
   - 将 engine/ 需要的类型（ids.ts、message.ts、permissions.ts、command.ts、plugin.ts）重新导出到 `engine/types/` 声明文件
   - engine/ 文件改为从 `engine/types/` 导入

2. **src/Tool.ts 穿透（10 处，type import 部分）**：
   - 将 Tool、ToolPermissionContext、Tools 类型定义复制或重新导出到 `engine/types/toolTypes.ts`（已存在！）
   - engine/ 文件改为从 `engine/types/toolTypes.ts` 导入

3. **src/services/mcp/types.js 穿透（2 处）**：
   - 将 MCP 类型重新导出到 `engine/types/`

4. **src/entrypoints/agentSdkTypes.js 穿透（1 处）**：
   - 将 ModelUsage 类型移到 `engine/types/`

**关键文件**：
- `engine/EngineState.ts`（12 处穿透 → 改为从 engine/types/ 导入）
- `engine/types/CoreAppState.ts`（9 处穿透）
- `engine/session/SessionContext.ts`（4 处穿透）
- `engine/session/TokenBudgetManager.ts`（1 处穿透）
- `engine/tools/ToolAdapter.ts`（1 处穿透）

**验证标准**：
- engine/ 中 type import 穿透从 ~40 处降至 0
- `bunx tsc --noEmit` 零错误
- `bun test` 全部通过

---

### T6：engine/ value import + 动态 require 清理

| 属性 | 内容 |
|------|------|
| **任务目标** | 将 engine/ 中 ~20 处 value import 和 12 处动态 require 改为接口注入 |
| **执行人** | developer-1 |
| **依赖** | T5 完成（type import 先清理，避免混杂） |
| **对应优化** | 优化 1（穿透依赖清理） — value import 部分 |
| **OKR 版本** | V2 |

**具体操作**：

1. **initializeEngine.ts（7 处穿透，含 value import）**：
   - `import { getTools } from '../../tools.js'` → 通过 ToolRegistry 接口注入
   - `import { getModel } from '../../utils/model/model.js'` → 通过配置参数传入
   - 其他 value import → 通过构造函数参数注入

2. **DefaultCCRuntime.ts（7 处穿透，6 个动态 require）**：
   - `require('../../tools.js')` → CCRuntime 接口新增 `getTools()` 方法
   - `require('../../utils/config.js')` → CCRuntime 接口新增 `getConfig()` 方法
   - `require('../../bootstrap/state.js')` → CCRuntime 接口新增 `getState()` 方法
   - `require('../../QueryEngine.js')` → CCRuntime 接口新增 `createQueryEngine()` 方法
   - `require('../../utils/sessionStorage.js')` → 通过参数注入
   - `require('../../utils/cwd.js')` → CCRuntime 接口新增 `getCwd()` 方法

3. **OriginalQueryEngineBridge.ts（7 处穿透）**：
   - `import { fileStateCache } from '../../utils/fileStateCache.js'` → 构造函数参数注入
   - `import { hasPermissionsToUseTool } from '../../utils/permissions/permissions.js'` → 通过 PermissionDelegate 注入
   - 其他 → 通过构造函数参数注入

4. **CoreAppState.ts（2 处动态 require）**：
   - `require('../../Tool.js')` → 使用 engine/types/toolTypes.ts 的类型 + 注入默认值
   - `require('../../utils/commitAttribution.js')` → 通过工厂函数注入

5. **HookCore.ts（1 处动态 require）**：
   - `require('../../utils/hooks.js')` → 通过 HookCore 构造函数注入

**验证标准**：
- engine/ 零 `import from '../../根文件'`（86 处 → 0）
- `bunx tsc --noEmit` 零错误
- e2e_cli 端到端功能正常
- `bun test` 全部通过

---

### T7：lint:layers 穿透检查扩展

| 属性 | 内容 |
|------|------|
| **任务目标** | 扩展 lint-layers.sh 检查 engine/ 向上穿透到 src/ 根的问题 |
| **执行人** | developer-3 |
| **依赖** | 无（可与 T5、T6 并行） |
| **对应优化** | 优化 5（lint:layers 扩展） |
| **OKR 版本** | V2 |

**具体操作**：

1. 修改 `claude-code/scripts/lint-layers.sh`（54 行），增加穿透检查：
   - 检查 `engine/` 文件中 `from '../Tool`、`from '../QueryEngine`、`from '../tools` 的 import（P0 级）
   - 检查 `engine/` 文件中 `from '../../utils`、`from '../../services` 的 import（P1 级）
   - 检查 `engine/` 文件中 `from '../../types` 的 import（P2 级 — 暂时 warn 不 fail）
   - 检查 `engine/` 文件中 `require('../../` 的动态加载（P0 级）

2. 分级输出：
   - P0（value import/动态 require）：ERROR 级别，阻塞 CI
   - P1（utils/services 穿透）：WARN 级别
   - P2（type import）：INFO 级别（允许 engine/types/ 下面的重新导出文件）

3. 添加到 CI（如 package.json 的 lint 脚本）

**验证标准**：
- `bash claude-code/scripts/lint-layers.sh` 输出 P0/P1/P2 分级报告
- 当前 engine/ 的穿透引用被正确识别
- CI 集成后，PR 会自动检查

---

### T8：工具注册可插拔化

| 属性 | 内容 |
|------|------|
| **任务目标** | 定义 ToolRegistry 接口，tools.ts 支持按需加载工具组 |
| **执行人** | developer-2 |
| **依赖** | T6 完成（initializeEngine 不再直接 import tools.js） |
| **对应优化** | 优化 6（工具注册可插拔化） |
| **OKR 版本** | V2 |

**具体操作**：

1. 定义 `engine/tools/ToolRegistry.ts`：
   ```typescript
   interface ToolRegistry {
     registerToolSet(name: string, tools: Tool[]): void
     getTools(): Tool[]
     filterTools(predicate: (tool: Tool) => boolean): Tool[]
   }
   ```

2. 创建 `engine/tools/DefaultToolRegistry.ts`：
   - 默认加载 core tools（~20 个无条件工具：AgentTool, BashTool, FileEditTool, FileReadTool, FileWriteTool, GlobTool, GrepTool, WebFetchTool, WebSearchTool, TodoWriteTool 等）
   - 按需加载 builtin-tools（35+ 条件工具，通过 registerToolSet 注册）

3. 修改 `src/tools.ts`：支持从 ToolRegistry 获取工具列表
4. 修改 `engine/bootstrap/initializeEngine.ts`：通过 ToolRegistry 注入工具

**验证标准**：
- SDK 模式下只加载 core tools（工具数 < 25）
- CLI 模式下加载全部 55+ 工具（行为不变）
- `bunx tsc --noEmit` 零错误
- `bun test` 全部通过

---

### T9：workspace 声明式依赖

| 属性 | 内容 |
|------|------|
| **任务目标** | e2e_cli 通过 workspace:* 声明式依赖 claude-code |
| **执行人** | developer-2 |
| **依赖** | T4 完成（SDK 构建入口就绪） |
| **对应优化** | 优化 7（workspace 声明式依赖） |
| **OKR 版本** | V2 |

**具体操作**：

1. 修改 `claude_code_framework_e2e_cli/package.json`：
   - 添加 `"claude-code-best": "workspace:*"` 依赖
   - 移除 tsconfig.json 中的手动 paths 映射（改用包入口）

2. 审查 `src/index.ts`（150 行）：
   - 确认全部 ~70 公共 API 通过此入口导出
   - 补充缺失的导出

3. 更新 e2e_cli 引用方式：
   - `from 'claude-code-best/engine/AgentEngine.js'` → `from 'claude-code-best/engine/AgentEngine.js'`（保持子路径导出）
   - 或统一改为 `from 'claude-code-best'`（使用主入口）

4. 验证从零开始引用可行

**验证标准**：
- `cd claude_code_framework_e2e_cli && bun install` 正常解析 workspace 依赖
- e2e_cli 端到端功能正常
- `bunx tsc --noEmit` 在 e2e_cli 目录零错误

---

### T10：Provider firstParty 适配

| 属性 | 内容 |
|------|------|
| **任务目标** | AnthropicProvider 包装 queryModelWithStreaming()，实现真实 LLM 调用 |
| **执行人** | developer-2 |
| **依赖** | T6 完成（engine 穿透清理后 Provider 更独立） |
| **对应优化** | 优化 8（Provider 整合） — firstParty 部分 |
| **OKR 版本** | V3 |

**具体操作**：

1. 修改 `engine/provider/adapters/AnthropicProvider.ts`：
   - 删除 `throw Error`，实现 `query()` 方法
   - 包装 `src/services/api/claude.ts` 的 `queryModelWithStreaming()`
   - 保持 AsyncGenerator<ProviderMessage> 接口

2. 处理认证和配置：
   - 从 ProviderConfig 获取 apiKey、baseUrl
   - 映射到 `getAnthropicClient()` 的参数

3. 处理流式输出：
   - 将 Anthropic SDK 的流事件转换为 ProviderMessage
   - text_delta → { type: 'text', content }
   - tool_use → { type: 'tool_use', content }

4. 端到端验证：通过 AnthropicProvider 发起一次真实 LLM 调用

**验证标准**：
- `new AnthropicProvider(config).query(params)` 返回有效的 AsyncGenerator
- 流式输出正常（text + tool_use 事件）
- Token 统计正确
- 不修改 services/api/ 中的任何原始代码

---

### T11：Provider 其他 6 个适配

| 属性 | 内容 |
|------|------|
| **任务目标** | 为 OpenAI/Gemini/Grok/Bedrock/Vertex/Foundry 各实现 ProviderAdapter |
| **执行人** | developer-2 |
| **依赖** | T10 完成（firstParty 适配验证端到端链路） |
| **对应优化** | 优化 8（Provider 整合） — 其他 Provider |
| **OKR 版本** | V3 |

**具体操作**：

1. **OpenAI/Gemini/Grok**（3 个 adapter）：
   - 各包装 `src/services/api/openai/index.ts`、`gemini/index.ts`、`grok/index.ts` 中的 `queryModel*()` 函数
   - 复用各自的 convertMessages + convertTools + streamAdapter

2. **Bedrock/Vertex/Foundry**（3 个 adapter）：
   - 共享 firstParty 的 `queryModelWithStreaming()`，区别仅在 `getAnthropicClient()` 的 SDK constructor
   - 通过 ProviderConfig 传入不同的认证参数

3. 更新 `engine/provider/ProviderRegistry.ts`：
   - 默认注册 7 个 provider
   - 按配置选择（provider.type 或环境变量）

4. 每个适配器编写单元测试

**验证标准**：
- `ProviderRegistry.get('anthropic')` / `get('openai')` / `get('bedrock')` 等均返回有效 adapter
- 至少 1 个非 firstParty adapter 端到端调用成功
- 不修改 services/api/ 中的任何原始代码

---

### T12：上下文卸载机制

| 属性 | 内容 |
|------|------|
| **任务目标** | 大块工具输出自动写入临时文件，context 只保留摘要 + 文件路径 |
| **执行人** | developer-1 |
| **依赖** | 无严格前置依赖 |
| **对应优化** | 优化 9（上下文卸载机制） |
| **OKR 版本** | V3 |

**具体操作**：

1. 定义 `engine/context/OffloadStrategy.ts`：
   ```typescript
   interface OffloadStrategy {
     shouldOffload(toolName: string, outputLength: number, tokenCount: number): boolean
     offload(sessionId: string, toolName: string, output: string): Promise<{ filePath: string; summary: string }>
   }
   ```

2. 扩展 `src/utils/task/diskOutput.ts` 的 DiskTaskOutput：
   - 增加 `writeOffload(sessionId, key, content)` 方法
   - 增加阈值判断（默认 10K tokens）
   - 生成摘要：前 N 行 + 文件路径 + token 数

3. 在 `services/compact/microCompact.ts` 中集成：
   - compact 前先检查是否有可卸载的大块工具输出
   - 卸载后替换为摘要引用

4. 配置接口：AgentEngineConfig 增加 `offloadThreshold` 参数

**验证标准**：
- 工具输出超过阈值时自动写入磁盘
- context 中只保留摘要 + 文件路径
- Token 使用量下降可测量（对比测试）
- `bunx tsc --noEmit` 零错误

---

### T13：通用 Backend 抽象 + FilesystemBackend

| 属性 | 内容 |
|------|------|
| **任务目标** | 定义通用 IBackend 接口，实现 FilesystemBackend |
| **执行人** | developer-3 |
| **依赖** | 无严格前置依赖 |
| **对应优化** | 优化 10（通用 Backend 抽象） |
| **OKR 版本** | V3 |

**具体操作**：

1. 创建 `engine/storage/IBackend.ts`：
   ```typescript
   interface IBackend<T> {
     read(key: string): Promise<T | null>
     write(key: string, value: T): Promise<void>
     delete(key: string): Promise<void>
     list(prefix?: string): Promise<T[]>
     dispose(): Promise<void>
   }
   ```

2. 创建 `engine/storage/FilesystemBackend.ts`：
   - 基于文件系统，每个 key 一个 JSON 文件
   - 实现全部 IBackend<T> 方法
   - 包含文件锁和原子写入

3. 重构 `ISessionStore` 为 `IBackend<Session>` 上层：
   - `InMemorySessionStore` → 委托给 `InMemoryBackend`
   - `SQLiteSessionStore` → 委托给 `SQLiteBackend`

4. 创建 `engine/storage/CompositeBackend.ts`：
   - 按路径前缀路由到不同后端

5. 更新 `engine/storage/index.ts` 导出

**验证标准**：
- `new FilesystemBackend(dir)` 的 read/write/delete/list 正常工作
- SessionStore 可通过 IBackend 接口操作
- dispose() 正确释放资源
- `bunx tsc --noEmit` 零错误

---

### T14：日志 JSON + MDC

| 属性 | 内容 |
|------|------|
| **任务目标** | 实现 JsonLogFormatter，MDC 自动注入 sessionId |
| **执行人** | developer-3 |
| **依赖** | 无 |
| **对应优化** | 优化 11（日志 JSON + MDC） |
| **OKR 版本** | V4 |

**具体操作**：

1. 创建 `engine/log/JsonLogFormatter.ts`：
   - 实现 `LogFormatter` 接口
   - `format(record: LogRecord): string` → JSON.stringify(record)
   - 输出字段：level, timestamp, message, loggerName, callSite, attrs, mdc

2. 创建 `engine/log/MDC.ts`：
   - 基于 `AsyncLocalStorage` 实现
   - `MDC.set(key, value)` / `MDC.get(key)` / `MDC.clear()`
   - 自动在 LogRecord 中注入 sessionId、requestId

3. 修改 `engine/log/LogUtil.ts`：
   - `log()` 方法自动从 MDC 读取上下文
   - 将 MDC 字段合并到 LogRecord.attrs

4. 更新 `engine/log/FileLogStore.ts`：
   - 支持选择 formatter（JSON 或文本）
   - 默认保持文本，可通过配置切换

5. 更新 `engine/log/index.ts` 导出

**验证标准**：
- `new JsonLogFormatter().format(record)` 输出合法 JSON
- MDC 自动注入当前 sessionId
- 多 Session 并行时日志按 sessionId 可区分
- `bunx tsc --noEmit` 零错误

---

### T15：RBAC 权限策略 + 审计

| 属性 | 内容 |
|------|------|
| **任务目标** | 实现 RBACPermissionDelegate 和 AuditPermissionDelegate |
| **执行人** | developer-3 |
| **依赖** | T14 完成（审计日志需要 JSON 日志支持） |
| **对应优化** | 优化 12（RBAC 权限策略 + 审计） |
| **OKR 版本** | V4 |

**具体操作**：

1. 创建 `engine/permissions/RBACPermissionDelegate.ts`：
   ```typescript
   interface RolePermissionMap {
     [role: string]: {
       allow: string[]   // 允许的工具名模式
       deny: string[]    // 拒绝的工具名模式
     }
   }
   ```
   - 构造函数接收 RolePermissionMap
   - `onToolAccess()` 根据当前角色查表决策

2. 创建 `engine/permissions/AuditPermissionDelegate.ts`：
   - 装饰器模式，包装另一个 PermissionDelegate
   - 记录每次权限决策到日志（工具名、输入摘要、决策结果、决策原因）
   - 使用 LogUtil 的 child logger（名称链：engine:permissions:audit）

3. 更新 `engine/permissions/index.ts` 导出

**验证标准**：
- `new RBACPermissionDelegate(map)` 可正确映射角色到工具权限
- `new AuditPermissionDelegate(delegate)` 可记录审计日志
- 审计日志包含工具名、决策、时间戳
- 不修改 ReadOnlyPermissionDelegate 的行为
- `bunx tsc --noEmit` 零错误

---

### T16：并发安全

| 属性 | 内容 |
|------|------|
| **任务目标** | SessionManager GC、EventBus TTL、资源回收 |
| **执行人** | developer-1 |
| **依赖** | T13 完成（Backend dispose 与 ISessionStore dispose 协调） |
| **对应优化** | 优化 13（并发安全） |
| **OKR 版本** | V4 |

**具体操作**：

1. **SessionManager GC**：
   - 修改 `engine/SessionManager.ts`：
   - 增加 `gcInterval` 配置（默认 60s）
   - 定期扫描 destroyed Session 并从 Map 中移除
   - 同步清理 tokenBudgetStates
   - 增加 `dispose()` 方法（停止 GC 定时器）

2. **EventBus TTL**：
   - 修改 `engine/events/EventBus.ts`：
   - `on()` 方法增加可选 `ttl` 参数（毫秒）
   - 内部定时器到期后自动 unsubscribe
   - Session 销毁时清理该 Session 注册的所有监听器

3. **ISessionStore dispose**：
   - 在 `ISessionStore` 接口增加 `dispose(): Promise<void>`
   - `SQLiteSessionStore.dispose()` 关闭数据库连接
   - `InMemorySessionStore.dispose()` 清空 Map

**验证标准**：
- SessionManager 销毁 100 个 Session 后，Map 大小回到 0
- EventBus TTL 到期后监听器自动移除
- SQLite 连接在 dispose 后不再持有文件锁
- `bunx tsc --noEmit` 零错误

---

### T17：API 文档 + 示例

| 属性 | 内容 |
|------|------|
| **任务目标** | TSDoc 覆盖全部公共 API + 快速开始指南 + 3 种场景示例 |
| **执行人** | developer-2 |
| **依赖** | 阶段 C 完成（API 稳定后再写文档） |
| **对应优化** | 优化 14（API 文档 + 示例） |
| **OKR 版本** | V5 |

**具体操作**：

1. **TSDoc 注释**：
   - `engine/AgentEngine.ts`：为 create/query/on/destroy/createSession/loadSession 补充 @param @returns @example
   - `engine/EngineFacade.ts`：为公共方法补充注释
   - `engine/SessionManager.ts`：为 createSession/destroySession/listSessions 补充注释
   - `engine/events/EventBus.ts`：为 on/emit/off 补充注释
   - `engine/bootstrap/engineHelpers.ts`：为 loadEngineSettings 补充注释
   - 目标：全部 ~70 公共导出有注释

2. **快速开始指南**：
   - 创建 `docs/quick-start.md`
   - 内容：安装 → 配置 → 第一个 Agent 交互 → 自定义工具 → 权限配置
   - 目标：新用户 30 分钟可跑通

3. **3 种场景示例**：
   - `examples/embedded-sdk/`：Express 中嵌入 AgentEngine
   - `examples/web-service/`：SSE/WebSocket 流式 Agent 服务
   - `examples/cli-tool/`：基于 SDK 构建自定义 CLI

**验证标准**：
- `grep -c '@param\|@returns\|@example' engine/` 覆盖 ~70 个公共方法
- 快速开始指南可从零跑通
- 3 个示例各自可独立运行

---

### T18：回归测试 + 配置校验

| 属性 | 内容 |
|------|------|
| **任务目标** | 核心类单元测试 + 启动配置校验 + CI 集成 |
| **执行人** | developer-1 |
| **依赖** | 阶段 D 完成 |
| **对应优化** | 优化 15（回归测试 + 配置校验） |
| **OKR 版本** | V5 |

**具体操作**：

1. **核心类单元测试**（使用 MockCCRuntime，不依赖真实 API）：
   - `engine/__tests__/AgentEngine.test.ts`：create/destroy/createSession 生命周期
   - `engine/__tests__/EngineFacade.test.ts`：query 提交、事件发射
   - `engine/__tests__/SessionManager.test.ts`：创建/销毁/并发限制
   - `engine/__tests__/EventBus.test.ts`：on/emit/off/TTL

2. **配置校验**：
   - 在 `engine/AgentEngine.ts` 的 `create()` 中调用已有的 `validateEngineConfig()`
   - 增加 LLM 配置校验：apiKey/baseUrl/model 缺失时明确报错
   - 错误信息包含配置项名称和建议修复方式

3. **CI 集成**：
   - 确保 `bun test`、`bunx tsc --noEmit`、`bash scripts/lint-layers.sh` 全部通过

**验证标准**：
- `bun test` 通过全部新增测试
- `AgentEngine.create({})` 缺少必要配置时报错且信息清晰
- `bunx tsc --noEmit` 零错误
- lint:layers 零违规

---

## 五、任务依赖关系图

```
阶段A (V1 CLI外化):
T1 ──┐
T2 ──┼──→ T3 ──→ T4
     │
阶段B (V2 分层治理):
T5 ──→ T6 ──→ T8
              T4 ──→ T9
T7 (独立)
     │
阶段C (V3 能力补齐):
T6 ──→ T10 ──→ T11
T12 (独立)
T13 (独立)
     │
阶段D (V4 生产加固):
T14 ──→ T15
T13 ──→ T16
     │
阶段E (V5 交付验收):
阶段C后 ──→ T17
阶段D后 ──→ T18
```

**关键路径**：T1→T3→T4→T9→T17（最长链路：CLI 外化→构建→workspace→文档）

**并行机会**：
- T1 ‖ T2（CLI 迁出并行）
- T5 ‖ T7（穿透清理 ‖ lint 扩展）
- T10 ‖ T12 ‖ T13（Provider ‖ 卸载 ‖ Backend）
- T14 ‖ T16（日志 ‖ 并发安全）
- T17 ‖ T18（文档 ‖ 测试）

---

## 六、风险与缓解

| 风险 | 影响任务 | 缓解措施 |
|------|---------|---------|
| CLI 迁出后 e2e_cli 功能异常 | T1, T2 | 每个 T 完成后立即验证 bun test |
| 穿透清理引入运行时错误 | T5, T6 | 先清理 type import（零运行时影响），再清理 value import |
| figures.ts 拆分遗漏 CLI 依赖 | T3 | 先全量 grep 引用，再拆分 |
| Provider 适配流式输出不一致 | T10, T11 | firstParty 先验证，作为其他 adapter 的参考实现 |
| 工具可插拔影响 prompt cache | T8 | 保持 core tools 顺序不变，builtin-tools 追加 |
| 并发 GC 误清理活跃 Session | T16 | GC 只清理 destroyed 状态的 Session |
