# E2E Testing Skill 初始化
> 日期：2026-05-06
> 来源：用户要求创建 skill

## 测试策略决策

### 独立 playwright config
- 测试配置放在 skill 目录下，不依赖 `web/playwright.config.ts`
- 前端 dev server 需手动启动（3004 端口），config 不自动启动

### SSE 测试方案
- SSE 端点通过 `page.route()` mock 后端响应
- 不依赖真实大模型 API（避免 API key 依赖、延迟、费用）
- Mock 格式严格匹配后端 SSE 格式：`event: message\ndata: {JSON}\n\n`

### 测试数据
- 通过 API 创建（`createAgentViaApi`、`createThreadViaApi`）
- 使用默认管理员账号 admin@neptune.ai / admin
- 不依赖 UI 预置数据

### 依赖关系
```
smoke → auth → agents
              → chat-sse
              → navigation
```
