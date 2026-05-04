# V12 任务计划

> 创建时间：2026-04-28
> 基于文档：auto-upgrade/v12/01-optimizer-research.md
> 覆盖范围：12 个优化点，14 个可执行任务，3 阶段交付

---

## 一、项目概述

V12 聚焦于 V11 后暴露的 SDK 可用性和生产就绪问题。核心目标：**SDK 用户能跑通第一个 Hello World**。

12 个优化点转化为 14 个可执行任务，分 3 阶段交付。3 名开发者并行推进，按依赖关系调度。

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 能力要求 |
|------|------|------|---------|
| team-lead | 1 | 协调任务分配、进度管理、合并决策 | 全局视野、风险判断 |
| developer-1 | 1 | SDK API 表面修复 + 导出层 + e2e_cli 对齐 | 精通 TypeScript 公共 API 设计、熟悉 package.json exports |
| developer-2 | 1 | Provider 重构 + 错误体系 + 测试 | 熟悉 engine/provider/ 架构、单元测试编写 |
| developer-3 | 1 | 测试 + 资源管理 + 配置 + feature 兼容 | 熟悉 engine/ 生命周期管理、测试框架 |

**协作方式**：
- developer-1 负责"SDK 对外可见性"（API、导出、示例、e2e_cli）
- developer-2 负责"Provider 质量"（抽象提取、错误分类、Provider 测试）
- developer-3 负责"引擎基础设施"（测试、资源管理、配置、feature 兼容）
- team-lead 负责合并、冲突解决、CI 集成

---

## 三、任务阶段规划

### 阶段 A：基础修复（6 个任务，无依赖可并行）

**小目标**：SDK 示例可运行 + Provider 不重复 + 有基础测试

| 任务 | 执行人 | 并行度 | 影响文件 |
|------|--------|--------|---------|
| T1 SDK API 修复 + 示例对齐 | developer-1 | 独立 | ~8 文件（index.ts + 3 示例 + AgentEngine.ts） |
| T2 Provider Base 抽象提取 | developer-2 | 独立 | ~8 文件（BaseProvider + 7 Provider） |
| T3 核心类单元测试 Part1 | developer-3 | 独立 | ~3 文件（EventBus/SessionManager/ProviderRegistry 测试） |
| T4 SDK 配置校验修复 | developer-1 | T1后 | ~2 文件（AgentEngine.ts + 校验函数） |
| T5 死代码清理 + FilesystemBackend 修复 | developer-2 | T2后 | ~4 文件（context/ + FilesystemBackend + CoreAppState） |
| T6 lint-layers CI 集成 | team-lead | 独立 | ~2 文件（CI yml + lint-layers.sh） |

**门禁**：3 个示例 tsc 通过 + Provider 代码量减少 25%+ EventBus 测试通过

### 阶段 B：质量加固（4 个任务）

**小目标**：资源不泄漏 + 导出干净 + 跨运行时

| 任务 | 执行人 | 并行度 | 影响文件 |
|------|--------|--------|---------|
| T7 核心类单元测试 Part2 | developer-3 | T3后 | ~2 文件（AgentEngine/EngineFacade 测试） |
| T8 SDK 导出层清理 + package.json | developer-1 | T4后 | ~4 文件（index.ts + bootstrap/state + package.json + engine/index） |
| T9 资源管理闭环 | developer-3 | T7后 | ~3 文件（AgentEngine + SessionManager + gracefulShutdown） |
| T10 feature() SDK 兼容 | developer-1 | T8后 | ~3 文件（featureCompat.ts + initializeEngine + AgentEngine） |

**门禁**：destroy() 资源释放验证 + 导出层 tsc 通过 + feature 兼容函数测试通过

### 阶段 C：生产就绪（4 个任务）

**小目标**：错误可分类 + analytics 可选 + e2e_cli 验证

