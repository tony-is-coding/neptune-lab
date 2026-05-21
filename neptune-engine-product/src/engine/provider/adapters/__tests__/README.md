# Provider 适配器测试

## 概述

此目录包含 Provider 适配器的测试代码，验证各 Provider 实现是否符合 `ProviderAdapter` 接口。

## 测试文件结构

```
__tests__/
├── README.md                      # 本文件
├── AnthropicProvider.test.ts      # Anthropic Provider 测试 ✅ T10 完成
├── BedrockProvider.test.ts        # Bedrock Provider 测试（TODO）
├── VertexProvider.test.ts         # Vertex Provider 测试（TODO）
├── FoundryProvider.test.ts        # Foundry Provider 测试（TODO）
├── OpenAIProvider.test.ts         # OpenAI Provider 测试（TODO）
├── GeminiProvider.test.ts         # Gemini Provider 测试（TODO）
├── GrokProvider.test.ts           # Grok Provider 测试（TODO）
└── helpers.ts                     # 测试辅助工具（TODO）
```

## 当前测试状态

| Provider  | 状态       | 覆盖率  | 说明                                    |
|-----------|----------|------|---------------------------------------|
| Anthropic | ✅ T10 完成 | 基础测试 | 实现 query() 包装 queryModelWithStreaming |
| Bedrock   | ⏳ TODO   | -    | T11 阶段实现                              |
| Vertex    | ⏳ TODO   | -    | T11 阶段实现                              |
| Foundry   | ⏳ TODO   | -    | T11 阶段实现                              |
| OpenAI    | ⏳ TODO   | -    | T11 阶段实现                              |
| Gemini    | ⏳ TODO   | -    | T11 阶段实现                              |
| Grok      | ⏳ TODO   | -    | T11 阶段实现                              |

## 运行测试

```bash
# 运行所有 Provider 测试
bun test src/engine/provider/adapters/__tests__/

# 运行单个 Provider 测试
bun test src/engine/provider/adapters/__tests__/AnthropicProvider.test.ts

# 运行测试并生成覆盖率报告
bun test src/engine/provider/adapters/__tests__/ --coverage
```

## 测试设计原则

### 1. 接口符合性测试

所有 Provider 必须满足 `ProviderAdapter` 接口：

- `readonly type: string` — Provider 类型标识
- `query(params: ProviderQueryParams): AsyncGenerator<ProviderMessage>` — 流式查询方法

### 2. 功能测试

- 基本查询功能
- 参数转换
- 响应转换
- 错误处理

### 3. 集成测试

- 与 ProviderRegistry 的集成
- 与 AgentEngine 的集成
- 与 CC QueryEngine 的兼容性

### 4. Mock 策略

- 使用 `mock.module()` 模拟外部依赖
- Mock Anthropic SDK 响应
- Mock 网络请求（使用 MSW 或类似工具）

## T10 完成内容

### AnthropicProvider.test.ts

包含以下测试用例：

1. **基本属性测试**（3 个）
	- `type` 应该是 "anthropic"
	- `getConfig()` 应该返回配置
	- 支持自定义配置

2. **query 方法测试**（2 个）
	- 返回 AsyncGenerator
	- 包装 queryModelWithStreaming

3. **接口符合性测试**（2 个）
	- 实现 ProviderAdapter 接口
	- query 方法返回 AsyncGenerator

4. **类型安全测试**（2 个）
	- ProviderQueryParams 类型验证
	- ProviderMessage 类型验证

**总计：9 个测试用例，全部通过 ✅**

## T11 阶段扩展计划

当 T11 (Provider 其他 6 个适配) 开始后，需要为每个 Provider 创建对应的测试文件，参考 `AnthropicProvider.test.ts` 的结构。

## 参考资料

- `ProviderAdapter.ts` — 接口定义
- `ProviderRegistry.ts` — 注册表实现
- `AgentEngine.ts` — 使用 Provider 的入口
- `DESIGN.md` — 设计文档
