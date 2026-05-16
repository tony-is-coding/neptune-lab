# Provider 适配器设计文档

## 概述

本文档描述 Provider 适配器的设计和实现策略。**T10 已完成**：AnthropicProvider 现在包装 CC 的 `queryModelWithStreaming`
，实现真实的 LLM 调用。

## 当前架构状态

### 已完成组件

1. **ProviderAdapter 接口** (`ProviderAdapter.ts`)
	- 定义统一的 Provider 查询接口
	- 支持流式输出 (`AsyncGenerator<ProviderMessage>`)
	- 定义标准化的参数和消息类型

2. **ProviderRegistry** (`ProviderRegistry.ts`)
	- 单例注册表，管理多个 Provider 实例
	- 支持注册、注销、查询 Provider
	- 默认注册 AnthropicProvider

3. **AnthropicProvider** (`adapters/AnthropicProvider.ts`) ✅ **T10 已完成**
	- 实现 `query()` 方法，包装 `queryModelWithStreaming()`
	- 参数转换：`ProviderQueryParams` → CC 所需格式
	- 响应转换：CC 流事件 → `ProviderMessage`
	- 错误处理：包装为标准 `ProviderMessage`

4. **AgentEngine 集成**
	- 支持 per-session Provider 配置
	- `sessionProviders` Map 存储会话级覆盖

### T10 实现细节

#### AnthropicProvider.query() 实现

```typescript
async *query(params: ProviderQueryParams): AsyncGenerator<ProviderMessage> {
  // 1. 参数转换
  const systemPrompt = this.buildSystemPrompt(params.systemPrompt)
  const messages = this.normalizeMessages(params.messages as Message[])
  const options = this.buildOptions(params)

  // 2. 调用 CC 的 queryModelWithStreaming
  const stream = queryModelWithStreaming({
    messages,
    systemPrompt,
    thinkingConfig: { type: 'disabled' },
    tools: params.tools as any[],
    signal: params.signal || new AbortController().signal,
    options,
  })

  // 3. 转换流式响应
  for await (const event of stream) {
    yield this.convertToProviderMessage(event)
  }
}
```

#### 参数转换策略

| ProviderQueryParams | CC 格式                             | 转换方法               |
|---------------------|-----------------------------------|--------------------|
| `model`             | `Options.model`                   | 直接映射               |
| `messages`          | `Message[]`                       | 规范化                |
| `systemPrompt`      | `SystemPrompt`                    | `asSystemPrompt()` |
| `tools`             | `Tools`                           | 直接透传（简化）           |
| `maxTokens`         | `Options.maxOutputTokensOverride` | 映射                 |
| `signal`            | `AbortSignal`                     | 直接透传               |
| `extra`             | `Options`                         | 暂未使用               |

#### 响应转换策略

```typescript
convertToProviderMessage(event: any): ProviderMessage {
  if (event.type === 'text_delta' || event.type === 'text') {
    return { type: 'text', content: event.text || event.delta?.text || '' }
  }
  if (event.type === 'tool_use') {
    return { type: 'tool_use', content: event }
  }
  if (event.type === 'tool_result') {
    return { type: 'tool_result', content: event }
  }
  return { type: 'message', content: event }
}
```

### 验证结果

- ✅ 9 个单元测试全部通过
- ✅ TypeScript 类型检查通过 (`bunx tsc --noEmit`)
- ✅ 接口符合性验证通过

## T11 阶段设计：其他 6 个 Provider

### Provider 列表

| Provider | 类型标识      | SDK                         | 状态      |
|----------|-----------|-----------------------------|---------|
| Bedrock  | `bedrock` | `@anthropic-ai/bedrock-sdk` | T11 待实现 |
| Vertex   | `vertex`  | `@anthropic-ai/vertex-sdk`  | T11 待实现 |
| Foundry  | `foundry` | `@anthropic-ai/foundry-sdk` | T11 待实现 |
| OpenAI   | `openai`  | 原生实现                        | T11 待实现 |
| Gemini   | `gemini`  | 原生实现                        | T11 待实现 |
| Grok     | `grok`    | 原生实现                        | T11 待实现 |

### 实现模式（参考 AnthropicProvider）

每个 Provider 遵循相同的模式：

```typescript
export class {Provider}Provider implements ProviderAdapter {
  readonly type = '{type}'

  async *query(params: ProviderQueryParams): AsyncGenerator<ProviderMessage> {
    // 1. 转换为 Provider 特定格式
    const providerParams = this.transformParams(params)

    // 2. 调用 Provider API
    const response = await this.client.stream(providerParams)

    // 3. 转换为标准 ProviderMessage 格式
    for await (const chunk of response) {
      yield this.transformResponse(chunk)
    }
  }
}
```

### 消息格式转换挑战

| Provider  | 消息格式             | 工具格式      | 流式响应                        |
|-----------|------------------|-----------|-----------------------------|
| Anthropic | 标准化              | 标准化       | BetaRawMessageStreamEvent ✅ |
| OpenAI    | Chat Completions | Functions | Server-Sent Events          |
| Gemini    | GenerateContent  | Tools     | Server-Sent Events          |
| Grok      | Chat Completions | Tools     | Server-Sent Events          |

## 测试策略

### 单元测试

- 接口符合性测试
- 消息转换测试
- 错误处理测试

### 集成测试

- 与 ProviderRegistry 集成
- 与 AgentEngine 集成
- 与 CC QueryEngine 兼容性

### Mock 策略

- 使用 `mock.module()` 模拟外部依赖
- Mock Anthropic SDK 响应
- Mock 网络请求（使用 MSW 或类似工具）

## 依赖关系

### 前置依赖

- ✅ T2 (CLI 条件代码迁出) — 已完成
- ✅ T4 (SDK 独立构建入口) — 已完成

### 后续任务

- T11 (Provider 其他 6 个适配) — 实现 Bedrock、Vertex、Foundry、OpenAI、Gemini、Grok
- T17 (API 文档 + 示例) — 编写 Provider 使用文档

## 实现检查清单

### T10 检查清单 ✅ 已完成

- ✅ 定义 `AnthropicProviderConfig` 类型
- ✅ 实现 `buildSystemPrompt()` 方法
- ✅ 实现 `normalizeMessages()` 方法
- ✅ 实现 `buildOptions()` 方法
- ✅ 实现 `convertToProviderMessage()` 方法
- ✅ 实现 `AnthropicProvider.query()` 方法
- ✅ 编写单元测试（9 个测试用例）
- ✅ 验证与 ProviderRegistry 集成
- ✅ 类型检查通过 (`bunx tsc --noEmit`)
- ✅ 现有测试通过
- ✅ 文档更新

### T11 检查清单（每个 Provider）

- [ ] 实现 `{Provider}Provider` 类
- [ ] 实现 `{Provider}MessageTransformer`
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 验证与 ProviderRegistry 集成
- [ ] 验证与 AgentEngine 集成
- [ ] 类型检查通过
- [ ] 现有测试通过
- [ ] 文档更新

## 参考资料

- CC 原始实现：`src/services/api/claude.ts`
- Provider 选择逻辑：`src/utils/model/providers.ts`
- 现有接口定义：`engine/provider/ProviderAdapter.ts`
- 测试示例：`engine/provider/adapters/__tests__/AnthropicProvider.test.ts`