| 任务 | 执行人 | 并行度 | 影响文件 |
|------|--------|--------|---------|
| T11 Provider 错误分类 | developer-2 | T2,T5后 | ~4 文件（errors.ts + BaseProvider + EventBus） |
| T12 analytics 核心路径解耦 | developer-1 | T10后 | ~5 文件（analytics 接口 + tools.ts + QueryEngine.ts） |
| T13 e2e_cli 公共 API 对齐 | developer-3 | T8后 | ~5 文件（e2e_cli 源文件） |
| T14 Provider 适配器测试 | developer-2 | T11后 | ~2 文件（6 个 Provider 测试文件） |

**门禁**：e2e_cli workspace 引用通过 + Provider 错误可分类 + analytics 可跳过

---

## 四、任务清单

### T1: SDK API 修复 + 示例对齐
| 字段 | 内容 |
|------|------|
| **目标** | 修复 SDK 公共 API 使 3 个示例可运行 |
| **执行人** | developer-1 |
| **依赖** | 无 |
| **实施要点** | 1) 修复 query() 签名说明/示例 — 当前 `query(sessionId, input: string)` 但示例传对象; 2) 补充 src/index.ts 缺失类型导出: SessionInfo, SkillExtension, ToolExtension, PermissionConfig, ProviderType; 3) 重写 3 个 examples/ 文件使 API 调用正确: express-server.ts 用 `query(sid, 'prompt')` + `for await`; sse-server.ts 同理; custom-cli.ts 同理 |
| **验收标准** | `bunx tsc --noEmit` 零错误; 3 个示例文件 tsc 通过; 所有新导出类型在 index.ts 中可查 |

### T2: Provider Base 抽象提取
| 字段 | 内容 |
|------|------|
| **目标** | 提取 BaseProvider 消除 26% 代码重复 |
| **执行人** | developer-2 |
| **依赖** | 无 |
| **实施要点** | 1) 创建 `engine/provider/adapters/BaseProvider.ts` 抽象类; 2) 包含: buildOptions(params) 返回具体类型(非any)、convertToProviderMessage(event)、createErrorResponse(error); 3) 7 个 Provider 继承 BaseProvider，各自只保留 query() 的 API 差异; 4) 确保 tsc 零错误 |
| **验收标准** | Provider 适配器总代码量减少 25%+; buildOptions 返回类型非 any; tsc 零错误; ProviderRegistry 注册 7 个 Provider 仍正常 |

### T3: 核心类单元测试 Part1
| 字段 | 内容 |
|------|------|
| **目标** | EventBus + SessionManager + ProviderRegistry 单元测试 |
| **执行人** | developer-3 |
| **依赖** | 无 |
| **实施要点** | 1) EventBus 测试: emit/on/off/once/TTL自动清理/clear/无监听器时不报错; 2) SessionManager 测试: createSession/destroySession/getSession/listSessions/maxConcurrent限制/workspace唯一性/GC触发; 3) ProviderRegistry 测试: register/get/getGlobal/clear/重复注册/未注册type; 4) 使用 MockCCRuntime 避免依赖真实 CC 运行时 |
| **验收标准** | 3 个测试文件 +80 用例; `bun test` 全部通过 |

### T4: SDK 配置校验修复
| 字段 | 内容 |
|------|------|
| **目标** | SDK 模式下 AgentEngineConfig 有独立校验 |
| **执行人** | developer-1 |
| **依赖** | T1 |
| **实施要点** | 1) 创建 `validateAgentEngineConfig(config)` 函数; 2) 校验: systemPrompt 非空字符串或函数、extensions.tools 是数组、provider.type 为 7 个有效值之一; 3) AgentEngine.create() 调用此校验（不依赖 cwd）; 4) 错误信息包含配置项名+期望格式 |
| **验收标准** | 传入空 config 不崩溃; 传入无效 provider.type 抛 EngineError(CONFIGURATION_ERROR); 错误信息包含具体配置项名 |

### T5: 死代码清理 + FilesystemBackend 修复
| 字段 | 内容 |
|------|------|
| **目标** | 清理死代码 + 修复原子写入 bug |
| **执行人** | developer-2 |
| **依赖** | T2 |
| **实施要点** | 1) context/OffloadStrategy+DefaultOffloadStrategy 添加 `@internal` JSDoc 标记 + 在 index.ts 注释说明"预留接口，待上下文卸载集成后使用"; 2) FilesystemBackend.write() 修复: 写入 tempPath → fs.rename(tempPath, filePath) 真正原子操作; 3) CoreAppState.ts 的 createDefaultCoreAppState() 迁移到 engine/state/CoreAppStateFactory.ts（types/ 只留类型） |
| **验收标准** | FilesystemBackend 原子写入测试通过; CoreAppState.ts 无 require() 调用; tsc 零错误 |

