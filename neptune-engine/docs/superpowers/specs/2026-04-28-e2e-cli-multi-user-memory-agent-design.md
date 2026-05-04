# e2e CLI 多用户 Agent 设计文档

> 日期：2026-04-28
> 状态：设计确认，待实施
> 覆盖项目：`claude_code_framework_e2e_cli`

---

## 一、项目定位与目标

### 1.1 定位

`claude_code_framework_e2e_cli` 是 Agent Engine SDK 的**全面能力展示 Demo**（参考实现），目标是展示框架 V5 的所有核心特性如何被正确使用。

### 1.2 核心目标

构造一个**多用户、重启可恢复、UI 交互完备**的终端 CLI Agent。

### 1.3 约束

- 单机多用户，PG 数据库隔离
- 渐进增强：在现有代码基础上新增模块，不推翻重写
- 保持 PG 作为存储方案
- 大胆使用框架能力；不足的地方记录到框架需求清单
- 用户长期记忆系统暂不实现，等待框架提供原生支持（见 FR-1~FR-6）

---

## 二、整体架构

### 2.1 目录结构

```
claude_code_framework_e2e_cli/
├── src/
│   ├── main.ts                    # 入口：欢迎页 → REPL
│   │
│   ├── welcome/                   # 新增：欢迎页模块
│   │   ├── welcome.ts             # 欢迎页流程逻辑
│   │   └── welcome-ui.ts          # ANSI 欢迎页 UI 渲染
│   │
│   ├── cli/                       # 增强型 CLI 层
│   │   ├── repl.ts                # 增强型 REPL（历史/补全/颜色）
│   │   ├── commands.ts            # 扩展命令集
│   │   ├── display.ts             # 增强渲染（富文本/Markdown/状态栏）
│   │   ├── status-bar.ts          # 新增：底部状态仪表盘
│   │   ├── rich-text.ts           # 新增：Markdown/代码高亮渲染
│   │   └── permission-delegate.ts # 保持（已完善）
│   │
│   ├── session/                   # 扩展：会话管理
│   │   ├── session-service.ts     # 现有（扩展恢复逻辑）
│   │   └── pg-session-store.ts    # 现有（扩展消息历史加载）
│   │
│   ├── auth/                      # 保持
│   ├── tools/                     # 保持
│   ├── skills/                    # 保持
│   ├── config.ts                  # 扩展配置
│   └── db/pg-client.ts           # 保持
│
└── framework-requirements.md      # 新增：框架需求清单
```

### 2.2 启动流程

CLI 无状态设计：不依赖本地文件，所有状态从 PG 读取，支持水平扩展。

```
main.ts 启动
    │
    ▼
欢迎页 (welcome.ts)
    │
    ├── 未登录 → 显示登录选项
    │   ├── /login -u xxx -p xxx 直接登录
    │   └── 交互式输入用户名密码
    │
    └── 登录后 → 从 PG 查询会话列表
        ├── 查询: SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC
        ├── 推荐最近的活跃会话（按 Enter 快速恢复）
        ├── 列出其他历史会话供选择
        └── 或 /session new 创建新会话
    │
    ▼
REPL 主循环 (repl.ts)
```

---

## 三、重启可恢复

### 3.1 设计原则

CLI 无状态，不依赖本地文件。所有用户/会话状态从 PG 查询，CLI 实例可水平扩展。

### 3.2 会话恢复

当前已有的恢复机制：
- PG 存储消息记录（`messages` 表）
- `engine.loadSession({ workspace })` 从 transcript.jsonl 恢复
- `switchSession()` 中已有恢复逻辑

需要增强：
- 恢复时从 PG 的 `messages` 表按 `turn_number` 降序取最近 N 条
- 避免加载全部历史导致 token 浪费
- N 可通过配置控制（默认 20 条 = 10 轮对话）

### 3.3 新增命令

| 命令 | 功能 |
|------|------|
| `/resume` | 快速恢复最近活跃会话（从 PG 查询） |
| `/history [N]` | 查看当前会话最近 N 条历史消息 |

---

## 四、UI 交互增强

### 4.1 终端增强

基于 readline + chalk + cli-highlight：

| 能力 | 实现方式 |
|------|----------|
| 命令历史 | readline `historySize: 100`，支持上下键浏览 |
| Tab 补全 | 自定义 `rl.completer`，补全 `/` 命令和参数 |
| 彩色输出 | chalk 库，对话/错误/工具调用用不同颜色 |
| 密码遮罩 | 登录时密码输入用 `*` 显示 |

### 4.2 富文本渲染

| 能力 | 实现方式 |
|------|----------|
| Markdown 基础渲染 | 标题/列表/加粗/代码块 → ANSI 格式 |
| 代码语法高亮 | `cli-highlight` 库 |
| 工具调用展示 | 增强彩色边框、参数格式化 |

### 4.3 状态仪表盘

在每次 prompt 前渲染状态栏：

