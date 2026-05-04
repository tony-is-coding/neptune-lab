# 缺口分析 — 前端需求 vs 现有接口

> 分析日期: 2026-05-04
> 分析范围: neptune-ai/web 前端页面 vs neptune-ai/server 后端接口

---

## 前端页面与接口对应关系

### 1. Login 页面 (`/login`)

| 功能需求 | 对应接口 | 状态 |
|----------|----------|------|
| 邮箱+密码登录 | `POST /auth/login` | ✅ 已有 |
| 记住我（30天） | - | ⚠️ 前端有 UI，但后端无特殊支持。当前 refreshToken 有效期 7 天，需延长或新增机制 |
| 忘记密码 | - | ❌ 缺失：需要密码重置流程（发送邮件 + 重置 Token） |
| Google 登录 | - | ❌ 缺失：需要 OAuth 2.0 集成 |
| 注册 | `POST /auth/register` | ✅ 已有 |

### 2. Home 页面 (`/`)

| 功能需求 | 对应接口 | 状态 |
|----------|----------|------|
| 获取活跃 Agent 列表 | `GET /agents?active=true` | ✅ 已有 |
| 选择 Agent 并发消息 | `POST /agents/:agentId/chat` (SSE) | ✅ 已有 |
| 显示最近活动信息 | - | ⚠️ 部分缺失：Agent 列表接口不包含"最近活动时间"和"最近消息摘要" |
| 用户头像和通知 | `GET /auth/me` | ⚠️ 部分缺失：用户数据无头像 URL，无通知系统 |

### 3. Collaborate 页面 (`/collaborate/:id`)

| 功能需求 | 对应接口 | 状态 |
|----------|----------|------|
| 获取活跃 Agent 列表 | `GET /agents` | ✅ 已有 |
| SSE 流式对话 | `POST /agents/:agentId/chat` | ✅ 已有 |
| 对话历史 | `GET /agents/:agentId/history` | ✅ 已有 |
| 线程管理（Threads） | - | ❌ 缺失：前端有线程 UI，后端无线程概念（当前每 Agent 一个 Session） |
| Canvas / 附件功能 | - | ❌ 缺失：前端有 Canvas 展示区，后端无 Artifact 生成和返回机制 |

### 4. AgentConfig 页面 (`/agents/:id`)

| 功能需求 | 对应接口 | 状态 |
|----------|----------|------|
| Agent 列表（侧边栏） | `GET /agents` | ✅ 已有 |
| Agent 详情 | `GET /agents/:id` | ✅ 已有 |
| 更新 Agent Profile | `PUT /agents/:id` | ✅ 已有 |
| 更新 Core Config | `PUT /agents/:id` | ✅ 已有 |
| Agent 统计数据 | `GET /agents/:id/stats` | ✅ 已有 |
| 文档管理（Memories） | `GET/POST/DELETE /agents/:id/documents` | ✅ 已有 |
| 文档管理（Knowledge Base） | 同上 | ✅ 已有（与 Memories 共用 documents 接口） |
| 技能管理（Skills） | `PUT /agents/:id` 的 `skills` 字段 | ⚠️ 部分：可以整体更新 skills 列表，但无单独的技能 CRUD 接口 |
| 删除 Agent | `DELETE /agents/:id` | ✅ 已有 |
| Agent 头像 | - | ❌ 缺失：无头像上传/存储机制 |

### 5. CreateAgent 页面 (`/agents/create`)

| 功能需求 | 对应接口 | 状态 |
|----------|----------|------|
| 创建 Agent | `POST /agents` | ✅ 已有 |
| 技能搜索/浏览 | - | ❌ 缺失：前端有"Browse Hub" UI，后端无技能市场/目录接口 |
| 模板 System Prompt | - | ⚠️ 可选：前端有"Use Template"按钮，后端无 Prompt 模板接口 |

### 6. Skills 页面 (`/skills`)

| 功能需求 | 对应接口 | 状态 |
|----------|----------|------|
| 技能列表 | - | ❌ 缺失：无独立的 Skills CRUD 接口。前端使用 Mock 数据 |
| 技能详情 | - | ❌ 缺失 |
| 技能文件树 | - | ❌ 缺失：无技能文件/资源管理接口 |
| 上传技能 | - | ❌ 缺失 |
| 编辑/删除技能 | - | ❌ 缺失 |
| 技能激活/停用 | - | ❌ 缺失 |

---

## 缺失接口汇总

### 高优先级（影响核心用户流程）

| 缺失功能 | 影响页面 | 建议方案 |
|----------|----------|----------|
| Agent 最近活动时间/摘要 | Home | 扩展 `GET /agents` 返回 `lastActiveAt` 和 `lastMessage` 字段 |
| 用户头像 | 全局 | users 表新增 `avatarUrl` 字段，`/auth/me` 和用户接口返回 |

### 中优先级（影响功能完整性）

| 缺失功能 | 影响页面 | 建议方案 |
|----------|----------|----------|
| 线程管理 | Collaborate | 新增 Session Thread 概念，支持多线程对话 |
| Artifact 返回 | Collaborate | 扩展 SSE 事件类型，新增 `artifact` 事件 |
| Agent 头像 | AgentConfig | AgentTemplates 表新增 `avatarUrl` 字段 |

### 低优先级（可后续迭代）

| 缺失功能 | 影响页面 | 建议方案 |
|----------|----------|----------|
| Skills 独立 CRUD | Skills | 新增 `/skills` 路由模块 |
| 技能市场/目录 | CreateAgent | 新增 `/skills/marketplace` 接口 |
| 忘记密码 | Login | 新增密码重置流程 |
| Google OAuth | Login | 新增 OAuth 2.0 集成 |
| Prompt 模板 | CreateAgent | 新增 `/prompt-templates` 接口 |
| 通知系统 | 全局 | 新增通知模块 |

---

## 注意事项

1. **前端当前全部使用 Mock 数据**，所有页面均未接入真实 API
2. **现有 27 个后端接口可覆盖约 60% 的前端需求**
3. 建议按优先级分批对接：先 Login + Home + Collaborate 核心，再 AgentConfig，最后 Skills
4. 缺失接口的具体设计需结合前端实际交互流程一起确定
