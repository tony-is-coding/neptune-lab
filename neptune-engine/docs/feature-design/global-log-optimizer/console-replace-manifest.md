# Console 调用替换清单

## 统计
- 总计：131 个调用
- 按级别分布：debug: 18, info: 52, warn: 10, error: 49, 不替换(UI输出/示例代码): 2

## 替换详情

### src/main.tsx
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 1750 | `console.warn(chalk.yellow("Tip: You can launch..."))` | logger.warn | CLI 用户提示信息 |
| 1816 | `console.warn(chalk.yellow("Assistant mode disabled..."))` | logger.warn | 信任对话框未接受警告 |
| 2450 | `console.error("Error: Failed to run with Claude in Chrome.")` | logger.error | Chrome 集成启动失败 |
| 2737 | `console.error(warning)` | logger.error | 初始化警告输出 |
| 2799 | `console.error('Error: Invalid input format...')` | logger.error | 参数校验错误 |
| 2807 | `console.error('Error: --input-format=stream-json...')` | logger.error | 参数校验错误 |
| 2820 | `console.error('Error: --sdk-url requires...')` | logger.error | 参数校验错误 |
| 2834 | `console.error('Error: --replay-user-messages requires...')` | logger.error | 参数校验错误 |
| 6060 | `console.error(err instanceof DirectConnectError ? ...)` | logger.error | DirectConnect 连接错误 |

### src/services/plugins/pluginCliCommands.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 65 | `console.error(figures.cross + ' Failed to ...')` | logger.error | 插件命令失败 |
| 109 | `console.log('Installing plugin...')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 插件安装进度 |
| 118 | `console.log(figures.tick + result.message)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 插件安装成功 |
| 166 | `console.log(figures.tick + result.message)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 插件卸载成功 |
| 207 | `console.log(figures.tick + result.message)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 插件启用成功 |
| 248 | `console.log(figures.tick + result.message)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 插件禁用成功 |
| 284 | `console.log(figures.tick + result.message)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 全部禁用成功 |

### src/engine/bridge/OriginalQueryEngineBridge.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 67 | `console.warn('[Bridge] enableConfigs() failed:', ...)` | ✅ 已替换为 logger.warn | Bridge 配置初始化失败 |
| 79 | `console.warn('[Bridge] bootstrap state setup failed:', ...)` | ✅ 已替换为 logger.warn | Bridge bootstrap 状态设置失败 |
| 133 | `console.warn('[Bridge] getAllBaseTools() failed:', ...)` | ✅ 已替换为 logger.warn | Bridge 工具加载失败 |

### src/engine/events/EventBus.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 57 | `console.warn(\`[EventBus] Hook for "${type}" threw error:\`, e)` | ✅ 已替换为 LogUtil.warn | Hook 执行错误 |
| 74 | `console.warn(\`[EventBus] Listener for "${type}" threw error:\`, e)` | ✅ 已替换为 LogUtil.warn | 监听器执行错误 |

### src/engine/log/ConsoleLogProvider.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| - | `console.log/warn/error` | ⚠️ 不替换 | 日志框架底层输出，基础设施层 |

### src/services/api/client.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 77 | `console.error('[Anthropic SDK ERROR]', msg, ...args)` | logger.error | SDK 日志适配器，替换为 LogUtil 后统一走 logger |
| 79 | `console.error('[Anthropic SDK WARN]', msg, ...args)` | logger.warn | SDK 日志适配器 |
| 81 | `console.error('[Anthropic SDK INFO]', msg, ...args)` | logger.info | SDK 日志适配器 |
| 84 | `console.error('[Anthropic SDK DEBUG]', msg, ...args)` | logger.debug | SDK 日志适配器 |

### src/cli/exit.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 21 | `console.error(msg)` | logger.error | 集中式 CLI 错误输出函数 |

### src/setup.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 73 | `console.error(chalk.bold.red('Error: Claude Code requires Node.js...'))` | logger.error | Node.js 版本检查 |
| 121 | `console.log(chalk.yellow('Detected an interrupted iTerm2 setup...'))` | logger.info | iTerm2 备份恢复提示 |
| 128 | `console.error(chalk.red('Failed to restore iTerm2 settings...'))` | logger.error | iTerm2 恢复失败 |
| 141 | `console.log(chalk.yellow('Detected an interrupted Terminal.app setup...'))` | logger.info | Terminal.app 备份恢复提示 |
| 148 | `console.error(chalk.red('Failed to restore Terminal.app settings...'))` | logger.error | Terminal.app 恢复失败 |
| 256 | `console.log(chalk.green('Created tmux session...'))` | logger.info | tmux 会话创建成功 |
| 263 | `console.error(chalk.yellow('Warning: Failed to create tmux session...'))` | logger.error | tmux 会话创建失败 |
| 410 | `console.error('--dangerously-skip-permissions cannot be used with root...')` | logger.error | 安全校验错误 |
| 436 | `console.error('--dangerously-skip-permissions can only be used in Docker...')` | logger.error | 沙箱校验错误 |

### src/cli/structuredIO.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 466 | `console.error('Error parsing streaming input line...')` | logger.error | 流式输入解析错误 |
| 691 | `console.error('Error in hook callback...', error)` | logger.error | Hook 回调执行错误 |
| 785 | `console.error(message)` | logger.error | exitWithMessage 致命错误 |

### src/cli/handlers/agents.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 63 | `console.log('No agents found.')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | CLI 列表输出 |
| 66 | `console.log(totalActive + ' active agents\n')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | CLI 列表输出 |
| 68 | `console.log(lines.join('\n').trimEnd())` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | CLI 列表输出 |

### src/cli/handlers/plugins.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 76 | `console.log(...)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 插件验证输出 |
| 81 | `console.log(...)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 错误列表输出 |
| 84 | `console.log('')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 空行分隔 |
| 88 | `console.log(...)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 警告列表输出 |
| 93 | `console.log(...)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 警告项输出 |
| 96 | `console.log('')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 空行分隔 |
| 110 | `console.log('Validating...')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 验证进度 |
| 124 | `console.log('Validating...')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 验证进度 |
| 143 | `console.log(figures.cross + ' Validation failed')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 验证失败 |
| 149 | `console.error(...)` | logger.error | 验证异常 |
| 362 | `console.log('Installed plugins:\n')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 插件列表标题 |
| 387-429 | 多个 `console.log(...)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 插件详情列表输出（共15处） |
| 437 | `console.log(...)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 无插件提示 |
| 493 | `console.log('Adding marketplace...')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | marketplace 添加进度 |
| 498 | `console.log(message)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | marketplace 进度消息 |
| 559-585 | 多个 `console.log(...)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | marketplace 列表输出（共10处） |
| 624 | `console.log('Updating marketplace...')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | marketplace 更新进度 |
| 628 | `console.log(message)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | marketplace 更新消息 |
| 648 | `console.log('Updating N marketplace(s)...')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 批量更新进度 |

### src/cli/handlers/mcp.tsx
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 194 | `console.log(...)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | MCP 服务器列表标题 |
| 199 | `console.log('Checking MCP server health...\n')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 健康检查进度 |
| 217-228 | 多个 `console.log(...)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | MCP 服务器状态输出（共4处） |
| 248-326 | 多个 `console.log(...)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | MCP 服务器详情输出（共20处） |

### src/bridge/bridgeMain.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 1968 | `console.log(help)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 帮助文本输出 |
| 2007 | `console.error('Error: ' + parsed.error)` | logger.error | 参数解析错误 |
| 2046 | `console.error('Error: Invalid permission mode...')` | logger.error | 权限模式校验错误 |
| 2089 | `console.error('Error: Multi-session Remote Control is not enabled...')` | logger.error | 功能未启用错误 |
| 2106 | `console.error('Error: Workspace not trusted...')` | logger.error | 工作区未信任错误 |
| 2123 | `console.error(BRIDGE_LOGIN_ERROR)` | logger.error | Bridge 登录错误 |
| 2142 | `console.log('\nRemote Control lets you access...')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 首次运行对话框 |
| 2174 | `console.error('Error: No recent session found...')` | logger.error | 会话未找到错误 |
| 2185 | `console.error('Resuming session...')` | logger.info | 会话恢复信息（虽用 error 但实为 info） |
| 2206 | `console.error('Error: Remote Control base URL uses HTTP...')` | logger.error | HTTPS 校验错误 |
| 2242 | `console.error('Warning: Saved spawn mode is worktree but...')` | logger.warn | spawn 模式回退警告 |
| 2269 | `console.log('\nClaude Remote Control is launching...')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | spawn 模式选择对话框 |
| 2348 | `console.error('Error: Worktree mode requires...')` | logger.error | worktree 模式校验错误 |
| 2383 | `console.error('Error: Invalid session ID...')` | logger.error | 会话 ID 校验错误 |
| 2409 | `console.error('Error: Session ... not found...')` | logger.error | 会话未找到错误 |
| 2421 | `console.error('Error: Session ... has no environment_id...')` | logger.error | 会话无环境 ID 错误 |
| 2475 | `console.error(err instanceof BridgeFatalError ? ...)` | logger.error | Bridge 注册失败 |
| 2500 | `console.warn('Warning: Could not resume session...')` | logger.warn | 会话恢复失败警告 |
| 2551 | `console.error(isFatal ? ... : ...)` | logger.error | 重连失败错误 |

