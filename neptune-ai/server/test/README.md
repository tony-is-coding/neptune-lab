# 任务 #6 测试说明

## 测试目标

验证 Bun + Fastify 项目基础搭建和 DB Schema 定义是否正确。

## 测试用例

### 1. 项目结构验证
- 验证 package.json 存在且配置正确
- 验证 tsconfig.json 存在
- 验证 drizzle.config.ts 存在
- 验证 docker-compose.yml 存在

### 2. Fastify 服务器验证
- 验证 Fastify 应用可以成功创建
- 验证 CORS 插件已注册

### 3. 健康检查端点验证
- 验证 GET /health 返回 200 状态码
- 验证响应包含正确的状态信息

### 4. 数据库连接验证
- 验证能够连接到数据库
- 验证 GET /health/db 端点返回数据库状态

### 5. DB Schema 验证
- 验证所有表定义已导出
- 验证所有类型定义已导出

### 6. 依赖验证
- 验证 Fastify 可以正常导入
- 验证 Drizzle ORM 可以正常导入
- 验证 postgres 可以正常导入

### 7. 配置验证
- 验证配置可以正常加载
- 验证默认配置值正确

## 如何运行测试

### 前置条件

1. 确保 Docker 已安装并运行
2. 启动数据库服务：

```bash
cd /Users/terrence_tan/startups/claude-not-only-code/neptune-ai/server
docker-compose up -d
```

3. 等待数据库启动完成（约 5-10 秒）

### 运行测试

```bash
cd /Users/terrence_tan/startups/claude-not-only-code/neptune-ai/server
bun test
```

### 预期结果

所有测试用例应该通过，输出类似：

```
✓ 项目结构验证
  ✓ package.json 存在
  ✓ tsconfig.json 存在
  ✓ drizzle.config.ts 存在
  ✓ docker-compose.yml 存在

✓ Fastify 服务器验证
  ✓ Fastify 应用创建成功
  ✓ CORS 插件已注册

✓ 健康检查端点验证
  ✓ GET /health 返回 200

✓ 数据库连接验证
  ✓ 数据库连接成功
  ✓ GET /health/db 返回数据库状态

✓ DB Schema 验证
  ✓ 所有表定义已导出
  ✓ 所有类型定义已导出

✓ 依赖验证
  ✓ Fastify 导入成功
  ✓ Drizzle ORM 导入成功
  ✓ postgres 导入成功

✓ 配置验证
  ✓ 配置加载成功
  ✓ 默认配置值正确
```

## 故障排查

### 数据库连接失败

如果看到 "数据库连接失败" 错误：

1. 检查 Docker 容器是否运行：
   ```bash
   docker ps
   ```

2. 检查数据库日志：
   ```bash
   docker logs neptune-postgres
   ```

3. 重启数据库：
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### 依赖安装问题

如果遇到依赖导入错误：

```bash
bun install
```

## 下一步

测试通过后，可以继续：
- 任务 #7: 认证模块 - JWT 签发/验证/中间件
- 任务 #8: 租户/用户/Agent 模板 CRUD
