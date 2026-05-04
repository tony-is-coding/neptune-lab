# V20 工作总结

> 版本：V20
> 日期：2026-04-29
> 主题：去 UI 耦合 + 死代码清理 + SDK 独立性加固
> Commit：`eb370dd`（已合并到 main）

---

## 一、版本概述

V20 聚焦 SDK 独立性，完成三大目标：**types/ 层彻底消除 React 类型依赖**、**清理 6 个零引用废弃目录/文件**、**SDK 入口补齐缺失导出并支持自定义 Provider 注入**。SDK 用户现在可以在零 React/Ink 依赖的环境下编译和使用 Agent Engine。

---

## 二、变化清单

### 新增
| 变化 | 文件 | 说明 |
|------|------|------|
| UITool 扩展接口 | `src/Tool.ts` | 7 个 render*() 方法从 Tool 主接口分离为 UITool 扩展 |
| Provider 注入配置 | `AgentEngine.ts` | AgentEngineConfig 新增 `providerRegistry` + `circuitBreaker` 字段 |
| Config 模块公共导出 | `engine/index.ts` | IConfigProvider、UnifiedConfig、normalizeConfig、ConfigDiagnostics 等 |
| 日志实现类导出 | `engine/index.ts` | MDC、JsonLogFormatter、ConsoleLogProvider、FileLogStore |
| ProviderType 导出 | `src/index.ts` | CLI 入口补齐 ProviderType 类型 |
| CircuitBreakerConfig 导出 | `engine/provider/index.ts` | 熔断器配置类型公开 |
| ProviderRegistry 注册查找 | `OriginalQueryEngineBridge.ts` | bridge 层支持先查用户注册的 Provider 再 fallback |

### 修改
| 变化 | 文件 | 说明 |
|------|------|------|
| ReactNode → unknown | `types/textInputTypes.ts` | 移除 React/Ink import，ReactNode 替换为 unknown |
| ReactNode → unknown | `types/command.ts` | LocalJSXCommandCall 返回类型从 ReactNode 改为 unknown |
| any → string | `types/spinner.ts` | SpinnerMode 从 any 改为 string |
| CLI 层类型适配 | `claude-code-cli/` 11 文件 | 添加 `as ReactNode` 类型断言，适配核心层 unknown |
| cwd 显式配置 | `AgentEngine.ts` | config.cwd 替代运行时嗅探 |
| CircuitBreaker 封装 | `BaseProvider.ts` | protected → private + public getter |
| toolTypes.ui.ts 修复 | `types/toolTypes.ui.ts` | 修复 Tools/CoreTool 导入作用域问题 |
| jobs/classifier 清理 | `query.ts`、`stopHooks.ts` | 注释掉已删除模块的 require() 引用 |

### 删除
| 变化 | 文件 | 说明 |
|------|------|------|
| 删除废弃目录 | `src/jobs/` | classifier.ts（零外部消费者，TEMPLATES feature 已注释） |
| 删除废弃文件 | `src/proactive/useProactive.ts` | 零引用 |
| 删除废弃二进制 | `src/utils/vendor/ripgrep/` | arm64-darwin 预编译 rg（4.5MB） |
| 删除重复实现 | `engine/compat/NoOpAnalytics.ts` | 与 engine/analytics/ 重复 |
| 删除过程文档 | `engine/types/appstate-audit-report.md` | 审计过程文档 |
| 清理 buddy 残留 | `AppStateStore.ts`、`messages.ts`、`attachments.ts`、`config.ts` | 移除 buddy 功能相关注释和代码 |

### 修复
| 变化 | 说明 |
|------|------|
| engine/index.ts ProviderConfig 重复 | 从 config import 行移除，保留 AgentEngine 导出 |
| dxt/ 目录误删恢复 | 从 main 恢复，dxt 有 plugins 消费者 |
| toolTypes.ui.ts 类型作用域 | 改为 import + re-export 双重声明 |

---

## 三、新增特性列表

### 1. Tool 类型 CoreTool/UITool 分离

**描述**：Tool 接口的 7 个 UI 渲染方法（renderToolUseMessage、renderToolResultMessage 等）分离为 `UITool` 扩展接口。SDK 用户只面对 `CoreTool`（零 UI 依赖），CLI 宿主实现 `UITool` 扩展。

**使用方式**：
```typescript
// SDK 用户 — 只需关注 CoreTool
import type { CoreTool } from 'claude-code/engine'

// CLI 宿主 — 实现 UITool 扩展
import type { UITool } from 'claude-code/types/toolTypes.ui'
```

**影响范围**：SDK 用户不再需要 react 类型定义即可编译。CLI 层通过 toolTypes.ui.ts 获取完整的 React 版本。

### 2. 自定义 Provider 注入

**描述**：AgentEngineConfig 支持传入自定义 ProviderRegistry，SDK 用户可以注册自己的 LLM 后端。

**使用方式**：
```typescript
const engine = await AgentEngine.create({
  providerRegistry: myCustomRegistry,
  circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 30000 }
})
```

