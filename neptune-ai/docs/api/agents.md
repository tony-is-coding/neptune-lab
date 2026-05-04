# Agent 模板模块 (Agents)

## 接口总览

| 方法 | 路径 | 认证 | 角色 | 说明 |
|------|------|------|------|------|
| POST | `/api/v1/agents` | Bearer | admin | 创建 Agent 模板 |
| GET | `/api/v1/agents` | Bearer | 任意已认证 | 获取 Agent 列表 |
| GET | `/api/v1/agents/:id` | Bearer | 任意已认证 | 获取 Agent 详情 |
| PUT | `/api/v1/agents/:id` | Bearer | admin | 更新 Agent 模板 |
| DELETE | `/api/v1/agents/:id` | Bearer | admin | 删除 Agent 模板 |
| PATCH | `/api/v1/agents/:id/activate` | Bearer | admin | 激活 Agent |
| PATCH | `/api/v1/agents/:id/deactivate` | Bearer | admin | 停用 Agent |
| GET | `/api/v1/agents/:id/stats` | Bearer | 任意已认证 | 获取 Agent 统计数据 |
| GET | `/api/v1/agents/:id/documents` | Bearer | 任意已认证 | 获取 Agent 文档列表 |
| POST | `/api/v1/agents/:id/documents` | Bearer | 任意已认证 | 上传文档到 Agent |
| DELETE | `/api/v1/agents/:id/documents/:docId` | Bearer | admin | 删除 Agent 文档 |

> 创建、更新、删除需要 admin 角色。查看接口只需认证即可。

---

## 数据模型

### AgentTemplate

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tenantId | UUID | 所属租户 |
| name | string | Agent 名称 |
| description | string | 描述 |
| systemPrompt | string | 系统提示词 |
| modelConfig | object | 模型配置 |
| modelConfig.provider | string | 模型提供商 |
| modelConfig.model | string | 模型名称 |
| modelConfig.temperature | number | 温度参数 |
| modelConfig.maxTokens | number | 最大输出 Token 数 |
| tools | string[] | 工具列表 |
| skills | object[] | 技能列表 |
| skills[].id | string | 技能 ID |
| skills[].name | string | 技能名称 |
| skills[].version | string | 技能版本（可选） |
| mcpServers | object[] | MCP 服务器列表 |
| mcpServers[].name | string | 服务器名称 |
| mcpServers[].url | string | 服务器 URL |
| mcpServers[].authConfig | object | 认证配置（可选） |
| constraints | object | 约束配置 |
| constraints.maxTokensPerTurn | number | 每轮最大 Token 数 |
| constraints.maxTurnsPerSession | number | 每会话最大轮数 |
| constraints.maxConcurrentSessions | number | 最大并发会话数 |
| version | integer | 版本号 |
| isActive | boolean | 是否激活 |
| createdAt | string (ISO 8601) | 创建时间 |
| updatedAt | string (ISO 8601) | 更新时间 |

---

## POST /api/v1/agents

创建 Agent 模板。

### 请求

**Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | Agent 名称 |
| description | string | 否 | 描述 |
| systemPrompt | string | 是 | 系统提示词 |
| modelConfig | object | 是 | 模型配置 |
| modelConfig.provider | string | 是 | 提供商 |
| modelConfig.model | string | 是 | 模型名称 |
| modelConfig.temperature | number | 是 | 温度 |
| modelConfig.maxTokens | number | 是 | 最大 Token 数 |
| tools | string[] | 否 | 工具列表，默认 `[]` |
| skills | object[] | 否 | 技能列表，默认 `[]` |
| mcpServers | object[] | 否 | MCP 服务器列表，默认 `[]` |
| constraints | object | 否 | 约束配置 |

`constraints` 默认值：

```json
{
  "maxTokensPerTurn": 10000,
  "maxTurnsPerSession": 100,
  "maxConcurrentSessions": 10
}
```

```json
{
  "name": "客服助手",
  "description": "处理客户咨询的 AI 助手",
  "systemPrompt": "你是一个专业的客服代表...",
  "modelConfig": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "tools": ["web_search", "knowledge_base"],
  "skills": [
    { "id": "ticket-management", "name": "Ticket Management", "version": "1.0" }
  ],
  "mcpServers": [],
  "constraints": {
    "maxTokensPerTurn": 10000,
    "maxTurnsPerSession": 100,
    "maxConcurrentSessions": 10
  }
}
```

### 响应

**201 Created**:

返回完整的 AgentTemplate 对象。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 400 | `BAD_REQUEST` | name/systemPrompt/modelConfig 为空 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## GET /api/v1/agents

获取当前租户的 Agent 模板列表（分页）。自动按当前用户的 `tenantId` 过滤。

### 请求

**Query**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | integer | 100 | 每页数量 |
| offset | integer | 0 | 偏移量 |
| active | string | - | 过滤激活状态，值为 `"true"` 时只返回激活的 Agent |

```
GET /api/v1/agents?limit=20&offset=0&active=true
```

### 响应

**200 OK**:

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "name": "客服助手",
      "description": "处理客户咨询的 AI 助手",
      "systemPrompt": "你是一个专业的客服代表...",
      "modelConfig": {
        "provider": "openai",
        "model": "gpt-4o",
        "temperature": 0.7,
        "maxTokens": 4096
      },
      "tools": ["web_search", "knowledge_base"],
      "skills": [],
      "mcpServers": [],
      "constraints": {
        "maxTokensPerTurn": 10000,
        "maxTurnsPerSession": 100,
        "maxConcurrentSessions": 10
      },
      "version": 1,
      "isActive": true,
      "createdAt": "2026-05-04T10:30:00.000Z",
      "updatedAt": "2026-05-04T10:30:00.000Z"
    }
  ],
  "meta": {
    "count": 1,
    "limit": 20,
    "offset": 0
  }
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## GET /api/v1/agents/:id

获取 Agent 模板详情。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | Agent 模板 ID |

### 响应

**200 OK**:

返回完整的 AgentTemplate 对象。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | Agent 模板不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## PUT /api/v1/agents/:id

更新 Agent 模板。所有字段可选，只更新传入的字段。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | Agent 模板 ID |

**Body**（所有字段可选）:

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | Agent 名称 |
| description | string | 描述 |
| systemPrompt | string | 系统提示词 |
| modelConfig | object | 模型配置 |
| tools | string[] | 工具列表 |
| skills | object[] | 技能列表 |
| mcpServers | object[] | MCP 服务器列表 |
| constraints | object | 约束配置 |
| isActive | boolean | 激活状态 |

```json
{
  "name": "高级客服助手",
  "systemPrompt": "你是一个高级客服代表...",
  "isActive": true
}
```

### 响应

**200 OK**:

返回更新后的完整 AgentTemplate 对象。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | Agent 模板不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## DELETE /api/v1/agents/:id

删除 Agent 模板。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | Agent 模板 ID |

### 响应

**204 No Content**:

无响应体。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | Agent 模板不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## PATCH /api/v1/agents/:id/activate

激活 Agent 模板（设置 `isActive = true`）。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | Agent 模板 ID |

### 响应

**200 OK**:

返回更新后的完整 AgentTemplate 对象（`isActive: true`）。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | Agent 模板不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## PATCH /api/v1/agents/:id/deactivate

停用 Agent 模板（设置 `isActive = false`）。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | Agent 模板 ID |

### 响应

**200 OK**:

返回更新后的完整 AgentTemplate 对象（`isActive: false`）。

### 错误响应

同 activate。

---

## GET /api/v1/agents/:id/stats

获取 Agent 统计数据。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | Agent 模板 ID |

### 响应

**200 OK**:

统计数据格式由 `agentTemplateService.getStats()` 返回，具体结构待确认。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | Agent 模板不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## GET /api/v1/agents/:id/documents

获取 Agent 的文档列表。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | Agent 模板 ID |

### 响应

**200 OK**:

```json
{
  "data": [
    {
      "id": "uuid",
      "templateId": "uuid",
      "tenantId": "uuid",
      "name": "产品手册.pdf",
      "type": "PDF",
      "size": 2457600,
      "path": "/data/tenants/xxx/agents/xxx/documents/产品手册.pdf",
      "uploadedAt": "2026-05-04T10:30:00.000Z"
    }
  ]
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## POST /api/v1/agents/:id/documents

上传文档到 Agent。文档内容以 base64 编码传输。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | Agent 模板 ID |

**Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 文件名 |
| type | string | 是 | 文件类型（如 `PDF`、`CSV`、`Markdown`、`JSON`） |
| size | integer | 否 | 文件大小（字节） |
| content | string | 是 | 文件内容（base64 编码） |

```json
{
  "name": "产品手册.pdf",
  "type": "PDF",
  "size": 2457600,
  "content": "JVBERi0xLjQK..."
}
```

### 响应

**201 Created**:

```json
{
  "id": "uuid",
  "templateId": "uuid",
  "tenantId": "uuid",
  "name": "产品手册.pdf",
  "type": "PDF",
  "size": 2457600,
  "path": "/data/tenants/xxx/agents/xxx/documents/产品手册.pdf",
  "uploadedAt": "2026-05-04T10:30:00.000Z"
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 400 | `BAD_REQUEST` | name 或 type 为空 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## DELETE /api/v1/agents/:id/documents/:docId

删除 Agent 文档。同时删除磁盘文件和数据库记录。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | Agent 模板 ID |
| docId | string (UUID) | 文档 ID |

### 响应

**204 No Content**:

无响应体。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | 文档不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |
