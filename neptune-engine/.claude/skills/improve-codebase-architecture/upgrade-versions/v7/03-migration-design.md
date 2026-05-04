# V7 迁移设计文档

> 版本: v7
> 日期: 2026-04-26
> 状态: Phase 2 - 设计阶段

---

## 一、迁移目标

将 `src/` 下的 CLI/TUI 代码整体迁移到独立的 `claude-code-cli/src/` 包中，实现：

1. **清晰的架构分层**：框架核心（L1-L3）与 CLI 宿主（L4）物理隔离
2. **可独立发布的 SDK**：claude-code/ 可作为纯框架包发布
3. **最小改动原则**：通过跨包引用实现，不重构核心逻辑
4. **保持向后兼容**：CLI 功能完全不变

---

## 二、跨包 Import 路径规范

### 2.1 前缀约定

**CLI → 框架核心**（在 `claude-code-cli/src/` 中）：
```typescript
// 方式1：直接引用（推荐，e2e_cli 已验证）
import { query } from '../../src/query.js'
import { QueryEngine } from '../../src/QueryEngine.js'
import { getTools } from '../../src/tools.js'
import type { Tool } from '../../src/Tool.js'
import { LogUtil } from '../../src/engine/log/index.js'

// 方式2：通过框架导出层（如果创建 index.ts）
import { query, QueryEngine, getTools } from '../../src/index.js'
```

**CLI 内部**（在 `claude-code-cli/src/` 内部）：
```typescript
// 保持相对路径不变
import { Foo } from './components/Foo.js'
import { Bar } from './cli/transports/sse.js'
```

**框架核心**（在 `src/` 中）：
```typescript
// 框架核心内部保持原有路径
import { X } from './utils/foo.js'
import { Y } from './engine/bar.js'

// 不再引用 CLI 模块
// import { Z } from './commands/...'  // 禁止
```

### 2.2 Import 映射规则表

| 原路径 (src/) | 新路径 (claude-code-cli/src/) | 说明 |
|--------------------------|-------------------------------|------|
| `./query.js` | `../../src/query.js` | 核心 API 查询函数 |
| `./QueryEngine.js` | `../../src/QueryEngine.js` | 查询引擎 |
| `./tools.js` | `../../src/tools.js` | 工具注册表 |
| `./Tool.js` | `../../src/Tool.js` | 工具类型 |
| `./commands.js` | 删除（通过接口注入） | 命令不再直接引用 |
| `./types/command.ts` | `../../src/types/command.ts` | 命令类型定义 |
| `./context.ts` | `../../src/context.ts` | 上下文构建 |
| `./state/AppState.js` | `../../src/state/AppState.js` | 应用状态 |
| `./state/AppStateStore.js` | `../../src/state/AppStateStore.js` | 状态存储 |
| `./services/...` | `../../src/services/...` | 服务层 |
| `./utils/...` | `../../src/utils/...` | 工具函数 |
| `./engine/...` | `../../src/engine/...` | 引擎层 |

### 2.3 不需要修改的 Import

以下 import 在迁移后保持不变（因为目标文件也迁移到了 CLI）：

- `./components/...`
- `./screens/...`
- `./hooks/...`
- `./cli/...`
- `./keybindings/...`
- `./vim/...`
- `./migrations/...`

---

## 三、文件归属判定清单

### 3.1 迁移到 claude-code-cli/src/（L4 CLI/TUI 层）

| 目录/文件 | 文件数 | 理由 | 备注 |
|----------|--------|------|------|
| `migrations/` | 11 | 仅 main.tsx 引用，CLI 启动配置迁移 | 已验证框架零引用 |
| `vim/` | 5 | 纯函数式输入状态机，服务于终端输入 | 零运行时依赖 |
| `keybindings/` | 16 | 终端快捷键系统，仅 L4 层引用 | 已验证 126+ 引用全部在 L4 |
| `hooks/` | ~30 | React UI hooks | 仅 Ink 组件使用 |
| `components/` | ~200+ | UI 组件库 | engine/ 零引用 |
| `screens/` | 3+45 stubs | 终端页面（REPL/Doctor/Resume） | engine/ 零引用 |
| `commands/` | ~400 | Slash 命令系统 | QueryEngine 通过接口调用 |
| `cli/` | 128 | CLI 传输/IO/headless 层 | engine/ 零引用 |
| `main.tsx` | 1 | CLI 入口 | Commander.js + 编排逻辑 |
| `dialogLaunchers.tsx` | 1 | UI 对话启动器 | React/Ink 依赖 |
| `interactiveHelpers.tsx` | 1 | 交互辅助函数 | UI 逻辑 |
| `replLauncher.tsx` | 1 | REPL 启动器 | UI 入口 |
| `setup.js` | 1 | CLI 设置逻辑 | UI 依赖 |
| `history.js` | 1 | CLI 历史记录 | CLI 特有 |
| `cost-tracker.js` | 1 | 成本追踪 | CLI 特有 |
| `constants/` | 若干 | CLI 常量 | UI 相关常量 |
| `assistant/` | 若干 | 助手相关 | CLI UI 特有 |
| `upstreamproxy/` | 若干 | 代理服务 | CLI 特有服务 |
| `coordinator/` | 若干 | 协调器 | CLI 特有 |

### 3.2 保留在 src/（L1-L3 框架核心）

| 目录/文件 | 理由 | 备注 |
|----------|------|------|
| `engine/` | Agent Engine SDK，零 CLI 依赖 | 框架核心层 |
| `QueryEngine.ts` | 核心 agent loop | 已与 CLI 解耦 |
| `query.ts` | LLM API 调用 | 框架核心 |
| `tools.ts` + `tools/` | 55+ 内置工具 | 框架能力 |
| `Tool.ts` | 工具类型定义 | 类型核心 |
| `types/` | 核心类型定义 | L1 类型层 |
| `state/` | 应用状态管理 | 框架状态 |
| `services/` | API/MCP/Auth/Analytics | 框架服务层 |
| `utils/` | 核心工具函数 | 保留框架核心部分 |
| `context.ts` | 上下文构建 | 框架上下文 |
| `bootstrap/` | 引导状态 | 框架引导 |
| `commands.ts` | 改为接口/注册器 | 见 3.3 边界处理 |
| `hooks.ts` | 改为接口/类型 | 见 3.3 边界处理 |

### 3.3 边界模糊文件的归属决策

#### 3.3.1 commands.ts vs commands/ 目录

**决策**：
- `commands.ts` → **保留在框架核心**，改造为命令注册器/接口层
- `commands/` → **迁移到 CLI**

**改造方案**：
```typescript
// src/commands.ts 改造后
export interface ICommandProvider {
  getCommands(cwd: string): Promise<Command[]>
  getSlashCommandToolSkills(cwd: string): Promise<Command[]>
  findCommand(name: string, commands: Command[]): Command | undefined
}

export class DefaultCommandProvider implements ICommandProvider {
  // 实现为空或抛出错误，需要 CLI 注入具体实现
  async getCommands(): Promise<Command[]> {
    throw new Error('CommandProvider not initialized. Use setCommandProvider()')
  }
}

let provider: ICommandProvider = new DefaultCommandProvider()

export function setCommandProvider(p: ICommandProvider) {
  provider = p
}

export function getCommands(...args: Parameters<ICommandProvider['getCommands']>) {
  return provider.getCommands(...args)
}
```

CLI 在启动时注入具体实现：
```typescript
// claude-code-cli/src/main.tsx
import { setCommandProvider } from '../../src/commands.js'
import { loadCliCommands } from './commands/index.js'

setCommandProvider({
  getCommands: loadCliCommands,
  getSlashCommandToolSkills: (cwd) => loadCliCommands(cwd).then(filterSkills),
  findCommand: (name, cmds) => cmds.find(c => c.name === name)
})
```

#### 3.3.2 hooks.ts vs hooks/ 目录

**决策**：
- `hooks.ts` → **删除**（如果存在），功能合并到类型定义
- `hooks/` → **迁移到 CLI**

