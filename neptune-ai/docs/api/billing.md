# 计费模块 (Billing)

## 接口总览

| 方法 | 路径 | 认证 | 角色 | 说明 |
|------|------|------|------|------|
| GET | `/api/v1/tenants/:id/billing` | Bearer | platform_admin 或该租户的 tenant_admin | 获取租户账单汇总 |

> 权限要求：用户必须是 `platform_admin`，或者是该租户的 `admin`（`tenantId` 匹配）。

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
    "totalCostCents": 14250
  },
  "realtime": {
    "currentDayTokens": 15000,
    "quotaLimit": 1000000
  }
}
```

> 注意：具体响应结构取决于 `costAggregator.getTenantUsage()` 和 `costAggregator.getQuotaCounter()` 的实现。

### 错误响应

| 状态码 | error | 触发条件 |
|--------|-------|----------|
| 403 | `FORBIDDEN` | 非 platform_admin 且不是该租户的 admin |
| 500 | `INTERNAL_ERROR` | 服务端异常 |