### src/utils/fileHistory.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 1113 | `console.error(inspect(state, false, 5))` | logger.debug | 调试状态转储（受 ENABLE_DUMP_STATE 控制） |

### src/entrypoints/cli.tsx
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 84 | `console.log(MACRO.VERSION + ' (Claude Code)')` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 版本号输出 |
| 105 | `console.log(prompt.join('\n'))` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | 系统示词转储 |

### src/components/ThemePicker.tsx
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 166-167 | `console.log("Hello, World!")` / `console.log("Hello, Claude!")` | 不替换 | 示例代码字符串，非实际调用 |

### src/utils/process.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 40 | `console.error(message)` | logger.error | exitWithError 集中式错误输出 |

### src/utils/shell/prefix.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 207 | `console.warn(chalk.yellow('⚠️  ' + message))` | logger.warn | 预检超时警告 |

### src/utils/worktree.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 1272 | `console.log('Using worktree via hook: ...')` | logger.info | worktree hook 使用信息 |
| 1295 | `console.log('Created worktree: ...')` | logger.info | worktree 创建信息 |
| 1387 | `console.log('\n' + iTerm2 Tip box)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | iTerm2 提示框 |

### src/utils/auth.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 518 | `console.error(chalk.red('apiKeyHelper failed: ...'))` | logger.error | API Key 辅助脚本失败 |
| 694 | `console.error(message)` | logger.error | AWS 认证刷新超时/失败 |
| 773 | `console.error(message, e.message)` | logger.error | AWS 凭证导出错误 |
| 776 | `console.error(message, e)` | logger.error | AWS 凭证导出错误 |
| 962 | `console.error(message)` | logger.error | GCP 认证刷新超时/失败 |

### src/utils/deepLink/protocolHandler.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 46 | `console.error('Deep link error: ...')` | logger.error | 深度链接解析错误 |
| 69 | `console.error('Failed to open a terminal...')` | logger.error | 终端打开失败 |

### src/utils/claudeInChrome/chromeNativeHost.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 45 | `console.error('[Claude Chrome Native Host] ...')` | logger.debug | Chrome Native Host 日志（调试级别，写入日志文件） |

### src/utils/windowsPaths.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 104 | `console.error('Claude Code was unable to find CLAUDE_CODE_GIT_BASH_PATH...')` | logger.error | Git Bash 路径未找到 |
| 120 | `console.error('Claude Code on Windows requires git-bash...')` | logger.error | Git Bash 未安装 |

### src/utils/betas.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 72 | `console.warn('Warning: Custom betas are only available for API key users...')` | logger.warn | Beta 功能限制警告 |
| 81 | `console.warn('Warning: Beta header ... is not allowed...')` | logger.warn | 不允许的 Beta 头警告 |

### src/utils/autoUpdater.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 85 | `console.error('It looks like your version...')` | logger.error | 版本过旧强制更新提示 |
| 482 | `console.error('Error: Windows NPM detected in WSL...')` | logger.error | WSL 环境 NPM 检测错误 |

### src/commands/insights.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 3062 | `console.error('Collecting sessions from N homespace(s)...')` | logger.info | 远程会话收集进度信息 |

### src/utils/log.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 162 | `console.error('[HARD FAIL] logError called with:', ...)` | 底层日志函数，替换为 LogUtil（logger.error） | logError 内部的 HARD_FAIL 模式输出 |

### src/daemon/workerRegistry.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 28 | `console.error('Error: --daemon-worker requires a worker kind')` | logger.error | daemon worker 参数缺失 |
| 38 | `console.error('Error: unknown daemon worker kind...')` | logger.error | daemon worker 类型未知 |
| 94 | `console.log('[remoteControl] ...')` | logger.debug | remoteControl 调试日志 |
| 102 | `console.error('[remoteControl] permanent error: ...')` | logger.error | remoteControl 永久错误 |
| 105 | `console.error('[remoteControl] transient error: ...')` | logger.error | remoteControl 临时错误 |

### src/daemon/main.ts
| 行号 | 原始调用 | 替换为 | 说明 |
|------|---------|--------|------|
| 49 | `console.log('daemon status: not yet implemented...')` | logger.info | daemon 状态（未实现） |
| 52 | `console.log('daemon stop: not yet implemented...')` | logger.info | daemon 停止（未实现） |
| 59 | `console.error('Unknown daemon subcommand: ...')` | logger.error | daemon 未知子命令 |
| 66 | `console.log(help text)` | UI输出，保留 console.log 或使用专门的 UI 输出通道 | daemon 帮助文本 |
| 130 | `console.log('[daemon] supervisor starting in ...')` | logger.debug | daemon supervisor 启动日志 |
| 147 | `console.log('[daemon] supervisor shutting down...')` | logger.debug | daemon supervisor 关闭日志 |
| 197 | `console.log('[daemon] supervisor stopped')` | logger.debug | daemon supervisor 停止日志 |
| 232 | `console.log('[daemon] spawning worker ...')` | logger.debug | daemon 生成 worker 日志 |
| 246 | `console.log('  ' + line)` | logger.debug | worker stdout 转发 |
| 252 | `console.error('  ' + line)` | logger.debug | worker stderr 转发 |
| 265 | `console.error('[daemon] worker ... exited with permanent error — parking')` | logger.error | worker 永久错误 |
| 277 | `console.error('[daemon] worker ... failed N times rapidly — parking')` | logger.error | worker 快速失败 |
| 289 | `console.log('[daemon] worker ... exited, restarting in ...')` | logger.debug | worker 重启日志 |

## 分类汇总

### 需要替换为 logger.debug 的调用（18处）
主要集中在 daemon、bridge 调试日志和内部诊断输出：
- `src/daemon/main.ts`: 6处（supervisor 生命周期日志）
- `src/daemon/workerRegistry.ts`: 1处（remoteControl 日志回调）
- `src/services/api/client.ts`: 1处（SDK DEBUG 级别）
- `src/utils/fileHistory.ts`: 1处（调试状态转储）
- `src/utils/claudeInChrome/chromeNativeHost.ts`: 1处（Chrome Native Host 日志）
- `src/engine/bridge/OriginalQueryEngineBridge.ts`: 0处（这些是 warn）
- `src/daemon/main.ts` worker stdout/stderr 转发: 2处

### 需要替换为 logger.info 的调用（8处，不含 UI 输出）
运行时状态信息：
- `src/setup.ts`: 2处（iTerm2/Terminal.app 恢复提示、tmux 创建成功）
- `src/utils/worktree.ts`: 2处（worktree 创建/使用信息）
- `src/bridge/bridgeMain.ts`: 1处（会话恢复信息）
- `src/commands/insights.ts`: 1处（远程会话收集进度）
- `src/daemon/main.ts`: 2处（status/stop 未实现提示）

### 需要替换为 logger.warn 的调用（10处）
- `src/main.tsx`: 2处
- `src/engine/bridge/OriginalQueryEngineBridge.ts`: 3处
- `src/services/api/client.ts`: 1处
- `src/utils/shell/prefix.ts`: 1处
- `src/utils/betas.ts`: 2处
- `src/bridge/bridgeMain.ts`: 1处（spawn 模式回退警告）

### 需要替换为 logger.error 的调用（49处）
分布在各文件的错误处理路径中，详见上方各文件表格。

### UI 输出，保留 console.log 或使用专门的 UI 输出通道（约 52 处）
这些是 CLI 用户界面输出，直接面向终端用户，不应替换为 logger：
- `src/cli/handlers/plugins.ts`: ~30处（插件列表、验证输出）
- `src/cli/handlers/mcp.tsx`: ~24处（MCP 服务器列表、详情输出）
- `src/cli/handlers/agents.ts`: 3处（agent 列表输出）
- `src/services/plugins/pluginCliCommands.ts`: 6处（安装/卸载/启用/禁用进度）
- `src/entrypoints/cli.tsx`: 2处（版本号、系统提示词转储）
- `src/bridge/bridgeMain.ts`: 3处（帮助文本、首次运行对话框、spawn 选择）
- `src/daemon/main.ts`: 1处（帮助文本）
- `src/utils/worktree.ts`: 1处（iTerm2 提示框）

### 不替换（2处）
- `src/components/ThemePicker.tsx`: 166-167行 — 示例代码字符串，非实际 console 调用

## 特殊处理说明

### 1. src/utils/log.ts — 底层日志函数
`logError` 函数内部的 `console.error` (行162) 是底层日志基础设施的一部分。替换为 LogUtil 时需注意避免循环依赖：LogUtil 的 error 实现不应再调用 logError，否则会形成无限递归。建议 LogUtil 直接使用底层输出（如 process.stderr.write），而 logError 内部改为调用 LogUtil。

### 2. src/services/api/client.ts — SDK 日志适配器
`createStderrLogger()` 是 Anthropic SDK 的日志适配器。替换后应保持相同的接口签名（`error`/`warn`/`info`/`debug` 方法），内部改为调用 LogUtil 对应级别。

### 3. UI 输出通道
约 52 处 console.log 是 CLI 用户界面输出（插件列表、MCP 状态、帮助文本等）。这些不应替换为 logger，而应：
- 短期：保留 console.log
- 长期：引入专门的 UI 输出通道（如 `UIOutput.print()`），与日志系统解耦

### 4. src/bridge/bridgeMain.ts:2185 — 错误级别误用
该行使用 `console.error` 输出 "Resuming session..." 信息，实际是 info 级别，替换时应修正为 `logger.info`。