**影响范围**：SDK 用户可实现自定义 API 网关、本地模型代理等 Provider。

### 3. Config 模块公共导出

**描述**：统一配置系统（IConfigProvider、UnifiedConfig、normalizeConfig）从 SDK 公共入口导出。

**使用方式**：
```typescript
import { normalizeConfig, ConfigDiagnostics } from 'claude-code/engine'
```

**影响范围**：SDK 用户可直接使用配置校验和诊断能力。

---

## 四、用户体验改进

| 改进项 | 之前 | 之后 |
|--------|------|------|
| SDK React 依赖 | types/ 层引入 ReactNode，SDK 编译需要 @types/react | types/ 层零 React 依赖，SDK 独立编译 |
| Tool 类型接口 | SDK 用户面对 7 个 render*() UI 方法 | SDK 用户只面对 CoreTool（纯逻辑） |
| Provider 扩展 | 硬编码 switch，无法注入自定义 | 支持自定义 ProviderRegistry |
| SDK 入口一致性 | config/log 模块缺失 | engine/index.ts 补齐 config + log 导出 |
| CLI 模块识别 | 无标记 | 31 处 @cli-only 标记，SDK 构建可排除 |

---

## 五、技术改进

| 改进项 | 说明 |
|--------|------|
| types/ 层零 UI 依赖 | textInputTypes.ts、command.ts、spinner.ts 完全移除 React/Ink import |
| Tool 类型分层 | CoreTool（SDK 核心）+ UITool（CLI 扩展）双接口设计 |
| 死代码清理 | 删除 6 个零引用目录/文件，减少 ~30KB + 4.5MB 二进制 |
| SDK 入口统一 | engine/index.ts 新增 19 项导出（config 模块 6 项 + log 实现 5 项 + 类型 8 项） |
| Provider 注入 | 开闭原则：注册自定义 Provider 不影响内置 Provider |
| CLI 标记体系 | @cli-only JSDoc 标记覆盖 15+ 模块，为 SDK 构建排除做准备 |
| initializeEngine 清理 | cwd 显式配置、@deprecated 标记 |
| 编译零新增错误 | V20 所有改动引入的编译错误全部修复 |

---

## 六、已知问题和后续计划

### 遗留技术债
1. **assistant/ 和 coordinator/ 保留**：有 CLI 消费者，仅标记 @cli-only，未迁移到 CLI 层
2. **预存在编译错误**（8 个非测试）：WebFetchTool AxiosHeaders、waitForResult 参数、SQLite 类型
3. **预存在测试失败**（24 个）：LogUtil 单例(10)、AgentEngine 可观测性(9)、OpenAI thinking(3)
4. **穿透依赖**：104 条（V20 未直接处理，V7 KR3 持续推进）

### V21 建议方向
1. 修复 24 个预存在测试失败
2. 继续穿透依赖治理（目标 < 70）
3. SDK 公共 API 补齐（abortQuery、getSessionHistory、isAlive）
4. assistant/coordinator 迁移到 CLI 层

---

## 七、OKR 对齐

### V7 OKR 状态更新

| KR | 描述 | V20 贡献 | 状态变化 |
|----|------|---------|---------|
| KR2 | SDK 入口完全统一 | config 模块 + log 实现类导出补齐 | ⚠️ → ✅ 大部分完成（ProviderType 已导出） |
| KR4 | 文档全面同步 | 三份核心文档已更新 | ✅ 完成 |
| KR5 | 穿透依赖 < 50 条 | 未直接处理 | ⚠️ 持续推进 |
| KR6 | IConfigProvider 公共导出 | engine/index.ts 已导出 | ✅ 完成 |

### V20 新发现的问题（加入后续 KR）

| 新 KR | 描述 | 优先级 |
|-------|------|--------|
| V7-KR7 | 预存在测试失败修复（24 个） | P1 |
| V7-KR8 | 预存在编译错误修复（8 个非测试） | P2 |

---

## 八、文档维护记录

### 已更新
| 文档 | 更新内容 |
|------|---------|
| `docs/okr-roadmap.md` | V7-V9 规划新增、缺陷状态更新、里程碑 M7-M9 新增 |
| `docs/architecture-design.md` | engine/ 文件数 55→172、Provider CircuitBreaker 描述、IBackend/ITracingProvider/IConfigProvider 补充 |
| `docs/project-purpose.md` | SDK 核心文件数 125→238、provider.type + toolsets 配置示例 |

### 无需更新
| 文档 | 原因 |
|------|------|
| `docs/feature-design/` | 无功能设计变更 |
| `.tmp_docs/` | 目录为空，无需清理 |

---

## 九、数据总结

| 指标 | 数值 |
|------|------|
| 改动文件 | 67 |
| 新增行数 | +1,088 |
| 删除行数 | -585 |
| 删除目录/文件 | 6 个 |
| @cli-only 标记 | 31 处 |
| SDK 新增导出 | 19 项 |
| 编译新增错误 | 0 |
| 测试新增失败 | 0 |
| engine/ React import | 0 |