### T6: lint-layers CI 集成
| 字段 | 内容 |
|------|------|
| **目标** | lint-layers.sh 加入 GitHub Actions |
| **执行人** | team-lead |
| **依赖** | 无 |
| **实施要点** | 1) 在 .github/workflows/ 中找到或创建 ci.yml; 2) 添加 lint-layers 步骤: `cd claude-code && bash scripts/lint-layers.sh`; 3) 失败条件: P0 穿透 >0 或 P1 穿透比上次新增 |
| **验收标准** | CI yml 包含 lint-layers 步骤; 本地 `bash scripts/lint-layers.sh` 返回有意义的退出码 |

### T7: 核心类单元测试 Part2
| 字段 | 内容 |
|------|------|
| **目标** | AgentEngine + EngineFacade 单元测试 |
| **执行人** | developer-3 |
| **依赖** | T3 |
| **实施要点** | 1) AgentEngine 测试: create()成功/create()配置校验/createSession()/query()返回AsyncGenerator/on()/off()/once()/destroy()/getStats(); 2) EngineFacade 测试: createSession()/destroySession()/getSession()/query()事件传播; 3) 使用 MockCCRuntime + MockProviderAdapter |
| **验收标准** | 2 个测试文件 +60 用例; `bun test` 全部通过; engine/ 测试总用例 200+ |

### T8: SDK 导出层清理 + package.json 修复
| 字段 | 内容 |
|------|------|
| **目标** | SDK 导出干净、package.json 发布就绪 |
| **执行人** | developer-1 |
| **依赖** | T4 |
| **实施要点** | 1) bootstrap/state.ts 的 `export *` 替换为选择性导出（只导出 SDK 需要的 ~20 个 getter/setter）; 2) package.json 添加 `"types"` 字段指向构建产物; 3) package.json exports 补充 `"./engine": "./src/engine/index.ts"` 等子路径; 4) engine/index.ts 补充 BedrockProvider 等 6 个 Provider + context 模块导出 |
| **验收标准** | `export * from './bootstrap/state.js'` 不再出现; package.json 有 types 字段; engine/index.ts 导出全部 7 个 Provider; tsc 零错误 |

### T9: 资源管理闭环
| 字段 | 内容 |
|------|------|
| **目标** | AgentEngine.destroy() 完整释放资源 + 优雅关机 |
| **执行人** | developer-3 |
| **依赖** | T7 |
| **实施要点** | 1) destroy() 添加: facade.dispose() 调用（清理 sessions Map + sessionMetadata + tokenBudgetStates）; 2) AgentEngineConfig 支持注入 ISessionStore，destroy() 调用 store.dispose(); 3) 创建 engine/lifecycle/gracefulShutdown.ts: 注册 SIGINT/SIGTERM → engine.destroy(); 4) 添加 engine.enableGracefulShutdown() 方法（SDK 用户主动调用） |
| **验收标准** | destroy() 后 engine 状态为 destroyed; ISessionStore.dispose() 被调用; gracefulShutdown 注册/取消正常工作 |

### T10: feature() SDK 模式兼容
| 字段 | 内容 |
|------|------|
| **目标** | engine/ 中 feature() 在非 Bun 环境正常工作 |
| **执行人** | developer-1 |
| **依赖** | T8 |
| **实施要点** | 1) 创建 engine/compat/featureCompat.ts: 检测 bun:bundle 可用性，不可用时返回 false; 2) 提供 FeatureOverride 接口: AgentEngineConfig.options.features 可覆盖特定 flag; 3) initializeEngine.ts 中 `feature('COORDINATOR_MODE')` 替换为 compat 函数; 4) 确保不破坏 Bun 环境下的原始行为 |
| **验收标准** | engine/ 在模拟的 non-Bun 环境下 tsc 通过; Bun 环境下原有行为不变; 可通过 config 覆盖 flag |

### T11: Provider 错误分类
| 字段 | 内容 |
|------|------|
| **目标** | Provider 错误细分为可操作类型 |
| **执行人** | developer-2 |
| **依赖** | T2, T5 |
| **实施要点** | 1) EngineErrorCode 添加: AUTH_ERROR, RATE_LIMIT, NETWORK_ERROR, PROVIDER_NOT_FOUND; 2) BaseProvider.createErrorResponse() 根据 API 错误类型映射; 3) EventBus.emit() 的 catch 块添加 error 事件类型（不再静默吞没）; 4) 保持向后兼容: EXECUTION_ERROR 仍存在，新增错误是更具体的子类型 |
| **验收标准** | Provider API 错误返回对应 EngineErrorCode; EventBus emit 失败触发 'error' 事件; 现有错误处理代码不破坏 |

### T12: analytics 核心路径解耦
| 字段 | 内容 |
|------|------|
| **目标** | SDK 模式下核心路径零 analytics 开销 |
| **执行人** | developer-1 |
| **依赖** | T10 |
| **实施要点** | 1) 创建 engine/compat/NoOpAnalytics.ts: logEvent/isEnabled 等方法的空实现; 2) tools.ts 和 QueryEngine.ts 的 logEvent 调用改为通过注入的 analytics 接口; 3) SDK 模式自动使用 NoOpAnalytics; 4) 不删除 analytics 模块本身，只是解耦调用链 |
| **验收标准** | SDK 模式下 `import { AgentEngine }` 不触发 analytics 模块加载; CLI 模式下 analytics 仍正常工作 |

### T13: e2e_cli 公共 API 对齐
| 字段 | 内容 |
|------|------|
| **目标** | e2e_cli 使用公共 API 而非深层路径 |
| **执行人** | developer-3 |
| **依赖** | T8 |
| **实施要点** | 1) 读取 e2e_cli 源文件，找出所有 `from 'claude-code-best/engine/...'` 深层 import; 2) 逐一替换为 `from 'claude-code-best'` 或 `from 'claude-code-best/engine'`（子路径导出）; 3) 如有缺失导出，补充到 src/index.ts; 4) 验证 e2e_cli tsc 通过 |
| **验收标准** | e2e_cli 零深层 import（`from 'claude-code-best/src/...'` 或 `from 'claude-code-best/engine/xxx/...'`）; workspace 引用 tsc 零错误 |

### T14: Provider 适配器测试
| 字段 | 内容 |
|------|------|
| **目标** | 6 个缺失 Provider 适配器的基础测试 |
| **执行人** | developer-2 |
| **依赖** | T11 |
| **实施要点** | 1) 为 BedrockProvider、VertexProvider、FoundryProvider、OpenAIProvider、GeminiProvider、GrokProvider 各创建测试文件; 2) 测试: type 属性正确、getConfig 返回配置、query 返回 AsyncGenerator; 3) Mock 底层 API 调用避免真实网络请求 |
| **验收标准** | 6 个测试文件创建; 每个 Provider 至少 3 个用例; `bun test` 全部通过 |

---

## 五、执行时间线

```
阶段 A（并行）:
  developer-1: T1 ─→ T4
  developer-2: T2 ─→ T5
  developer-3: T3 ─→ T6（team-lead）

阶段 B（串行+并行）:
  developer-1: T8 ─→ T10
  developer-2: (等阶段 C)
  developer-3: T7 ─→ T9

阶段 C（并行）:
  developer-1: T12
  developer-2: T11 ─→ T14
  developer-3: T13
```

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| T9 destroy() 修改影响现有行为 | 资源释放不完整或过度释放 | T7 先写测试覆盖 destroy 流程 |
| T12 analytics 解耦改核心路径 | CLI 功能回归 | 保持 CLI 入口不变，只改 SDK 模式 |
| T8 导出层调整影响 e2e_cli | 编译失败 | T13 紧跟 T8 修复对齐 |
| T2 Provider 重构引入类型错误 | tsc 失败 | 重构后立即 tsc 验证 |
