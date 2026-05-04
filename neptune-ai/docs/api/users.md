# 用户管理模块 (Users)

## 接口总览

| 方法 | 路径 | 认证 | 角色 | 说明 |
|------|------|------|------|------|
| POST | `/api/v1/users` | Bearer | admin | 创建用户 |
| GET | `/api/v1/users` | Bearer | 任意已认证 | 获取当前租户用户列表 |
| GET | `/api/v1/users/:id` | Bearer | 任意已认证 | 获取用户详情 |
| PUT | `/api/v1/users/:id` | Bearer | admin | 更新用户 |
| DELETE | `/api/v1/users/:id` | Bearer | admin | 删除用户 |

> 创建、更新、删除用户需要 admin 角色。查看接口只需认证即可。
> 所有操作限定在当前用户的租户范围内。

---

## POST /api/v1/users

在当前租户下创建新用户。

### 请求

**Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 用户名 |
| email | string | 是 | 邮箱（全局唯一） |
| password | string | 是 | 密码 |
| role | string | 否 | 角色，默认 `user`，可选 `admin` |

```json
{
  "name": "李四",
  "email": "lisi@example.com",
  "password": "securepassword",
  "role": "user"
}
```

### 响应

**201 Created**:

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "tenantId": "660e8400-e29b-41d4-a716-446655440001",
  "name": "李四",
  "email": "lisi@example.com",
  "role": "user",
  "createdAt": "2026-05-04T10:30:00.000Z"
}
```

> 注意：响应中不包含 `passwordHash`。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 400 | `BAD_REQUEST` | name/email/password 为空；邮箱已被使用 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## GET /api/v1/users

获取当前租户下的用户列表（分页）。自动按当前用户的 `tenantId` 过滤。

### 请求

**Query**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | integer | 100 | 每页数量 |
| offset | integer | 0 | 偏移量 |

```
GET /api/v1/users?limit=20&offset=0
```

### 响应

**200 OK**:

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "tenantId": "660e8400-e29b-41d4-a716-446655440001",
      "name": "张三",
      "email": "zhangsan@example.com",
      "role": "admin",
      "createdAt": "2026-05-04T10:00:00.000Z"
    }
  ],
  "meta": {
    "count": 1,
    "limit": 20,
    "offset": 0
  }
}
```

> 注意：响应中不包含 `passwordHash`。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## GET /api/v1/users/:id

获取用户详情。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 用户 ID |

### 响应

**200 OK**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "660e8400-e29b-41d4-a716-446655440001",
  "name": "张三",
  "email": "zhangsan@example.com",
  "role": "admin",
  "createdAt": "2026-05-04T10:00:00.000Z"
}
```

> 注意：响应中不包含 `passwordHash`。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | 用户不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## PUT /api/v1/users/:id

更新用户信息。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 用户 ID |

**Body**（所有字段可选）:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 用户名 |
| email | string | 否 | 邮箱（修改时检查唯一性） |
| password | string | 否 | 新密码（会自动哈希） |
| role | string | 否 | 角色 |

```json
{
  "name": "张三丰",
  "email": "zhangsanfeng@example.com"
}
```

### 响应

**200 OK**:

返回更新后的完整用户对象（不含 `passwordHash`）。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 400 | `BAD_REQUEST` | 邮箱已被其他用户使用 |
| 404 | `NOT_FOUND` | 用户不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## DELETE /api/v1/users/:id

删除用户。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 用户 ID |

### 响应

**204 No Content**:

无响应体。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 404 | `NOT_FOUND` | 用户不存在 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |
