# 计费模块 (Billing)

## 接口总览

| 方法 | 路径 | 认证 | 角色 | 说明 |
|------|------|------|------|------|
| GET | `/api/v1/tenants/:id/billing` | Bearer | platform_admin 或该租户的 tenant_admin | 获取租户账单汇总 |

> 权限要求：用户角色必须为 `platform_admin`，或者是该租户的 `admin` 且 `tenantId` 匹配。
> 注意：代码中角色判断使用 `tenant_admin`。

---

## GET /api/v1/tenants/:id/billing

获取租户的用量和费用汇总。数据来源于数据库计费记录和 Redis 实时计数器。

### 请求

**Path**:

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 租户 ID |

### 响应

**200 OK**:

```json
{
  "tenantId": "660e8400-e29b-41d4-a716-446655440001",
  "database": {
    "totalInputTokens": 50000,
    "totalOutputTokens": 120000,
    "totalCostCents": 14250,
    "recordCount": 35
  },
  "realtime": {
    "inputTokens": "15000",
    "outputTokens": "30000",
    "totalCost": "14250"
  }
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| database | object | 数据库聚合的累计用量 |
| database.totalInputTokens | number | 累计输入 Token 数 |
| database.totalOutputTokens | number | 累计输出 Token 数 |
| database.totalCostCents | number | 累计费用（分） |
| database.recordCount | number | 计费记录总数 |
| realtime | object | Redis 中的实时配额计数器 |
| realtime.inputTokens | string | 当日输入 Token 数（Redis 返回值为 string） |
| realtime.outputTokens | string | 当日输出 Token 数 |
| realtime.totalCost | string | 当日累计费用（分） |

> 注意：`realtime` 字段来自 Redis `hgetall`，所有值均为 string 类型，前端需要自行转换。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 403 | `FORBIDDEN` | 非 platform_admin 且不是该租户的 admin |
| 500 | `INTERNAL_ERROR` | 服务端异常 |