**理由**：
- hooks.ts 通常定义 React hooks 类型
- hooks/ 目录包含具体的 hook 实现，完全 CLI 特有
- 框架不需要 React hooks

#### 3.3.3 bootstrap/ 目录归属

**决策**：`bootstrap/state.ts` 保留在框架，其他文件评估

| 文件 | 归属 | 理由 |
|------|------|------|
| `bootstrap/state.ts` | 框架 | session ID、CWD、token 计数等运行时状态 |
| `bootstrap/*.tsx` | CLI | UI 相关的引导组件 |
| `bootstrap/*setup*.ts` | CLI | CLI 特有的初始化逻辑 |

#### 3.3.4 utils/ 子模块归属

**决策**：

| 子模块 | 归属 | 理由 |
|--------|------|------|
| `utils/plugins/` | CLI | 插件系统是 CLI 特性 |
| `utils/telemetry/` | CLI | 遥测是 CLI 特性 |
| `utils/analytics/` | CLI | 分析是 CLI 特性 |
| `utils/fileHistory.js` | 框架 | 文件历史是框架能力 |
| `utils/fileStateCache.js` | 框架 | 文件状态缓存是框架能力 |
| `utils/config.js` | 框架 | 配置加载是框架需要 |
| `utils/cwd.js` | 框架 | CWD 管理是框架需要 |
| `utils/model/` | 框架 | 模型解析是框架核心 |
| `utils/permissions/` | 框架 | 权限系统是框架核心 |
| `utils/log.js` | 框架 | 日志是框架核心 |
| `utils/messages/` | 框架 | 消息处理是框架核心 |
| `utils/queryHelpers.js` | 框架 | 查询辅助是框架核心 |

#### 3.3.5 state/ 子模块归属

**决策**：全部保留在框架

| 子模块 | 归属 | 理由 |
|--------|------|------|
| `state/AppState.tsx` | 框架 | 核心状态定义 |
| `state/AppStateStore.ts` | 框架 | 状态存储 |
| `state/store.ts` | 框架 | Zustand store |
| `state/selectors.ts` | 框架 | 状态选择器 |

---

## 四、Command 接口发现机制设计

### 4.1 Command 类型定义

**位置**：`src/types/command.ts`（已存在）

当前已包含完整的 Command 接口定义：
- `CommandBase` - 命令基础类型
- `PromptCommand` - prompt 类型命令
- `LocalCommand` - local 类型命令
- `LocalJSXCommand` - local-jsx 类型命令
- `Command` - 联合类型

### 4.2 ICommandProvider 接口设计

**新增文件**：`src/types/commandProvider.ts`

```typescript
import type { Command } from './command.js'

/**
 * 命令提供者接口
 * CLI 通过此接口向框架注册命令，框架通过此接口获取命令
 */
export interface ICommandProvider {
  /**
   * 获取所有可用命令
   * @param cwd - 当前工作目录
   * @returns 命令列表
   */
  getCommands(cwd: string): Promise<Command[]>

  /**
   * 获取可作为技能调用的命令（用于 SkillTool）
   * @param cwd - 当前工作目录
   * @returns 技能命令列表
   */
  getSlashCommandToolSkills(cwd: string): Promise<Command[]>

  /**
   * 查找指定名称的命令
   * @param commandName - 命令名称
   * @param commands - 命令列表
   * @returns 找到的命令或 undefined
   */
  findCommand(
    commandName: string,
    commands: Command[]
  ): Command | undefined

  /**
   * 检查是否有指定命令
   * @param commandName - 命令名称
   * @param commands - 命令列表
   * @returns 是否存在
   */
  hasCommand(commandName: string, commands: Command[]): boolean

  /**
   * 获取指定命令（不存在时抛出错误）
   * @param commandName - 命令名称
   * @param commands - 命令列表
   * @returns 命令
   * @throws ReferenceError 当命令不存在时
   */
  getCommand(commandName: string, commands: Command[]): Command

  /**
   * 清除命令缓存
   */
  clearCommandsCache(): void
}
```

### 4.3 QueryEngine 适配

**位置**：`src/QueryEngine.ts`

**改动点**：

1. **构造函数接受 ICommandProvider**：
```typescript
export class QueryEngine {
  constructor(config: QueryEngineConfig & { commandProvider?: ICommandProvider }) {
    // ...
  }
}
```

2. **通过 provider 获取命令**：
```typescript
// 原代码 (L22-23):
// import type { Command } from './commands.js'
// import { getSlashCommandToolSkills } from './commands.js'

// 改为:
import type { Command } from './types/command.js'
import type { ICommandProvider } from './types/commandProvider.js'

// 在 submitMessage 中:
const skills = await this.config.commandProvider?.getSlashCommandToolSkills?.(getCwd()) ?? []
```

3. **processUserInputContext 注入 provider**：
```typescript
processUserInputContext.options.commands = await this.config.commandProvider?.getCommands?.(getCwd()) ?? []
```

### 4.4 CLI 命令注册流程

**位置**：`claude-code-cli/src/main.tsx`

**实现**：

```typescript
import { setCommandProvider } from '../../src/commands.js'
import type { ICommandProvider } from '../../src/types/commandProvider.js'

// 从迁移后的 commands/ 加载命令
import * as commandRegistry from './commands/index.js'

// 创建 CLI 命令提供者
const cliCommandProvider: ICommandProvider = {
  getCommands: (cwd: string) => commandRegistry.getCommands(cwd),
  getSlashCommandToolSkills: (cwd: string) => commandRegistry.getSlashCommandToolSkills(cwd),
  findCommand: (name, cmds) => commandRegistry.findCommand(name, cmds),
  hasCommand: (name, cmds) => commandRegistry.hasCommand(name, cmds),
  getCommand: (name, cmds) => commandRegistry.getCommand(name, cmds),
  clearCommandsCache: () => commandRegistry.clearCommandsCache()
}

// 在 CLI 启动时注册
setCommandProvider(cliCommandProvider)

// 创建 QueryEngine 时传入
const engine = new QueryEngine({
  // ...
  commandProvider: cliCommandProvider
})
```

---

## 五、框架公共导出清单

### 5.1 框架导出层

**新增文件**：`src/index.ts`

```typescript
// === 核心类型 ===
export type { Command } from './types/command.js'
export type { ICommandProvider } from './types/commandProvider.js'
export type { Message, UserMessage, AssistantMessage, SystemMessage } from './types/message.js'
export type { Tool, ToolInputValidator, ToolUseContext } from './Tool.js'
export type { AppState } from './state/AppState.js'

// === 核心引擎 ===
export { QueryEngine } from './QueryEngine.js'
export { query } from './query.js'

// === 工具系统 ===
export { getTools, findToolByName, toolMatchesName } from './tools.js'

// === 状态管理 ===
export { createStore } from './state/store.js'
export { onChangeAppState } from './state/AppStateStore.js'
export { getDefaultAppState } from './state/AppStateStore.js'

// === 服务 ===
export * from './services/api/claude.js'
export * from './services/mcp/types.js'

// === 工具函数 ===
export { fetchSystemPromptParts } from './utils/queryContext.js'
export { getGlobalConfig } from './utils/config.js'
export { getCwd, setCwd } from './utils/cwd.js'
export * from './utils/model/model.js'
export * from './utils/permissions/filesystem.js'

// === Engine SDK ===
export { AgentEngine } from './engine/AgentEngine.js'
export { EngineError } from './engine/errors.js'
export type { IEngineConfig } from './engine/types/EngineConfig.js'
export type { ToolExtension, SkillExtension } from './engine/bridge/OriginalQueryEngineBridge.js'

// === 日志 ===
export { LogUtil } from './engine/log/index.js'

// === 命令提供者（默认实现） ===
export {
  setCommandProvider,
  getCommands,
  getSlashCommandToolSkills,
  findCommand,
  hasCommand,
  getCommand,
  clearCommandsCache
} from './commands.js'

// === Bootstrap ===
export * from './bootstrap/state.js'

// === Context ===
export { getSystemContext, getUserContext } from './context.js'
```

### 5.2 CLI 从框架核心需要的所有导出

基于 main.tsx 和 REPL.tsx 的 import 分析：

| 导出项 | 源文件 | 用途 |
|--------|--------|------|
| `query` | query.ts | API 查询 |
| `QueryEngine` | QueryEngine.ts | 查询引擎 |
| `getTools` | tools.ts | 获取工具列表 |
| `findToolByName` | tools.ts | 查找工具 |
| `toolMatchesName` | tools.ts | 工具名称匹配 |
| `Tool` | Tool.ts | 工具类型 |
| `AppState` | state/AppState.tsx | 应用状态类型 |
| `createStore` | state/store.ts | 创建状态存储 |
| `onChangeAppState` | state/AppStateStore.ts | 状态变化监听 |
| `fetchSystemPromptParts` | utils/queryContext.ts | 构建系统提示词 |
| `getGlobalConfig` | utils/config.ts | 获取配置 |
| `getCwd`, `setCwd` | utils/cwd.ts | 工作目录管理 |
| `parseUserSpecifiedModel` | utils/model/model.ts | 模型解析 |
| `getMainLoopModel` | utils/model/model.ts | 获取主模型 |
| `Command` | types/command.ts | 命令类型 |
| `ICommandProvider` | types/commandProvider.ts | 命令提供者接口 |
| `setCommandProvider` | commands.ts | 设置命令提供者 |
| `getCommands` | commands.ts | 获取命令列表 |
| `getSlashCommandToolSkills` | commands.ts | 获取技能 |
| `AgentEngine` | engine/AgentEngine.ts | Agent 引擎 |
| `EngineError` | engine/errors.ts | 引擎错误 |
| `LogUtil` | engine/log/index.ts | 日志工具 |
| `getSystemContext` | context.ts | 系统上下文 |
| `getUserContext` | context.ts | 用户上下文 |
| `MCPServerConfig` | services/mcp/types.ts | MCP 配置类型 |
| `ToolUseContext` | Tool.ts | 工具使用上下文 |

---

## 六、CLI 入口点配置方案

### 6.1 package.json 配置

**文件**：`claude-code-cli/package.json`

```json
{
  "name": "claude-code-cli",
  "version": "1.0.0",
  "type": "module",
  "description": "Claude Code CLI - 命令行界面",
  "scripts": {
    "start": "bun run src/main.tsx",
    "dev": "bun run --watch src/main.tsx",
    "build": "bun build src/main.tsx --outdir dist --target bun",
    "typecheck": "bunx tsc --noEmit"
  },
  "dependencies": {
    "@claude-code/engine": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.3.0"
  }
}
```

### 6.2 tsconfig.json 配置

**文件**：`claude-code-cli/tsconfig.json`

```json
{
  "extends": "../claude-code/tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "src/*": ["./src/*"],
      "@/*": ["../../src/*"]
    }
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../claude-code" }
  ]
}
```

### 6.3 启动脚本

**文件**：`claude-code-cli/src/main.tsx`（从 src/main.tsx 迁移）

**关键修改**：

1. **Import 路径调整**（示例）：
```typescript
// 原导入
import { query } from './query.js'
import { QueryEngine } from './QueryEngine.js'
import { getTools } from './tools.js'

// 改为
import { query, QueryEngine, getTools } from '../../src/index.js'
// 或直接引用
import { query } from '../../src/query.js'
```

2. **命令注册**：
```typescript
import { setCommandProvider } from '../../src/commands.js'
import { CliCommandProvider } from './commands/CliCommandProvider.js'

// 在程序初始化时
setCommandProvider(new CliCommandProvider())
```

3. **环境变量映射**（如果需要）：
```typescript
// CLI 特有的环境变量处理
process.env.CLADE_CODE_CLI_ROOT = import.meta.dir
```

### 6.4 命令注册流程图

```
┌─────────────────────────────────────────────────────────┐
│              claude-code-cli 启动流程                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
        ┌───────────────────────────────┐
        │ 1. 加载框架核心模块              │
        │    (../../claude-code/src)    │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │ 2. 创建 CliCommandProvider     │
        │    - 扫描 commands/            │
        │    - 加载 skills/              │
        │    - 加载 plugins/             │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │ 3. 注册到框架                  │
        │    setCommandProvider(provider) │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │ 4. 创建 QueryEngine           │
        │    - 传入 commandProvider      │
        │    - 传入 tools                │
        │    - 传入 MCP clients          │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │ 5. 启动 REPL/Headless         │
        │    - 交互式模式                 │
        │    - 或 --print 模式            │
        └───────────────────────────────┘
```

---

## 七、迁移执行检查清单

### 7.1 前置条件

- [ ] 确认 `claude-code/` 可以独立编译（`bunx tsc --noEmit`）
- [ ] 确认 e2e_cli 跨包引用模式可用
- [ ] 备份当前分支（创建 backup 分支）

### 7.2 Phase 1: 框架准备（T2-T3）

- [ ] 创建 `claude-code-cli/` 目录结构
- [ ] 创建 `src/index.ts` 导出层
- [ ] 创建 `src/types/commandProvider.ts`
- [ ] 修改 `src/commands.ts` 为接口模式
- [ ] 修改 `src/QueryEngine.ts` 接受 ICommandProvider
- [ ] 修改 engine/ 中对 Command 的 type import
- [ ] 框架编译验证

### 7.3 Phase 2: 文件迁移（T4）

- [ ] migrations/ → claude-code-cli/src/migrations/
- [ ] vim/ → claude-code-cli/src/vim/
- [ ] keybindings/ → claude-code-cli/src/keybindings/
- [ ] hooks/ → claude-code-cli/src/hooks/
- [ ] components/ → claude-code-cli/src/components/
- [ ] screens/ → claude-code-cli/src/screens/
- [ ] commands/ → claude-code-cli/src/commands/
- [ ] cli/ → claude-code-cli/src/cli/
- [ ] main.tsx → claude-code-cli/src/main.tsx
- [ ] 辅助文件迁移

### 7.4 Phase 3: Import 修复（T5-T6）

- [ ] 框架侧：清理对已迁移模块的引用
- [ ] CLI 侧：修复所有指向框架核心的 import 路径
- [ ] CLI 内部：保持相对路径不变

### 7.5 Phase 4: 配置与验证（T7-T8）

- [ ] 配置 claude-code-cli/package.json
- [ ] 配置 claude-code-cli/tsconfig.json
- [ ] 实现 CliCommandProvider
- [ ] main.tsx 中注册命令提供者
- [ ] 启动测试：`bun run claude-code-cli/src/main.tsx`
- [ ] 编译验证：全项目 `bunx tsc --noEmit`
- [ ] 功能验证：REPL、headless、命令执行

---

## 八、风险与缓解措施

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| 循环依赖 | 高 | architect 预先识别依赖图，只允许 CLI → 框架单向引用 |
| Import 路径遗漏 | 中 | 每个 task 后 `bunx tsc --noEmit` 验证 |
| 运行时错误 | 高 | T8 端到端验证覆盖所有核心功能 |
| 命令系统改造 | 中 | 保持接口不变，CLI 注入具体实现 |
| 文件量大导致耗时长 | 低 | git mv + 批量 sed，分批并行 |

---

## 九、后续工作（V8+）

本迁移实现物理分离，V8 可进一步优化：

1. **独立发布**：claude-code/ 作为 npm 包发布
2. **打包优化**：配置 rollup/esbuild 排除 .tsx 文件
3. **类型优化**：建立更清晰的类型层次
4. **测试分离**：框架单元测试 vs CLI 集成测试

---

## 十、参考资料

- V7 研究报告：`auto-upgrade/v7/01-optimizer-research.md`
- V7 任务计划：`auto-upgrade/v7/02-task-plan.md`
- e2e_cli 跨包引用示例：`claude_code_framework_e2e_cli/`
- 架构分层标准：`docs/architecture-layering-standard.md`
- 架构设计文档：`docs/architecture-design.md`
