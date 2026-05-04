# 租户管理模块 (Tenants)

## 接口总览

| 方法 | 路径 | 认证 | 角色 | 说明 |
|------|------|------|------|------|
| POST | `/api/v1/tenants` | Bearer | admin | 创建租户 |
| GET | `/api/v1/tenants` | Bearer | admin | 获取租户列表 |
| GET | `/api/v1/tenants/:id` | Bearer | admin | 获取租户详情 |
| PUT | `/api/v1/tenants/:id` | Bearer | admin | 更新租户 |
| DELETE | `/api/v1/tenants/:id` | Bearer | admin | 删除租户 |

> 所有租户接口需要 admin 角色。

---

## POST /api/v1/tenants

创建新租户。

### 请求

**Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 租户名称 |
| quota | object | 否 | 配额配置 |
| quota.maxTokensPerDay | integer | 否 | 每日最大 Token 数，默认 1000000 |
| quota.maxConcurrentSessions | integer | 否 | 最大并发会话数，默认 10 |
| billingConfig | object | 否 | 计费配置，默认 `{}` |

```json
{
  "name": "我的公司",
  "quota": {
    "maxTokensPerDay": 2000000,
    "maxConcurrentSessions": 20
  }
}
```

### 响应

**201 Created**:

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "我的公司",
  "quota": {
    "maxTokensPerDay": 2000000,
    "maxConcurrentSessions": 20
  },
  "billingConfig": {},
  "createdAt": "2026-05-04T10:30:00.000Z",
  "updatedAt": "2026-05-04T10:30:00.000Z"
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 400 | `BAD_REQUEST` | name 为空 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## GET /api/v1/tenants

获取租户列表（分页）。

### 请求

**Query**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | integer | 100 | 每页数量 |
| offset | integer | 0 | 偏移量 |

```
GET /api/v1/tenants?limit=20&offset=0
```

### 响应

**200 OK**:

```json
{
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "我的公司",
      "quota": {
        "maxTokensPerDay": 2000000,
        "maxConcurrentSessions": 20
      },
      "billingConfig": {},
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

## GET /api/v1/tenants/:id

获取租户详情。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 租户 ID |

### 响应

**200 OK**:

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "我的公司",
  "quota": {
    "maxTokensPerDay": 2000000,
    "maxConcurrentSessions": 20
  },
  "billingConfig": {},
  "createdAt": "2026-05-04T10:30:00.000Z",
  "updatedAt": "2026-05-04T10:30:00.000Z"
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | 租户不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## PUT /api/v1/tenants/:id

更新租户信息。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 租户 ID |

**Body**（所有字段可选）:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 租户名称 |
| quota | object | 否 | 配额配置 |
| quota.maxTokensPerDay | integer | 否 | 每日最大 Token 数 |
| quota.maxConcurrentSessions | integer | 否 | 最大并发会话数 |
| billingConfig | object | 否 | 计费配置 |

```json
{
  "name": "新公司名称",
  "quota": {
    "maxTokensPerDay": 5000000,
    "maxConcurrentSessions": 50
  }
}
```

### 响应

**200 OK**:

返回更新后的完整租户对象（同 GET /tenants/:id 响应格式）。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | 租户不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## DELETE /api/v1/tenants/:id

删除租户。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 租户 ID |

### 响应

**204 No Content**:

无响应体。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | 租户不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |
