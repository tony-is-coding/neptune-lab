# API 错误信封规范

**版本**：v1.0
**最后更新**：2026-05-23
**适用范围**：`neptune-ai/server` 所有 HTTP REST 与 SSE 错误响应；`neptune-ai/web` 错误处理；任何消费 Neptune API 的第三方客户端。

## 1. 结论

所有错误响应必须满足三件事：

1. **统一信封**：response body 是 `ApiErrorEnvelope`，字段固定为 `{error, message, requestId, details}`
2. **封闭错误码**：`error` 字段只允许是 `ApiErrorCode` 枚举中的值，不允许自由字符串
3. **可追溯**：`requestId` 必填且与响应头 `X-Request-Id` 完全一致

非错误响应（2xx/3xx）不受本规范约束。

## 2. 错误码字典（封闭枚举）

权威定义在 [`shared/types/neptune-ai/api/errors.ts`](../../shared/types/neptune-ai/api/errors.ts)。

| 错误码 | 默认 HTTP | 适用场景 | 子状态来源 |
| --- | ---:| --- | --- |
| `VALIDATION_FAILED` | 400 | 请求体/参数 schema 校验失败、必填字段缺失、枚举不合法、格式不正确 | `details.missing` / `details.field` / `details.validation` |
| `UNAUTHORIZED` | 401 | 未携带凭证、凭证非法、令牌过期 | — |
| `FORBIDDEN` | 403 | 凭证有效但角色或资源所有权不符合 | `details.requiredRole` |
| `RESOURCE_NOT_FOUND` | 404 | 资源不存在或跨租户访问被拒绝（不暴露存在性差异） | — |
| `STATE_CONFLICT` | 409 | 资源状态不允许该操作；具体原因走 `details.reason` | `details.reason`（见下表） |
| `QUOTA_EXCEEDED` | 429 | 租户/项目配额拒绝 | `details.quota` / `details.usage` |
| `INTERNAL_ERROR` | 500 | 未预期的服务端异常；客户端不应做语义分支 | — |

### 2.1 `STATE_CONFLICT` 子原因

`details.reason` 枚举权威定义在 `API_STATE_CONFLICT_REASONS`：

| reason | 含义 |
| --- | --- |
| `review_already_decided` | 复核已结束（approved/rejected/waived/returned），不能再次决策 |
| `close_report_not_ready` | 关账报告快照需先经过检查与复核 |
| `skill_not_published` | 草稿状态的 Skill 不能绑定到 Agent |
| `period_not_open` | 会计期间状态不允许该写操作 |
| `run_not_running` | Run 不在 running 状态，无法 cancel |
| `run_already_completed` | Run 已结束，无法 retry |
| `workspace_locked` | 关账工作区已锁定，禁止写操作 |
| `email_taken` | 邮箱已被占用 |

新增子原因必须先扩展 `API_STATE_CONFLICT_REASONS`，再在路由里引用。

## 3. 信封形状

```ts
interface ApiErrorEnvelope {
  error: ApiErrorCode;              // 必填，封闭枚举
  message: string;                  // 必填，中文用户可读
  requestId?: string;               // 必填（响应中），缺失视为 server bug
  details?: Record<string, unknown>; // 可选，结构化补充
}
```

**响应头**：所有错误响应必须设置 `X-Request-Id`，值与 `requestId` 字段一致。

**示例**：

```http
HTTP/1.1 409 Conflict
Content-Type: application/json
X-Request-Id: 8f3a2c01-...

{
  "error": "STATE_CONFLICT",
  "message": "复核已结束，无法再次决策",
  "requestId": "8f3a2c01-...",
  "details": {
    "reason": "review_already_decided"
  }
}
```

## 4. 实现约束（server）

### 4.1 路由编写规范

**禁止**：

- 任何 `reply.status(4xx|5xx).send({error,...})` 直接写法
- 自由字符串错误码，例如 `error: 'BAD_REQUEST'`、`error: 'NOT_FOUND'`
- 缺失 `requestId` 的错误响应

