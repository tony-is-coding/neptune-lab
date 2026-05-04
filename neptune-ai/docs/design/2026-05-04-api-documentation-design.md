# API 文档设计

> 日期：2026-05-04
> 状态：已确认
> 目的：为 neptune-ai/web 前端对接后端服务提供完整的 API 契约文档

---

## 背景

neptune-ai/web 是基于 React + Vite + Tailwind 的新前端项目，需要对接 neptune-ai/server 后端服务。
本文档定义 API 文档的交付格式、结构和规范。

## 设计决策

### 交付格式

Markdown 文档，按资源模块分文件，存放于 `docs/api/` 目录。

选择理由：
- 前后端对接最需要清晰的模块边界和完整的请求/响应示例
- Markdown 易于版本控制，与代码一起演进
- 前端可按功能模块独立查阅

### 文档结构

```
docs/api/
├── README.md              # 总览：认证方式、通用约定、错误格式、分页规范
├── auth.md                # 认证模块
├── tenants.md             # 租户管理
├── users.md               # 用户管理
├── agents.md              # Agent 模板（含文档管理）
├── sessions.md            # 对话（SSE + 历史）
├── billing.md             # 计费
└── gap-analysis.md        # 前端需求 vs 现有接口缺口分析
```

### 每个模块文档的统一模板

```markdown
# 模块名

## 接口总览
| 方法 | 路径 | 认证 | 角色 | 说明 |

## 接口详情
### METHOD /path
**认证**：无 / Bearer Token
**角色**：- / admin / 任意已认证

#### 请求参数
| 位置 | 字段 | 类型 | 必填 | 说明 |

#### 请求示例
（JSON body / query string 示例）

#### 成功响应
| 状态码 | 说明 |

#### 响应示例
（JSON 示例）

#### 错误响应
| 状态码 | error | 触发条件 |
```

### 通用约定（README.md 内容）

- Base URL: `http://localhost:3000/api/v1`
- 认证: Bearer Token (JWT, HS256)
- accessToken 有效期: 1h，refreshToken 有效期: 7d
- 请求格式: `application/json`
- 分页: Query String `?limit=20&offset=0`，默认 limit=100, offset=0
- 列表响应: `{ data: [], meta: { count, limit, offset } }`
- 错误响应: `{ error: "ERROR_CODE", message: "描述" }`
- 时间格式: ISO 8601
- ID 格式: UUID v4
- SSE 协议: connected / message / done / error 四种事件类型

### 缺口分析策略

分析前端 web 项目的页面和功能需求，逐页面对比现有后端接口：
- 已有接口：标注可直接使用
- 缺失接口：列出需求描述，后续根据前端开发需要一起设计

## 现有接口清单（共 28 个）

### 认证 (4)
- POST /auth/login
- POST /auth/register
- POST /auth/token/refresh
- GET /auth/me

### 租户 (5)
- POST /tenants
- GET /tenants
- GET /tenants/:id
- PUT /tenants/:id
- DELETE /tenants/:id

### 用户 (5)
- POST /users
- GET /users
- GET /users/:id
- PUT /users/:id
- DELETE /users/:id

### Agent 模板 (11)
- POST /agents
- GET /agents
- GET /agents/:id
- PUT /agents/:id
- DELETE /agents/:id
- PATCH /agents/:id/activate
- PATCH /agents/:id/deactivate
- GET /agents/:id/stats
- GET /agents/:id/documents
- POST /agents/:id/documents
- DELETE /agents/:id/documents/:docId

### 对话 (2)
- POST /agents/:agentId/chat (SSE)
- GET /agents/:agentId/history

### 计费 (1)
- GET /tenants/:id/billing

## 范围声明

本会话只关注后端开发。前端需要的缺失接口，后续按需一起设计。
