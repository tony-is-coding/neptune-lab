# Engine 执行链路全景图

## 总览

```
ThreadManager.dispatch(threadId, content)
│
├── 1. Session/Thread 恢复
├── 2. QueryEngine 创建
├── 3. Agent Loop 执行
└── 4. LLM Call
```

---

---

## 1. Session/Thread 恢复

```
server/src/services/thread-manager.ts:350  dispatch()
│
├── L354: thread = await this.get(threadId)
│         └── DB query: sessions 表
│
├── L391: template = await db.select().from(agentTemplates)
│         └── DB query: agent_templates 表
│
├── L397: assembledSystemPrompt = await this.assembleSystemPromptForAgent(template, agentId, tenantId)
│         ├── L710: fetchAgentSkills(agentId)        → agent_skills + skills 表
│         ├── L711: fetchAgentDocuments(agentId)     → documents 表 + readFileSync
│         ├── L714: loadAgentInstructions(tenantId, agentId)  → {dataRoot}/agents/{id}/agent.md
│         └── L722: assembleSystemPrompt({ template, skills, documents, agentInstructions })
│                   └── server/src/services/prompt-assembler.ts
│
├── L401: engineFactory.createAndLoad({ workspace, systemPrompt, ... })
│         │
│         │  server/src/services/engine-factory.ts:61  createAndLoad()
│         │  │
│         │  ├── L89: engine = AgentEngine.create({ systemPrompt, provider, ... })
│         │  │        └── neptune-engine/src/engine/AgentEngine.ts:343  static create()
│         │  │            ├── L345: validateAgentEngineConfig(config)
│         │  │            ├── L374: sessionManager = new SessionManager()
│         │  │            └── L379: return new AgentEngine(sessionManager, eventBus, config, runtime)
│         │  │
│         │  └── L110: sdkSessionId = await engine.createSession({ workspace, systemPrompt })
│         │            └── neptune-engine/src/engine/AgentEngine.ts:384  createSession()
│         │                ├── L393: sessionManager.createSession({ workspace })
│         │                ├── L402: sessionCtx = createDefaultSessionContext(sessionId, workspace)
│         │                ├── L416: loadSkillsToWorkspace(skills, workspace)  // 写入 .claude/skills/
│         │                └── L424: return sessionId
│         │
│         └── return { engine, sdkSessionId }
│
└── 历史恢复路径（SDK 内部自动处理）:
    neptune-engine/src/engine/AgentEngine.ts:628  query()
    │
    ├── L669: qe = this.queryEngines.get(sessionId)  // 首次为 null
    │
    └── L671-698: 首次创建 QueryEngine 时
        ├── L672: initialMessages = this.sessionMessages.get(sessionId)
        │         └── 来源: loadSession() 解析 transcript.jsonl 后存入
        │             neptune-engine/src/engine/AgentEngine.ts:554  loadSession()
        │             ├── L561: storagePath = getSessionStoragePath(workspace)
        │             ├── L579: localTranscript = join(workspace, 'transcript.jsonl')
        │             ├── L594: logOption = ccRuntime.loadTranscriptFromFile(jsonlFile)
        │             └── L602: this.sessionMessages.set(sessionId, messages)
        │
        └── L688: initialMessages 传入 BridgeOptions
```

---

---

## 2. QueryEngine 创建

```
neptune-engine/src/engine/AgentEngine.ts:628  query()
│
├── L665: initializeRuntime(ccRuntime, session.workspace)
│         └── neptune-engine/src/engine/bridge/OriginalQueryEngineBridge.ts:99  initializeRuntime()
│             ├── L103: ccRuntime.injectMacroDefines()
│             ├── L106: ccRuntime.enableConfigs()
│             └── L116: ccRuntime.setupBootstrap({ cwd: workspace })
│
├── L669-698: 获取或创建 QueryEngine
│   │
│   └── 首次创建:
│       ├── L678: effectiveSystemPrompt = sessionPrompts.get(sessionId) ?? config.systemPrompt
│       ├── L681: effectiveProvider = sessionProviders.get(sessionId) ?? config.provider
│       │
│       ├── L683-693: bridgeOptions = {
│       │     cwd: session.workspace,
│       │     systemPrompt: effectiveSystemPrompt,
│       │     tools: config.extensions?.tools,
│       │     initialMessages,           // ← 历史消息（恢复场景）
│       │     permissions: config.extensions?.permissions,
│       │     provider: effectiveProvider,  // { type: 'anthropic', config: { apiKey, baseURL } }
│       │   }
│       │
│       ├── L694: queryEngineConfig = await buildQueryEngineConfigFromOptions(bridgeOptions, ccRuntime)
│       │         └── neptune-engine/src/engine/bridge/OriginalQueryEngineBridge.ts:218
│       │             ├── L233: baseTools = ccRuntime.getAllBaseTools()
│       │             ├── L234: extensionTools = toolExtensions.map(adaptToolExtension)
│       │             ├── L293: providerAdapter = createProviderWithConfig(provider.type, provider.config)
│       │             │
│       │             ├── L309-341: customDeps = { ...originalDeps, callModel: async function*(params) {
│       │             │     // CircuitBreaker 包装
│       │             │     log.info('LLM API call', { provider, messagesCount, ... })
│       │             │     yield* originalDeps.callModel(params)
│       │             │   }}
│       │             │
│       │             └── L354-380: return queryEngineConfig = {
│       │                   cwd, tools, commands, canUseTool,
│       │                   customSystemPrompt, includePartialMessages: true,
│       │                   customDeps,  // ← 包含 callModel wrapper
│       │                 }
│       │
│       └── L695: queryEngine = ccRuntime.createQueryEngine(queryEngineConfig)
│                 └── 返回 CC 原始 QueryEngine 实例
│
└── L696: this.queryEngines.set(sessionId, queryEngine)
```