```
┌─ alice @ 税务咨询 ─── Turn: 5 ─── Token: 1.2k ─── Cost: $0.03 ─── Sessions: 2 ──┐
│ >                                                                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

通过 `getPrompt()` 返回包含状态栏的 prompt 字符串。

### 4.4 扩展命令集

| 命令 | 功能 | 对应框架特性 |
|------|------|-------------|
| `/resume` | 恢复上次会话 | loadSession |
| `/history [N]` | 查看历史消息 | PG 存储 |
| `/provider <name>` | 切换 LLM Provider | ProviderRegistry |
| `/events` | 查看事件日志 | EventBus |
| `/compact` | 手动触发上下文压缩 | — |

---

## 五、框架特性覆盖矩阵

| 框架特性 | e2e_cli 使用方式 | 状态 |
|----------|-----------------|------|
| `AgentEngine.create()` | 引擎初始化 | 已实现 |
| `engine.createSession()` | 会话创建 + per-session systemPrompt | 已实现 |
| `engine.query()` | 流式查询 + AbortSignal | 已实现 |
| `engine.pauseSession/resumeSession()` | 会话暂停/恢复 | 已实现 |
| `engine.destroySession()` | 会话销毁 | 已实现 |
| `engine.loadSession()` | 从 transcript 恢复 | 已实现 |
| `engine.setMemoryPath()` | 用户记忆路径隔离 | 已实现 |
| `engine.getStats()` | 引擎统计展示 | 已实现 |
| `engine.getEventBus()` | 生命周期事件监听 | 已实现 |
| `engine.on()` / EventBus | 更多事件订阅（error/events） | 需新增 |
| `ToolExtension` | 自定义工具（财务计算器等） | 已实现 |
| `SkillExtension` | 技能扩展 | 已实现 |
| `PermissionDelegate` | 交互式权限决策 | 已实现 |
| `loadEngineSettings()` | 设置查看 | 已实现 |
| `EngineError` | 统一错误处理 | 已实现 |
| `ProviderRegistry` / Multi-Provider | 动态切换 Provider | 需新增 |
| `HookExecutor` / `createHookCore` | 通知/会话结束 Hook | 需新增 |
| `ISessionStore` / `SQLiteSessionStore` | 展示框架存储接口 | 需新增 |
| `EngineState` | 引擎状态监听 | 需新增 |
| `LogUtil` / `FileLogStore` | 结构化日志 | 需新增 |
| `collectText` / `waitForResult` | SDK 便捷 API 展示 | 需新增 |
| QueryEvent 类型系统 | 完整事件类型处理 | 需增强 |
| `query()` 互斥 | 框架 V5 新增，展示并发保护 | 需新增 |

---

## 六、框架需求清单

记录 e2e_cli 开发过程中发现的框架不足，作为框架后续优化的输入。

| # | 需求 | 说明 | 优先级 |
|---|------|------|--------|
| FR-1 | IMemoryProvider 接口 | SDK 用户自定义记忆加载/存储策略，替代封闭的 memdir | P0 |
| FR-2 | 自定义记忆目录 | getAutoMemPath() 支持SDK级别覆盖（不依赖 feature gate） | P0 |
| FR-3 | 记忆注入钩子 | systemPrompt 构建时提供记忆注入扩展点 | P1 |
| FR-4 | 记忆变更事件 | EventBus 支持 memory:updated 事件类型 | P1 |
| FR-5 | per-session CLAUDE.md | CLAUDE.md 从 memoryPath 查找而非仅从 CWD | P2 |
| FR-6 | forkedAgent SDK 暴露 | 允许 SDK 用户运行后台记忆提取 subagent | P2 |

---

## 七、文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `src/welcome/welcome.ts` | 欢迎页流程逻辑 |
| 新增 | `src/welcome/welcome-ui.ts` | ANSI 欢迎页 UI 渲染 |
| 新增 | `src/cli/status-bar.ts` | 底部状态仪表盘 |
| 新增 | `src/cli/rich-text.ts` | Markdown + 代码高亮渲染 |
| 新增 | `framework-requirements.md` | 框架需求清单 |
| 修改 | `src/main.ts` | 增加欢迎页流程 |
| 修改 | `src/cli/repl.ts` | 增强型 REPL（历史/补全/颜色） |
| 修改 | `src/cli/commands.ts` | 扩展命令集（provider/events 等） |
| 修改 | `src/cli/display.ts` | 增强渲染 + 状态栏集成 |
| 修改 | `src/session/session-service.ts` | 会话恢复增强 |
| 修改 | `src/session/pg-session-store.ts` | 消息历史加载增强 |
| 修改 | `src/config.ts` | 新增配置项 |
| 修改 | `package.json` | 新增依赖（chalk, cli-highlight） |

---

## 八、新增依赖

```json
{
  "chalk": "^5.x",
  "cli-highlight": "^2.x"
}
```