**推荐**（按优先级）：

1. 路由内部：使用 `replyApiError(request, reply, code, message, {details, statusCode})`
2. catch 块：使用 `replyUnknownError(request, reply, error, fallbackMessage)`
3. 服务层抛出可恢复错误：使用 `throw new ApiError(code, message, details)`，被 `setErrorHandler` 收口
4. 兼容已有的 `sendApiError(reply, statusCode, envelope)` 直到全部迁移完成

### 4.2 全局兜底

`src/index.ts` 必须注册：

- `app.setErrorHandler(...)` 兜底未捕获异常和 Fastify schema 校验失败
- `app.setNotFoundHandler(...)` 兜底未匹配路由
- `onRequest` hook 注入 `request.requestId`（来自 `X-Request-Id` 头或新生成的 UUID）
- 响应头 `X-Request-Id` 在 `onRequest` 阶段写出

### 4.3 SSE 流内错误

SSE 通道内的错误必须发 `event: error`，data payload 是：

```ts
interface ChatErrorEvent extends ApiErrorEnvelope {
  type: 'error';
}
```

不允许在 `event: message` 中夹带错误，也不允许在流外用 HTTP 4xx/5xx 表达流内错误（preflight 失败除外）。

## 5. 实现约束（web）

### 5.1 错误码分支

`neptune-ai/web` 在做错误码分支判断时必须使用 shared 的枚举：

```ts
import {isApiErrorCode, type ApiErrorCode} from '@shared/neptune-ai';

if (err.error === 'QUOTA_EXCEEDED') { ... }   // ✅ 强类型
if (err.error === 'BAD_REQUEST')   { ... }    // ❌ 不在枚举中，TS 报错
```

### 5.2 用户可见文案

- `error` 是程序分支用，不展示给业务用户
- `message` 是中文用户文案，可直接展示
- `requestId` 必须出现在错误页面/弹窗，便于客服与用户对账

## 6. 合同测试

权威合同测试位置：`neptune-ai/server/test/error-envelope-contract.test.ts`

它覆盖：

- 全局 404 兜底
- 未认证 / 非法 token 401
- VALIDATION_FAILED 400
- STATE_CONFLICT 409 + `details.reason`
- `X-Request-Id` 透传
- 错误码枚举封闭性

任何修改错误信封形状的 PR 必须同步更新该测试。

## 7. 变更流程

修改错误信封是跨层 API 变更，必须：

1. 同步更新 `shared/types/neptune-ai/api/errors.ts` 与 `common.ts`
2. 同步更新 `neptune-ai/server`（路由 + 全局 handler + 测试）
3. 同步更新 `neptune-ai/web`（API client + 页面分支判断）
4. 更新 `error-envelope-contract.test.ts`
5. 更新本文档版本号与变更点

## 8. 反模式与历史遗留

### 8.1 已废弃的错误码

下列代码是历史遗留，**禁止在新代码中使用**：

- `BAD_REQUEST` → 用 `VALIDATION_FAILED`
- `MISSING_PARAMS` / `MISSING_CONTENT` → 用 `VALIDATION_FAILED` + `details.missing`
- `NOT_FOUND` → 用 `RESOURCE_NOT_FOUND`
- `CONFLICT` → 用 `STATE_CONFLICT`（带 `details.reason`）
- `REVIEW_ALREADY_DECIDED` / `CLOSE_REPORT_NOT_READY` / `SKILL_NOT_PUBLISHED` → 用 `STATE_CONFLICT` + `details.reason`
- `QUERY_ERROR` → 用 `INTERNAL_ERROR`

### 8.2 SSE 内不允许出现的字段

- `error: <自由字符串>`：必须从 `ApiErrorCode` 枚举取值
- 流内错误事件不携带 `requestId`：必须携带，与 HTTP 错误一致
