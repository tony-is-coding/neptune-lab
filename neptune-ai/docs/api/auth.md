# 认证模块 (Auth)

## 接口总览

| 方法 | 路径 | 认证 | 角色 | 说明 |
|------|------|------|------|------|
| POST | `/api/v1/auth/login` | 无 | - | 用户登录 |
| POST | `/api/v1/auth/register` | 无 | - | 用户注册 |
| POST | `/api/v1/auth/token/refresh` | 无 | - | 刷新令牌 |
| GET | `/api/v1/auth/me` | Bearer | 任意已认证 | 获取当前用户信息 |

---

## POST /api/v1/auth/login

用户登录，返回用户信息和令牌对。

### 请求

**Content-Type**: `application/json`

**Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 用户邮箱 |
| password | string | 是 | 用户密码 |

```json
{
  "email": "zhangsan@example.com",
  "password": "mypassword"
}
```

### 响应

**200 OK**:

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "张三",
    "email": "zhangsan@example.com",
    "role": "admin",
    "tenantId": "660e8400-e29b-41d4-a716-446655440001"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 3600
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 400 | `BAD_REQUEST` | 邮箱或密码为空 |
| 401 | `UNAUTHORIZED` | 邮箱或密码错误 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## POST /api/v1/auth/register

用户注册。支持两种模式：

1. **加入已有租户**：提供 `tenantId`，角色为 `user`
2. **创建新租户**：提供 `tenantName`，自动创建租户并成为管理员（角色为 `admin`）

### 请求

**Content-Type**: `application/json`

**Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 用户名 |
| email | string | 是 | 邮箱（唯一） |
| password | string | 是 | 密码 |
| tenantId | string | 否 | 加入已有租户的 ID（与 tenantName 二选一） |
| tenantName | string | 否 | 新建租户的名称（与 tenantId 二选一） |

**模式 1 — 加入已有租户**：

```json
{
  "name": "张三",
  "email": "zhangsan@example.com",
  "password": "mypassword",
  "tenantId": "660e8400-e29b-41d4-a716-446655440001"
}
```

**模式 2 — 创建新租户**：

```json
{
  "name": "张三",
  "email": "zhangsan@example.com",
  "password": "mypassword",
  "tenantName": "我的公司"
}
```

### 响应

**201 Created**:

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "张三",
    "email": "zhangsan@example.com",
    "role": "admin",
    "tenantId": "660e8400-e29b-41d4-a716-446655440001"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 3600
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 400 | `BAD_REQUEST` | name/email/password 为空；tenantId 和 tenantName 都未提供；租户不存在；邮箱已注册 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## POST /api/v1/auth/token/refresh

使用 refreshToken 换取新的令牌对。

### 请求

**Content-Type**: `application/json`

**Body**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| refreshToken | string | 是 | 刷新令牌 |

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9..."
}
```

### 响应

**200 OK**:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 3600
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 400 | `BAD_REQUEST` | refreshToken 为空 |
| 401 | `UNAUTHORIZED` | refreshToken 无效或已过期 |

---

## GET /api/v1/auth/me

获取当前认证用户的完整信息。

### 请求

**Headers**:

```
Authorization: Bearer <accessToken>
```

### 响应

**200 OK**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "张三",
  "email": "zhangsan@example.com",
  "role": "admin",
  "tenantId": "660e8400-e29b-41d4-a716-446655440001"
}
```

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 401 | `UNAUTHORIZED` | 未携带 Token 或 Token 无效 |
| 404 | `NOT_FOUND` | 用户不存在（已被删除） |
| 500 | `INTERNAL_ERROR` | 服务端异常 |
