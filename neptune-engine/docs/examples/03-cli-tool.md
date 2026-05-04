# 示例 3：CLI 工具（Headless 自动化）

本示例展示如何使用 Agent Engine SDK 创建一个功能完整的 CLI 工具，支持自动化脚本、批处理和 CI/CD 集成。

## 场景

创建一个 CLI 工具 `claude-ai`，支持：
1. 交互式对话模式
2. 单次查询模式
3. 文件处理模式（分析、转换、生成）
4. 脚本自动化模式
5. 配置文件支持

## 完整代码

创建 `examples/cli-tool.ts`：

```typescript
#!/usr/bin/env bun
/**
 * CLI 工具示例 - Claude AI 命令行工具
 *
 * 功能：
 * - 交互式对话
 * - 单次查询
 * - 文件处理
 * - 自动化脚本
 * - 配置管理
 */

import { AgentEngine, collectText, waitForResult } from '@agent-engine/bootstrap'
import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { z } from 'zod'

// ============================================================
// 配置类型
// ============================================================

interface Config {
  apiKey?: string
  model?: string
  systemPrompt?: string
  workspace?: string
  bypassPermissions?: boolean
  timeout?: number
}

// ============================================================
// 配置管理
// ============================================================

const DEFAULT_CONFIG: Config = {
  model: 'claude-sonnet-4-20250514',
  systemPrompt: '你是一个高效的 AI 助手',
  workspace: './workspace/cli-tool',
  bypassPermissions: true,
  timeout: 120000 // 2 分钟
}

function loadConfig(configPath?: string): Config {
  const paths = [
    configPath,
    './claude.config.json',
    './.claude.json',
    `${process.env.HOME}/.claude/config.json`
  ].filter(Boolean) as string[]

  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8')
        return { ...DEFAULT_CONFIG, ...JSON.parse(content) }
      }
    } catch {
      continue
    }
  }

  return DEFAULT_CONFIG
}

// ============================================================
// Engine 工厂
// ============================================================

function createEngine(config: Config) {
  return AgentEngine.create({
    systemPrompt: config.systemPrompt,
    extensions: {
      permissions: {
        bypassPermissions: config.bypassPermissions ?? true
      }
    },
    options: {
      workspaceRoot: config.workspace
    },
    provider: config.model ? {
      type: 'anthropic',
      config: { model: config.model }
    } : undefined
  })
}

// ============================================================
// CLI 应用
// ============================================================

const program = new Command()

program
  .name('claude-ai')
  .description('Claude AI 命令行工具')
  .version('1.0.0')

// 全局选项
program
  .option('-c, --config <path>', '配置文件路径')
  .option('-k, --api-key <key>', 'API 密钥')
  .option('-m, --model <model>', '模型名称')
  .option('-w, --workspace <path>', '工作区目录')
  .option('--timeout <ms>', '超时时间（毫秒）', String(DEFAULT_CONFIG.timeout))

// ============================================================
// 命令：交互模式
// ============================================================

program
  .command('chat', { isDefault: true })
  .description('启动交互式对话')
  .option('-s, --system-prompt <prompt>', '系统提示词')
  .action(async (options) => {
    const config = loadConfig(program.opts().config)
    const globalOpts = program.opts()

    // 合并选项
    if (globalOpts.apiKey) config.apiKey = globalOpts.apiKey
    if (globalOpts.model) config.model = globalOpts.model
    if (globalOpts.workspace) config.workspace = globalOpts.workspace
    if (options.systemPrompt) config.systemPrompt = options.systemPrompt

    // 检查 API Key
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('❌ 错误: 请设置 ANTHROPIC_API_KEY 环境变量或在配置中指定 apiKey')
      process.exit(1)
    }

    // 创建引擎
    const engine = createEngine(config)
    const sessionId = await engine.createSession({
      workspace: config.workspace
    })

    // 创建 REPL
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '👤 你: ',
      history: []
    })

    console.log()
    console.log('🤖 Claude AI 交互模式已启动')
    console.log('   输入消息开始对话，输入 /exit 或 Ctrl+D 退出')
    console.log('   输入 /clear 清空会话历史')
    console.log('   输入 /save <path> 保存对话历史')
    console.log()

    rl.prompt()

    const history: Array<{ role: string; content: string }> = []

    rl.on('line', async (input) => {
      const trimmed = input.trim()

      // 命令处理
      if (trimmed === '/exit' || trimmed === '/quit') {
        console.log('👋 再见！')
        rl.close()
        await engine.destroySession(sessionId)
        process.exit(0)
        return
      }

      if (trimmed === '/clear') {
        // 销毁旧会话，创建新会话
        await engine.destroySession(sessionId)
        const newSessionId = await engine.createSession({
          workspace: config.workspace
        })
        sessionId = newSessionId
        history.length = 0
        console.log('✓ 会话已清空')
        rl.prompt()
        return
      }

      if (trimmed.startsWith('/save ')) {
        const savePath = trimmed.slice(6).trim()
        try {
          fs.writeFileSync(savePath, JSON.stringify(history, null, 2))
          console.log(`✓ 对话历史已保存到 ${savePath}`)
        } catch (error) {
          console.error('❌ 保存失败:', error)
        }
        rl.prompt()
        return
      }

      if (!trimmed) {
        rl.prompt()
        return
      }

      // 保存用户消息
      history.push({ role: 'user', content: trimmed })

      // 执行查询
      process.stdout.write('🤖 AI: ')

      try {
        const messages = engine.query(sessionId, trimmed)
        const response = await collectText(messages)

        console.log(response)
        console.log()

        // 保存 AI 响应
        history.push({ role: 'assistant', content: response })
      } catch (error) {
        console.error('❌ 错误:', error)
        console.log()
      }

      rl.prompt()
    })

    rl.on('close', async () => {
      await engine.destroySession(sessionId)
      process.exit(0)
    })
  })

// ============================================================
// 命令：单次查询
// ============================================================

program
  .command('query <message>')
  .description('执行单次查询')
  .option('-s, --system-prompt <prompt>', '系统提示词')
  .option('-j, --json', '以 JSON 格式输出')
  .action(async (message, options) => {
    const config = loadConfig(program.opts().config)
    const globalOpts = program.opts()

    if (globalOpts.apiKey) config.apiKey = globalOpts.apiKey
    if (globalOpts.model) config.model = globalOpts.model
    if (globalOpts.workspace) config.workspace = globalOpts.workspace
    if (options.systemPrompt) config.systemPrompt = options.systemPrompt

    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('❌ 错误: 请设置 ANTHROPIC_API_KEY')
      process.exit(1)
    }

    const engine = createEngine(config)
    const sessionId = await engine.createSession({
      workspace: config.workspace
    })

    try {
      const messages = engine.query(sessionId, message)
      const response = await collectText(messages)

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          response,
          timestamp: Date.now()
        }, null, 2))
      } else {
        console.log(response)
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2))
      } else {
        console.error('❌ 错误:', error)
      }
      process.exit(1)
    } finally {
      await engine.destroySession(sessionId)
    }
  })

// ============================================================
// 命令：文件处理
// ============================================================

program
  .command('file <action> <path>')
  .description('文件处理：analyze | summarize | refactor | explain')
  .option('-o, --output <path>', '输出文件路径')
  .action(async (action, filePath, options) => {
    const validActions = ['analyze', 'summarize', 'refactor', 'explain']
    if (!validActions.includes(action)) {
      console.error(`❌ 无效的操作: ${action}`)
      console.error(`   有效操作: ${validActions.join(', ')}`)
      process.exit(1)
    }

    const config = loadConfig(program.opts().config)
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('❌ 错误: 请设置 ANTHROPIC_API_KEY')
      process.exit(1)
    }

    // 读取文件
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`)
      process.exit(1)
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    const ext = path.extname(filePath)
    const filename = path.basename(filePath)

    // 根据操作构建提示词
    const prompts = {
      analyze: `请分析以下 ${filename} 文件的代码结构和功能：\n\n${content}`,
      summarize: `请总结以下 ${filename} 文件的主要功能和要点：\n\n${content}`,
      refactor: `请重构以下 ${filename} 文件的代码，使其更清晰、高效：\n\n${content}`,
      explain: `请详细解释以下 ${filename} 文件的代码逻辑：\n\n${content}`
    }

    const engine = createEngine(config)
    const sessionId = await engine.createSession()

    try {
      const messages = engine.query(sessionId, prompts[action as keyof typeof prompts])
      const response = await collectText(messages)

      if (options.output) {
        fs.writeFileSync(options.output, response)
        console.log(`✓ 结果已保存到 ${options.output}`)
      } else {
        console.log(response)
      }
    } catch (error) {
      console.error('❌ 错误:', error)
      process.exit(1)
    } finally {
      await engine.destroySession(sessionId)
    }
  })

