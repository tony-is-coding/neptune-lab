# Stage 5 完成报告 — Provider 收口 + zod→JSON

> **状态**：✅ 完成（S5.1-S5.3 全绿）
> **守门**：9/9 PASS
> **测试**：1416 pass / 0 fail（+16 vs Stage 4 末 1400）

## 一、核心交付

### S5.1 — Provider 收口（最小动作）

**判断**：6 个 unsupported provider stub（OpenAI/Bedrock/Vertex/Gemini/Grok/Foundry）实际都是 49-102 行的 `unsupportedProductRuntimeProvider()` 占位。最小动作不做文件迁移，只把"自动注册"逻辑收敛：

```ts
// 之前
getGlobalProviderRegistry()
  → register('anthropic', ...)
  → register('openai', ...)      // ← stub
  → register('gemini', ...)      // ← stub
  → register('grok', ...)        // ← stub
  → try register('bedrock')      // ← stub
  → try register('vertex')       // ← stub
  → try register('foundry')      // ← stub

// 现在（Stage 5.1）
getGlobalProviderRegistry()
  → register('anthropic', ...)   // 唯一真实可用
  // 其他 provider 由 product 按需 register
```

**收益**：
- Substrate 默认：只暴露真实可用的 provider
- Product 仍可注入：`registry.register('openai', new OpenAIProvider())`
- 文件保留 engine 内（49-102 行 stub 不构成包体积负担），保留产品级灵活性

### S5.2 — Provider 治理接入（重新评估后跳过）

**第一性原理判断**：当前 GovernanceHooks（PolicyHook / HumanReviewHook / EvalHook / ArtifactHook）已经覆盖 substrate 层关键决策点。Provider 级 pre-request hook（cost / quota / API 路由）属于 product 关注点，不应进 substrate 治理层。Product 可通过 wrap StreamingProviderAdapter 自己实现。**不引入新 hook，节省复杂度。**

### S5.3 — zod→JSON Schema 转换层

**核心交付**：
- `engine/utils/zodToJsonSchema.ts`：把 zod schema 转 JSON Schema（Anthropic API 兼容）
- 覆盖 Phase B 11 个 kernel tools 实际用到的所有 zod 类型：
  - 基础：`z.string / number / boolean / null / any / unknown`
  - 容器：`z.object / array`
  - 修饰：`z.optional / nullable / default`
  - 枚举：`z.enum / literal`
  - 联合：`z.union`
- 0 外部依赖（仅 zod 自身）
- 兼容 zod v4 的 `_def.values` (literal/enum)

**测试 (16 / 0 fail)**：
- 7 个基础类型 → JSON Schema
- optional / default / nullable wrapper 解开
- nested object 递归
- Phase B 典型用例（TodoWrite 风格 todo 列表）
- z.any → 空 schema（接受任意类型）

**用法**（Phase B 工具）：
```ts
import {zodToJsonSchema} from '@neptune/engine/utils/zodToJsonSchema.js'

const todoWriteInputSchema = z.object({
  todos: z.array(z.object({
    id: z.string(),
    content: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed']),
  })),
})

const tool: Tool = {
  name: 'TodoWrite',
  description: '...',
  inputSchema: todoWriteInputSchema,
  inputJSONSchema: zodToJsonSchema(todoWriteInputSchema), // 自动生成
  call: async (input) => { ... },
}
```

## 二、量化

| 指标 | Stage 4 末 | Stage 5 末 |
|---|---|---|
| baseline 测试 | 1400 / 0 fail | **1416 / 0 fail** |
| 守门 | 9/9 | 9/9 |
| 新增测试 | — | **+16** |
| 默认 provider 数 | 7 | **1（Anthropic）** |
| 新模块 | 0 | utils/zodToJsonSchema |

## 三、设计决策回顾

1. **不做 provider 文件迁移**：迁 6 文件 + 8 测试到 product 工作量大、收益小；engine 默认 registry 只注册 anthropic 已达"洁净"目标
2. **不引入 Provider 治理 hook**：避免 substrate 层概念膨胀；product 可通过 wrap adapter 自己实现
3. **zod→JSON 简化版**：覆盖 Phase B 实际用到的 8 类，不支持 z.lazy / intersection / tuple（Phase B 不用）

## 四、下一步：Stage 6（Observability + 收官）

- S6.1 Tracer 接口（OTel-compatible，0 OTel SDK 依赖）
- S6.2 Metrics 接口
- S6.3 LogUtil 升级（structured + withFields）
- S6.4 端到端 span tree + verify-harness-v1.sh + HARNESS-V1-DONE.md
