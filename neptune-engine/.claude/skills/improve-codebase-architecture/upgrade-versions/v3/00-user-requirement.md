# V3 用户需求文档

## 优化主题
目标架构差距分析（Gap Analysis）

## 需求来源
用户主动提出，基于完整的目标 packages 分层架构图，要求分析当前代码与目标架构的差距。

## 目标架构概览

用户给出了完整的目标架构，包含以下分层：

### 核心引擎层 — packages/agent
- query()（streaming/recovery/attachments/abort）
- QueryEngine（turn管理/compaction/SDK消息转换/budget追踪）
- HookLifecycle（27种事件：PreToolUse/PostToolUse/Notification/Stop/SubagentStop/UserPromptSubmit/SessionStart/End/PreCompact/PostCompact/Permission*等）
- CompactionService（snip/micro/auto）
- CronScheduler（定时任务/抖动）
- LocalMainSessionTask（15373行 → 分解重构）
- QueryDeps（依赖注入）

### 适配器层 — packages/provider
- ProviderAdapter（queryStream/query/isAvailable/listModels）
- AuthProvider（getCredentials/refresh/invalidate）
- StreamAdapter（SSE/WS/流 → 统一内部事件格式）
- ContextProvider（可插拔 prompt 管线：GitStatus → ClaudeMd → Date → Attribution → ...）
- NetworkLayer（Proxy/mTLS/CA证书/Upstream Proxy）

### 具体实现层 — Implementation
- LLM Providers: Anthropic/OpenAI/Gemini/Mistral/Bedrock/Vertex/通义千问/本地推理
- Auth Implementations: AnthropicOAuth/APIKey/AWS(Bedrock IAM)/GCP(Vertex ADC)/Azure
- Storage Backends: LocalFile(JSONL)/RemoteAPI/Memory

### UI 层 — packages/ink
- reconciler/hooks(useInput等)/components
- Keybinding 系统（可配置键绑定/模式解析/冲突解决）
- Vim Emulation（motions/operators/text objects）
- Typeahead（命令/文件建议/模糊搜索/ghost text）
- InkConfig（12个注入点）

### 基础设施层
- **packages/agent-tools**: Tool interface + 54 工具实现、Sandbox 系统、ModelDeps
- **packages/shell**: ShellProvider 接口、Bash/Zsh/PowerShell 实现
- **packages/config**: SettingsManager（7层优先级合并）、FeatureFlagProvider、GlobalConfig
- **packages/telemetry**: AnalyticsEventEmitter、GrowthBook客户端、Datadog日志、SessionTracer

### 领域系统
- **packages/memory**: MemoryStore/MemoryRecall/MemoryExtract/MemoryConsolidation
- **packages/permission**: PermissionMode/PermissionPipeline/RuleStore/AutoClassifier

### 扩展系统（Phase 5）
- ToolRegistry（内置/MCP/Plugin/用户自定义）
- OutputTarget（Terminal/JSON/Web/Silent）
- packages/swarm（多Agent协调：Backends/PermissionSync/TeammateMailbox/Worktree管理）
- packages/ide（VS Code/JetBrains/LSP Client/Code Indexing/Claude-in-Chrome）
- packages/server（DirectConn/LockFile）
- packages/teleport（环境选择/Git打包/API集成）
- packages/updater（NativeInstaller/BinaryDownload/AutoUpdateCheck）
- packages/cli（Transport/StructuredIO/Rollback）

## 核心分析维度

### 1. 当前已有 vs 缺失
- 哪些 package/capability 在当前代码中已经存在（可能在不同位置）？
- 哪些 capability 完全缺失，需要新建？
- 哪些已有但实现不完整？

### 2. 耦合程度
- 哪些能力与 UI/CLI 深度耦合，需要抽离？
- 哪些模块之间有不应存在的双向依赖？

### 3. 依赖方向
- 当前依赖关系是否与目标分层一致？
- 是否存在低层依赖高层的情况？

### 4. 关键阻碍
- 哪些点是实现目标架构的最大障碍？
- 优先级如何排列？

## 约束条件
1. **最小改动原则**: 最小改动现有代码，优先包裹和外扩
2. **Agent Loop 不变**: 核心 agent loop 尽量不变
3. **渐进式改造**: 每阶段必须满足结构验证、行为验证、目标验证

## 成功标准
- 产出完整的差距分析报告，覆盖目标架构的每一层
- 每个差距点都有具体的优化建议和优先级
- 识别出 TOP 20+ 优化点，形成 OKR 式计划
