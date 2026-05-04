# V7 任务计划：CLI 代码整体迁移到 claude-code-cli/

> 版本: v7
> 日期: 2026-04-26
> 状态: Phase 2 待用户确认

---

## 一、项目概述

将 `src/` 下的所有 CLI/TUI 代码整体迁移到独立的 `claude-code-cli/` 包中，使其成为 CLI 系统的入口点，通过相对路径引用 `claude-code/` 框架核心。

### 迁移范围

**迁出到 claude-code-cli/src/**（L4 TUI/CLI 层）：

| 模块 | 文件数 | 说明 |
|------|--------|------|
| migrations/ | 11 | CLI 启动配置迁移 |
| vim/ | 5 | Vim 输入模式状态机 |
| keybindings/ | 16 | 终端快捷键系统 |
| hooks/ | ~30 | React UI hooks |
| components/ | ~200+ | UI 组件库 |
| screens/ | 3+45 stubs | 终端页面（REPL/Doctor/Resume） |
| commands/ | ~400 | Slash 命令系统（60+ 子目录） |
| cli/ | 128 | CLI 传输/IO/headless 层 |
| main.tsx | 1 | CLI 入口（6971行） |
| 辅助文件 | ~10 | dialogLaunchers, interactiveHelpers, replLauncher 等 |

**保留在 src/**（L1-L3 框架核心）：

| 模块 | 说明 |
|------|------|
| engine/ | Agent Engine SDK（55文件） |
| QueryEngine.ts | 核心 agent loop |
| query.ts | LLM API 调用 |
| tools.ts + tools/ | 55+ 内置工具 |
| Tool.ts | 工具类型定义 |
| state/ | 应用状态管理 |
| services/ | API/MCP/Auth/Analytics 服务 |
| utils/ | 核心工具函数 |
| types/ | 核心类型定义 |
| context.ts | 上下文构建 |
| bootstrap/ | 引导状态 |

### 跨包引用机制

沿用 `claude_code_framework_e2e_cli/` 已验证的模式：**相对路径直接穿透源码**。

```typescript
// claude-code-cli/src/main.tsx 中引用框架核心：
import { query } from '../../src/query.js'
import { getTools } from '../../src/tools.js'
import { LogUtil } from '../../src/engine/log/index.js'
```

### Command 接口发现机制

```
src/types/command.ts     ← Command 类型定义（共享）
src/types/commandProvider.ts ← ICommandProvider 接口
src/QueryEngine.ts       ← 通过 ICommandProvider 发现命令
claude-code-cli/src/commands/        ← 命令实现（CLI 注册到 Provider）
```

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 需要的能力 |
|------|------|------|------------|
| **architect** | 1 | 迁移方案设计、代码审核、端到端验证 | 深度理解架构分层，能做设计决策 |
| **developer-a** | 1 | 基础设施搭建、接口抽象、框架侧修复 | 精通 TypeScript，理解 QueryEngine |
| **developer-b** | 1 | 文件迁移执行、CLI 侧 import 修复 | 熟悉 bun/tsconfig，大量文件操作 |

**协作方式**：
- architect 先输出设计文档，开发者按设计执行
- developer-a 负责框架核心侧改动（T2-T3, T5）
- developer-b 负责 CLI 侧改动（T4, T6）
- 两人协作完成入口配置（T7）
- architect 最终验证（T8）

---

## 三、阶段规划

| 阶段 | 目标 | 任务 | 预计完成标志 |
|------|------|------|-------------|
| Phase 1 | 设计与准备 | T1-T3 | 框架核心编译通过，接口抽象完成 |
| Phase 2 | 文件迁移与修复 | T4-T6 | 所有文件已迁移，import 路径已修复 |
| Phase 3 | 入口与验证 | T7-T8 | CLI 可启动，端到端验证通过 |

---

## 四、任务清单

### T1: 架构师 — 迁移设计文档

**目标**: 输出完整的迁移设计文档，指导开发者执行

**执行人**: architect

**依赖**: 无

**验收标准**:
1. 输出 `auto-upgrade/v7/03-migration-design.md` 设计文档，包含：
   - 跨包 import 路径规范（前缀约定，如 `../../src/`）
   - 文件归属判定清单（每个模块归到哪边）
   - Command 接口发现机制设计
   - 需要从 claude-code/ 新增的公共导出清单
   - CLI 入口点配置方案
2. 明确标注所有"边界模糊"文件的归属决策

---

### T2: 开发者A — claude-code-cli 包骨架 + 框架公共导出层

**目标**: 创建新包结构，建立跨包引用能力

**执行人**: developer-a

**依赖**: T1（需要设计文档）

**验收标准**:
1. `claude-code-cli/` 目录创建完成，包含：
   - `package.json`（name: `claude-code-cli`，scripts.start 指向 src/main.tsx）
   - `tsconfig.json`（配置 bun + JSX + moduleResolution: bundler）
   - `src/` 目录
2. `src/index.ts` 创建为框架公共导出层，导出 CLI 需要的所有 API：
   - query 函数、getTools、QueryEngine 类型
   - 状态管理（AppState, createStore, onChangeAppState）
   - 核心工具（context, config, messages, permissions）
   - 服务（MCP, analytics, API bootstrap）
   - engine/ 所有公共 API
3. 跨包 import 验证：在 claude-code-cli/src/test-import.ts 中成功 import 框架导出
4. `bun run claude-code-cli/src/test-import.ts` 无报错

---

### T3: 开发者A — Command 接口抽象 + QueryEngine 适配

**目标**: 将 Command 类型提取到 types/ 层，QueryEngine 通过接口发现命令

**执行人**: developer-a

**依赖**: T2

**验收标准**:
1. `src/types/command.ts` 包含：
   - `Command` 接口定义（从原 commands.ts 提取）
   - `CommandType` 类型（prompt/local/local-jsx）
2. `src/types/commandProvider.ts` 包含：
   - `ICommandProvider` 接口（getCommands, getSlashCommandToolSkills 等方法）
3. `src/commands.ts` 修改为：
   - 导入类型从 `types/command.ts`
   - 实现或接受 `ICommandProvider`
   - 命令注册逻辑改为可注入的
4. `src/QueryEngine.ts` 修改为：
   - 通过 `ICommandProvider` 获取命令列表
   - 不直接 import commands.ts 的具体实现
5. `engine/EngineState.ts` 和 `engine/bridge/OriginalQueryEngineBridge.ts` 的 `import type { Command }` 改为从 `types/command.ts` 导入
6. `tsc` 编译通过，现有测试不受影响

---

### T4: 开发者A+B — 整体文件迁移（git mv）

**目标**: 将所有 CLI 模块从 src/ 迁移到 claude-code-cli/src/

**执行人**: developer-a + developer-b（协作）

**依赖**: T3

**验收标准**:
1. 以下目录/文件已通过 `git mv` 迁移到 `claude-code-cli/src/`：
   ```
   src/migrations/     → claude-code-cli/src/migrations/
   src/vim/            → claude-code-cli/src/vim/
   src/keybindings/    → claude-code-cli/src/keybindings/
   src/hooks/          → claude-code-cli/src/hooks/
   src/components/     → claude-code-cli/src/components/
   src/screens/        → claude-code-cli/src/screens/
   src/commands/       → claude-code-cli/src/commands/
   src/cli/            → claude-code-cli/src/cli/
   src/main.tsx        → claude-code-cli/src/main.tsx
   ```
2. 辅助文件迁移：
   ```
   src/dialogLaunchers.tsx    → claude-code-cli/src/dialogLaunchers.tsx
   src/interactiveHelpers.tsx → claude-code-cli/src/interactiveHelpers.tsx
   src/replLauncher.tsx       → claude-code-cli/src/replLauncher.tsx
   src/setup.js               → claude-code-cli/src/setup.js
   src/history.js             → claude-code-cli/src/history.js
   src/cost-tracker.js        → claude-code-cli/src/cost-tracker.js
   src/constants/             → claude-code-cli/src/constants/
   ```
3. 每次迁移后确认文件在新位置存在、旧位置已不存在

**分工**:
- developer-a: migrations, vim, keybindings, main.tsx + 辅助文件
- developer-b: hooks, components, screens, commands, cli/

---

### T5: 开发者A — 框架核心 import 修复

**目标**: 修复 src/ 中对已迁移模块的残留引用

**执行人**: developer-a

**依赖**: T4

**验收标准**:
1. 搜索 src/ 中所有对已迁移模块的 import，全部清理或替换
2. 特别处理：
   - `commands.ts` 改为接口注册模式（不再直接 import commands/ 目录下的实现）
   - 确认 engine/ 零 CLI 模块引用（之前已验证只有 import type）
   - 确认 QueryEngine.ts 不再直接引用 commands/ 实现
3. `tsc` 编译通过（允许 claude-code-cli/ 的 import 报错，本任务只关注框架核心）
4. `lint:layers` 检查 L1/L2/L3 不引用 L4 模块

---

### T6: 开发者B — CLI 侧 import 路径修复

**目标**: 修复 claude-code-cli/src/ 中所有指向框架核心的 import 路径

**执行人**: developer-b

**依赖**: T4, T5

**验收标准**:
1. 所有 `from '../query.js'` 类引用改为 `from '../../src/query.js'`（或通过框架导出层 `from '../../src/index.js'`）
2. 修复范围：
   - `claude-code-cli/src/main.tsx`（~70 处 import 路径变更）
   - `claude-code-cli/src/screens/REPL.tsx`（~30 处）
   - `claude-code-cli/src/components/**/*.tsx`（~200 文件，每个 2-3 处）
   - `claude-code-cli/src/hooks/**/*.ts(x)`（~30 文件）
   - `claude-code-cli/src/commands/**/*.ts(x)`（~400 文件，每个 1-2 处）
   - `claude-code-cli/src/cli/**/*.ts`（~128 文件）
3. CLI 内部模块之间的 import 保持相对路径不变（如 components 引用 keybindings）
4. `tsc` 编译通过（整个项目）

**路径映射规则**（参考 e2e_cli 模式）:
```
原来: import { X } from '../query.js'
改为: import { X } from '../../src/query.js'

原来: import { X } from './components/Foo.js'
改为: 不变（同在 claude-code-cli/src/ 内）

原来: import { X } from '../engine/log/index.js'
改为: import { X } from '../../src/engine/log/index.js'
```

---

### T7: 开发者A+B — CLI 入口配置 + 命令注册 + 启动验证

**目标**: 配置 CLI 入口命令，注册命令到框架，验证可启动

**执行人**: developer-a + developer-b

**依赖**: T6

**验收标准**:
1. `claude-code-cli/package.json` 配置正确的入口：
   ```json
   {
     "scripts": {
       "start": "bun run src/main.tsx",
       "dev": "bun run --watch src/main.tsx"
     }
   }
   ```
2. main.tsx 中添加命令注册逻辑：
   - CLI 启动时，将 commands/ 下的命令注册到框架的 CommandProvider
   - QueryEngine 通过 CommandProvider 获取 slash command skills
3. `bun run start`（在 claude-code-cli/ 目录下）能启动 CLI
4. 基本功能验证：
   - CLI 显示欢迎界面
   - 可以输入并执行查询
   - `/help` 命令可用
   - `--print` 模式可用（headless）

---

### T8: 架构师 — 端到端验证 + 文档更新

**目标**: 全面验证迁移结果，更新架构文档

**执行人**: architect

**依赖**: T7

**验收标准**:
1. 编译验证：
   - `tsc` 全项目零错误
   - `lint:layers` L1/L2/L3 零违规
2. 功能验证：
   - 交互式 REPL 模式正常启动和使用
   - `--print` headless 模式正常工作
   - `/compact`, `/clear` 等核心命令正常
   - MCP 工具加载正常
   - 工具权限系统正常
3. 架构验证：
   - `src/` 不包含任何 CLI/UI 模块
   - `src/engine/` 零 CLI 依赖
   - 跨包 import 路径规范一致
4. 文档更新：
   - `docs/architecture-design.md` 反映新的包结构
   - `docs/architecture-layering-standard.md` 更新目录映射
   - `CLAUDE.md` 更新关键目录说明

---

## 五、依赖关系

```
T1 (架构设计)
 │
 └──→ T2 (包骨架 + 导出层)
       │
       └──→ T3 (接口抽象 + QueryEngine 适配)
             │
             ├──→ T4 (文件迁移) ──→ T5 (框架侧修复)
             │                         │
             │                         └──→ T6 (CLI 侧 import 修复)
             │                                   │
             │                                   └──→ T7 (入口配置 + 启动验证)
             │                                         │
             │                                         └──→ T8 (端到端验证)
             └──────────────────────────────────────────────┘
```

**可并行的任务**:
- T4 中 developer-a 和 developer-b 可并行迁移不同模块
- T5 和 T6 可并行（框架侧和 CLI 侧互不干扰）

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Import 路径遗漏导致编译失败 | 高 | 每个任务后 tsc 验证 |
| QueryEngine 适配引入 bug | 高 | 保持最小改动，用接口包裹不替换 |
| CLI 启动失败 | 高 | T7 专门做启动验证 |
| 循环依赖 | 中 | architect 在 T1 中预先识别 |
| 包含 UI 依赖的"边界模糊"文件归属不清 | 中 | T1 中明确判定所有边界文件 |
| 文件量大导致迁移耗时长 | 中 | git mv + 批量 sed 替换 import 路径 |
