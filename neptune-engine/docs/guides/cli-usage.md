# CLI 使用说明

## 概述

`claude-code-cli` 是 Claude Code 的 CLI/TUI 宿主实现，基于 `claude-code` 框架核心构建。

## 项目结构

```
claude-not-only-code/
├── src/                   # 框架核心（SDK）
│   └── src/
│       ├── query/        # 查询引擎（agent loop）
│       ├── tools/        # 工具系统
│       ├── services/     # API、分析等服务
│       ├── state/        # 状态管理
│       ├── bootstrap/    # 启动引导
│       ├── context.ts    # 上下文构建
│       ├── commands.ts   # 命令注册（从 CLI 包加载实现）
│       └── ...
├── claude-code-cli/      # CLI 宿主（独立目录）
│   ├── package.json
│   └── src/
│       ├── entrypoints/
│       │   └── cli.tsx   # 主入口点
│       ├── main.tsx      # Commander.js CLI 定义
│       ├── commands/     # 124 个命令实现
│       ├── components/   # React/Ink UI 组件
│       ├── screens/      # REPL 等屏幕
│       ├── bridge/       # Remote Control 功能
│       ├── cli/          # CLI 底层（print、transport 等）
│       ├── hooks/        # React hooks
│       └── ...
└── packages/             # 工作区包
```

## 运行方式

### 前置条件

- Bun >= 1.3
- 安装依赖：在项目根目录运行 `bun install`

### 入口点

CLI 的主入口点是 `claude-code-cli/src/entrypoints/cli.tsx`，它会：
1. 初始化 `MACRO.*` 全局变量（版本号等）
2. 设置 feature flags
3. 加载 `main.tsx`（Commander.js 命令定义）

### 运行命令

```bash
# 进入 CLI 目录
cd claude-code-cli

# 查看帮助
bun run src/entrypoints/cli.tsx --help

# 查看版本
bun run src/entrypoints/cli.tsx --version

# Pipe 模式（非交互）
echo "say hello" | bun run src/entrypoints/cli.tsx -p

# 交互模式（REPL）
bun run src/entrypoints/cli.tsx

# 开发模式（自动重载）
bun run dev
```

### npm scripts

```json
{
  "start": "bun run src/main.tsx",
  "dev": "bun run --watch src/main.tsx"
}
```

## 导入路径规则

由于 CLI 包与框架核心在同一个 monorepo 中，导入路径需要遵循以下规则：

### 从 CLI 导入框架模块

CLI 文件通过相对路径导入框架模块：

```
claude-code-cli/src/main.tsx          → ../../src/...
claude-code-cli/src/utils/auth.ts     → ../../../src/...
claude-code-cli/src/cli/handlers/     → ../../../../src/...
```

深度计算：从 CLI 源文件到 `src/` 的相对路径深度 = 子目录层数 + 2。

### CLI 本地导入

CLI 包内部的模块使用标准相对路径：

```typescript
import { Something } from './components/...'
import { helper } from '../utils/...'
```

### tsconfig 路径别名

CLI 的 `tsconfig.json` 配置了 `src/*` 路径别名：

```json
{
  "paths": {
    "src/*": ["./src/*", "../../src/*"]
  }
}
```

**注意**：Bun 运行时不使用 tsconfig paths，因此所有导入必须使用实际相对路径。TypeScript 类型检查使用 tsconfig paths，但运行时需要显式相对路径。

## 框架→CLI 依赖现状

当前 `commands.ts` 是框架中唯一大规模引用 CLI 包的文件，它从 `claude-code-cli/src/commands/` 加载命令实现。这是过渡期的妥协方案。

其他 20 处框架→CLI 反向依赖主要涉及：
- UI 组件导入（MessageResponse、ComputerUseApproval 等）
- 类型导入（SuggestionItem、BridgePermissionCallbacks）
- 功能模块（poorMode、bridgeEnabled、upstreamproxy）

这些将逐步通过注册模式（component registry）和类型提取来消除。

## 命令系统

### 命令注册

框架通过 `ICommandProvider` 接口定义命令系统抽象。CLI 在启动时注入具体实现。

```typescript
// 框架：src/types/commandProvider.ts
interface ICommandProvider {
  getCommands(cwd: string): Promise<Command[]>
  getSlashCommandToolSkills(cwd: string): Promise<Command[]>
  findCommand(name: string, commands: Command[]): Command | undefined
  // ... 更多方法
}

// 框架：src/commands.ts
export function setCommandProvider(p: ICommandProvider): void
```

### 当前实现

当前 `commands.ts` 直接从 CLI 包导入命令实现并注册到 COMMANDS 数组中。这是过渡方案，后续会改为 CLI 在启动时调用 `setCommandProvider()` 注入。

## Feature Flags

通过 `import { feature } from 'bun:bundle'` 使用。默认全部关闭。

启用方式：`FEATURE_<FLAG_NAME>=1 bun run src/entrypoints/cli.tsx`

关键 flags：
- `BRIDGE_MODE` - Remote Control 功能
- `DAEMON` - 后台守护进程
- `VOICE_MODE` - 语音输入
- `BUDDY` - Buddy 功能
- `MCP_SKILLS` - MCP 技能系统

## 已知限制

1. **Linter 路径重写**：Biome 可能将 `../../src/` 重写为 `./`（基于 tsconfig paths）。修改文件后需要检查导入路径。

2. **commands.ts 反向依赖**：框架的 `commands.ts` 引用了 CLI 包中的 124 个命令模块。

3. **node_modules**：CLI 包通过软链接共享框架的 `node_modules`。

## 测试验证

```bash
# 验证 CLI 启动
cd claude-code-cli
bun run src/entrypoints/cli.tsx --help    # 应显示帮助信息
bun run src/entrypoints/cli.tsx --version  # 应显示版本号
```