---

---

## 3. Agent Loop 执行

```
neptune-engine/src/engine/AgentEngine.ts:628  query()
│
├── L720-750: yield* ccRuntime.runWithCwd(workspace, () =>
│     runInSessionContextAsync(sessionCtx, async function*() {
│
│       for await (const message of engine.submitMessage(input)) {
│         eventBus.emit(messageType, message, sessionId)
│         yield message    // ← 这些 message 就是 ThreadManager 收到的事件
│       }
│
│     })
│   )
│
│   engine.submitMessage(input) 内部:
│   └── CC QueryEngine 的 Agent Loop:
│       │
│       │  neptune-engine/src/query.ts (CC 原始 QueryEngine)
│       │
│       ├── 构建 user message → 追加到 messages 数组
│       │
│       ├── while (true) {  // Agent Loop
│       │   │
│       │   ├── callModel(params)  → LLM API 调用（见第 4 节）
│       │   │   └── yield stream_event (message_start, content_block_*, message_delta, message_stop)
│       │   │   └── yield assistant message
│       │   │
│       │   ├── 检查 stop_reason:
│       │   │   ├── "end_turn" → break（结束循环）
│       │   │   └── "tool_use" → 继续执行工具
│       │   │
│       │   ├── 执行 tool calls:
│       │   │   ├── yield tool_use event
│       │   │   ├── canUseTool() → 权限检查
│       │   │   ├── tool.execute(input) → 实际执行
│       │   │   └── yield tool_result event
│       │   │
│       │   └── 将 tool_result 追加到 messages → 继续循环
│       │   }
│       │
│       └── yield result event (success/error)
│
└── L751-767: finally {
      eventBus.emit('query:complete', { sessionId, modelUsage: ctx.modelUsage })
      activeQueries.delete(sessionId)
    }
```

---

---

## 4. LLM Call

```
Agent Loop 中的 callModel(params):
│
├── neptune-engine/src/engine/bridge/OriginalQueryEngineBridge.ts:312
│   callModel: async function*(params) {
│     log.info('LLM API call', { provider, messagesCount, messageRoles, systemPromptLength, toolsCount })
│     yield* originalDeps.callModel(params)
│   }
│
├── originalDeps.callModel = queryModelWithStreaming
│   └── neptune-engine/src/services/api/claude.ts:770
│       export async function* queryModelWithStreaming({ messages, systemPrompt, tools, signal, options })
│         └── yield* queryModel(messages, systemPrompt, thinkingConfig, tools, signal, options)
│
└── neptune-engine/src/services/api/claude.ts:1035
    async function* queryModel(messages, systemPrompt, ...) {
    │
    ├── L1073: previousRequestId = getPreviousRequestIdFromMessages(messages)
    │
    ├── L1284: messagesForAPI = normalizeMessagesForAPI(messages, filteredTools)
    │          └── 将内部 Message[] 转为 Anthropic API 格式 MessageParam[]
    │
    ├── L1319: messagesForAPI = ensureToolResultPairing(messagesForAPI)
    │          └── 修复 tool_use/tool_result 配对
    │
    ├── L1404: systemPrompt = asSystemPrompt([
    │            getAttributionHeader(fingerprint),
    │            getCLISyspromptPrefix(...),
    │            ...systemPrompt,
    │          ])
    │
    ├── L1422: system = buildSystemPromptBlocks(systemPrompt, enablePromptCaching, ...)
    │          └── 构建 system prompt 的 cache_control 标记
    │
    ├── L1253: toolSchemas = await Promise.all(filteredTools.map(tool => toolToAPISchema(tool, ...)))
    │          └── 将 Tool[] 转为 API schema 格式
    │
    ├── L1544: llmSpan = startLLMRequestSpan(model, newContext, messagesForAPI, isFastMode)
    │
    └── Anthropic SDK 流式调用:
        │
        ├── stream = client.messages.stream({
        │     model, system, messages: messagesForAPI,
        │     tools: toolSchemas, max_tokens, thinking, betas,
        │   })
        │
        └── for await (event of stream) {
              yield event   // BetaRawMessageStreamEvent
              // 事件类型:
              //   message_start    → { message: { usage: { input_tokens } } }
              //   content_block_start → { content_block: { type: 'thinking'|'text'|'tool_use' } }
              //   content_block_delta → { delta: { type: 'thinking_delta'|'text_delta'|'input_json_delta' } }
              //   content_block_stop
              //   message_delta    → { usage: { output_tokens } }
              //   message_stop
            }
    }
```

---

---

## 事件流向总览

```
Anthropic API
    │ (BetaRawMessageStreamEvent)
    ▼
queryModel() [claude.ts:1035]
    │ yield StreamEvent | AssistantMessage
    ▼
callModel wrapper [OriginalQueryEngineBridge.ts:312]
    │ yield* (透传)
    ▼
CC QueryEngine Agent Loop [query.ts]
    │ yield QueryEvent (stream_event | assistant | tool_use | tool_result | result)
    ▼
AgentEngine.query() [AgentEngine.ts:723]
    │ eventBus.emit() + yield message
    ▼
ThreadManager.dispatch() [thread-manager.ts:489]
    │
    ├── tracingProcessor.process(event)  → Langfuse 上报
    ├── planManager.processSDKEvent(event)  → Plan 事件
    └── yield event  → SSE 路由层
         │
         ▼
    threads.ts 路由 [routes/threads.ts:352]
         │ mapSSEEvent(sdkEvent)
         ▼
    前端 SSE 流
```
