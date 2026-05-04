# Neptune-AI 集成测试

## 概述

本目录包含 Neptune-AI 后端 API 的集成测试和端到端测试。

## 目录结构

```
test/
├── api.test.ts           # Bun 单元测试（使用 inject 方法）
├── setup.ts              # 测试辅助工具
└── e2e-smoke.sh          # Shell 端到端测试
```

## 测试覆盖

### api.test.ts

使用 Bun Test 框架的单元/集成测试，覆盖：

1. **健康检查**
   - GET /health
   - GET /health/db

2. **认证流程**
   - POST /api/v1/auth/register - 注册新用户
   - POST /api/v1/auth/login - 用户登录
   - GET /api/v1/auth/me - 获取当前用户信息
   - POST /api/v1/auth/token/refresh - 刷新 token

3. **Agent 模板 CRUD**
   - POST /api/v1/agents - 创建 Agent
   - GET /api/v1/agents - 获取 Agent 列表
   - GET /api/v1/agents/:id - 获取 Agent 详情
   - PUT /api/v1/agents/:id - 更新 Agent
   - PATCH /api/v1/agents/:id/activate - 激活 Agent
   - PATCH /api/v1/agents/:id/deactivate - 停用 Agent
   - DELETE /api/v1/agents/:id - 删除 Agent

4. **权限验证**
   - 普通用户不能创建 Agent 模板
   - 普通用户不能删除 Agent 模板
   - 普通用户不能访问其他租户的账单

5. **SSE 端点格式验证**
   - POST /api/v1/agents/:agentId/chat - SSE 聊天端点
   - GET /api/v1/agents/:agentId/history - 历史记录端点

6. **用户管理**
   - POST /api/v1/users - 创建用户
   - GET /api/v1/users - 获取用户列表
   - GET /api/v1/users/:id - 获取用户详情

7. **租户管理**
   - POST /api/v1/tenants - 创建租户
   - GET /api/v1/tenants - 获取租户列表
   - GET /api/v1/tenants/:id - 获取租户详情

8. **错误响应格式统一**
   - 验证所有错误响应包含 error 和 message 字段

### e2e-smoke.sh

完整的用户旅程端到端测试，模拟真实用户操作流程：

1. 健康检查
2. 数据库健康检查
3. 注册管理员用户（创建租户）
4. 登录验证
5. 获取当前用户信息
6. 创建普通用户
7. 普通用户登录
8. 创建 Agent 模板（管理员）
9. 获取 Agent 列表
10. 获取 Agent 详情
11. 测试权限验证
12. 测试 SSE Chat 端点
13. 测试错误响应格式
14. 获取用户列表
15. 获取租户列表

## 运行测试

### Bun 测试

```bash
cd neptune-ai/server
bun test
```

### E2E Smoke 测试

首先确保服务器正在运行：

```bash
cd neptune-ai/server
bun run dev
```

然后在另一个终端运行：

```bash
cd neptune-ai
./test/e2e-smoke.sh [base_url]
```

默认使用 `http://localhost:3000`，可以指定其他 URL：

```bash
./test/e2e-smoke.sh http://localhost:3001
```

## 测试数据

测试使用随机生成的数据，每次运行都不同：

- 租户名称: `Smoke Test Tenant {random}`
- 管理员邮箱: `admin-{random}@test.com`
- 普通用户邮箱: `user-{random}@test.com`

测试数据会保留在数据库中，可在后续测试中使用。

## 注意事项

1. **数据库**: 测试需要连接到可用的数据库
2. **端口**: 确保测试端口（默认 3000）未被占用
3. **清理**: 测试数据不会自动清理，需要手动清理或使用测试数据库

## 故障排查

### 测试失败

1. 检查服务器是否运行
2. 检查数据库连接
3. 查看详细错误日志

### SSE 测试

SSE 端点测试使用 timeout 限制请求时间，避免无限等待。