// ============================================================
// 命令：批量处理
// ============================================================

program
  .command('batch <file>')
  .description('从文件读取多个查询并批量执行')
  .option('-o, --output <path>', '输出结果文件')
  .action(async (inputFile, options) => {
    const config = loadConfig(program.opts().config)
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('❌ 错误: 请设置 ANTHROPIC_API_KEY')
      process.exit(1)
    }

    // 读取查询文件
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ 文件不存在: ${inputFile}`)
      process.exit(1)
    }

    const inputContent = fs.readFileSync(inputFile, 'utf-8')
    const queries = inputContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))

    console.log(`📋 准备执行 ${queries.length} 个查询`)

    const engine = createEngine(config)
    const results: Array<{ query: string; response: string; success: boolean }> = []

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i]
      console.log(`\n[${i + 1}/${queries.length}] ${query.substring(0, 50)}...`)

      const sessionId = await engine.createSession()

      try {
        const messages = engine.query(sessionId, query)
        const response = await collectText(messages)

        results.push({ query, response, success: true })
        console.log('✓ 完成')
      } catch (error) {
        results.push({
          query,
          response: error instanceof Error ? error.message : String(error),
          success: false
        })
        console.log('✗ 失败')
      } finally {
        await engine.destroySession(sessionId)
      }
    }

    // 输出结果
    const output = options.output || inputFile + '.result.json'
    fs.writeFileSync(output, JSON.stringify(results, null, 2))
    console.log(`\n✓ 结果已保存到 ${output}`)

    // 统计
    const successCount = results.filter(r => r.success).length
    console.log(`\n📊 统计: ${successCount}/${queries.length} 成功`)
  })

// ============================================================
// 命令：配置管理
// ============================================================

program
  .command('config')
  .description('管理配置文件')
  .option('--init', '创建默认配置文件')
  .option('--show', '显示当前配置')
  .action(async (options) => {
    const configPath = './claude.config.json'

    if (options.init) {
      if (fs.existsSync(configPath)) {
        console.log('⚠️  配置文件已存在')
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        })

        const answer = await new Promise<string>(resolve => {
          rl.question('是否覆盖？(y/N) ', resolve)
        })
        rl.close()

        if (answer.toLowerCase() !== 'y') {
          console.log('已取消')
          return
        }
      }

      fs.writeFileSync(
        configPath,
        JSON.stringify(DEFAULT_CONFIG, null, 2)
      )
      console.log(`✓ 配置文件已创建: ${configPath}`)
      console.log('  请编辑文件添加你的 API Key')
      return
    }

    if (options.show) {
      const config = loadConfig(program.opts().config)
      console.log(JSON.stringify(config, null, 2))
      return
    }

    console.log('使用 --init 创建配置文件，或 --show 查看当前配置')
  })

// ============================================================
// 解析命令行参数
// ============================================================

program.parse()

// ============================================================
// 帮助信息（无参数时显示）
// ============================================================

if (!process.argv.slice(2).length) {
  program.outputHelp()
}
```

## 使用方法

### 1. 安装依赖

```bash
# 添加依赖
bun add commander zod

# 添加类型定义
bun add -d @types/node
```

### 2. 设置权限

```bash
chmod +x examples/cli-tool.ts
```

### 3. 创建配置文件

```bash
bun run examples/cli-tool.ts config --init
```

编辑 `claude.config.json`：

```json
{
  "apiKey": "your-api-key",
  "model": "claude-sonnet-4-20250514",
  "systemPrompt": "你是一个高效的 AI 助手",
  "workspace": "./workspace/cli-tool",
  "bypassPermissions": true,
  "timeout": 120000
}
```

### 4. 运行命令

#### 交互模式

```bash
bun run examples/cli-tool.ts
# 或
bun run examples/cli-tool.ts chat
```

#### 单次查询

```bash
bun run examples/cli-tool.ts query "解释 TypeScript 的泛型"
```

JSON 输出：

```bash
bun run examples/cli-tool.ts query "你好" --json
```

#### 文件处理

```bash
# 分析文件
bun run examples/cli-tool.ts file analyze src/index.ts

# 总结文件
bun run examples/cli-tool.ts file summarize README.md

# 重构代码
bun run examples/cli-tool.ts file refactor old-code.js -o refactored-code.js

# 解释代码
bun run examples/cli-tool.ts file explain complex-function.ts
```

#### 批量处理

创建 `queries.txt`：

```
# 查询列表（以 # 开头的是注释）

解释什么是闭包
解释什么是 Promise
解释什么是 async/await
```

运行：

```bash
bun run examples/cli-tool.ts batch queries.txt
```

结果会保存到 `queries.txt.result.json`。

## CI/CD 集成示例

### GitHub Actions

```yaml
name: Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run AI Code Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          # 获取变更的文件
          CHANGED_FILES=$(git diff --name-only origin/main...HEAD)

          # 为每个文件运行分析
          for file in $CHANGED_FILES; do
            if [[ $file == *.ts ]] || [[ $file == *.js ]]; then
              echo "Analyzing $file..."
              bun run examples/cli-tool.ts file analyze "$file" > "review-$file.txt"
            fi
          done

      - name: Upload review results
        uses: actions/upload-artifact@v3
        with:
          name: code-reviews
          path: review-*.txt
```

### Git Hook（自动代码审查）

创建 `.git/hooks/pre-commit`：

```bash
#!/bin/bash

# 获取暂存的文件
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

for file in $STAGED_FILES; do
  if [[ $file == *.ts ]] || [[ $file == *.js ]]; then
    echo "AI 审查 $file..."

    result=$(bun run examples/cli-tool.ts query "请简要审查以下代码是否有明显问题：\n$(cat $file)" 2>&1)

    if echo "$result" | grep -qi "错误\|问题\|bug"; then
      echo "⚠️  AI 发现潜在问题："
      echo "$result"
      echo ""
      read -p "是否继续提交？(y/N) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
      fi
    fi
  fi
done
```

## 自动化脚本示例

### 代码重构脚本

```typescript
#!/usr/bin/env bun
/**
 * 自动化重构脚本
 */

const { execSync } = require('child_process')

// 获取所有 TypeScript 文件
const files = execSync('find src -name "*.ts"', { encoding: 'utf-8' })
  .split('\n')
  .filter(Boolean)

for (const file of files) {
  console.log(`处理 ${file}...`)

  execSync(
    `bun run examples/cli-tool.ts file refactor "${file}" -o "${file}.refactored"`,
    { stdio: 'inherit' }
  )

  // 备份原文件
  execSync(`mv "${file}" "${file}.backup"`)
  // 使用重构后的文件
  execSync(`mv "${file}.refactored" "${file}"`)
}
```

### 批量文档生成

```typescript
#!/usr/bin/env bun
/**
 * 为所有 TypeScript 文件生成文档
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const srcDir = 'src'
const docsDir = 'docs/api'

// 确保文档目录存在
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true })
}

// 递归获取所有文件
function getFiles(dir, ext) {
  const files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath, ext))
    } else if (entry.name.endsWith(ext)) {
      files.push(fullPath)
    }
  }

  return files
}

const files = getFiles(srcDir, '.ts')

for (const file of files) {
  const relativePath = path.relative(srcDir, file)
  const docPath = path.join(docsDir, relativePath.replace('.ts', '.md'))

  console.log(`生成文档: ${relativePath}`)

  const content = fs.readFileSync(file, 'utf-8')
  const prompt = `请为以下代码生成 API 文档（Markdown 格式）：\n\n${content}`

  try {
    const result = execSync(
      `bun run examples/cli-tool.ts query "${prompt.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8' }
    )

    // 确保输出目录存在
    const outputDir = path.dirname(docPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    fs.writeFileSync(docPath, result)
    console.log(`  ✓ 已保存到 ${docPath}`)
  } catch (error) {
    console.error(`  ✗ 失败: ${error.message}`)
  }
}
```

## 关键点说明

### 1. Commander.js 集成

```typescript
import { Command } from 'commander'

const program = new Command()

program
  .command('query <message>')
  .description('执行单次查询')
  .option('-j, --json', '以 JSON 格式输出')
  .action((message, options) => {
    // 处理命令
  })
```

### 2. 配置管理

```typescript
function loadConfig(configPath?: string): Config {
  // 尝试多个路径
  const paths = [
    configPath,
    './claude.config.json',
    `${process.env.HOME}/.claude/config.json`
  ]

  for (const p of paths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  }

  return DEFAULT_CONFIG
}
```

### 3. 交互式输入

```typescript
import * as readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.question('问题', (answer) => {
  // 处理答案
  rl.close()
})
```

### 4. 超时控制

```typescript
import { waitForResultWithTimeout } from '@agent-engine/bootstrap'

const messages = engine.query(sessionId, input)
const result = await waitForResultWithTimeout(messages, timeout)

if (!result.success && result.error === 'TIMEOUT') {
  console.error('查询超时')
}
```

## 相关文档

- [快速开始指南](../getting-started.md)
- [API 文档](../api/)
- [示例 1：嵌入式 SDK](./01-embedded-sdk.md)
- [示例 2：Web 服务](./02-web-service.md)
