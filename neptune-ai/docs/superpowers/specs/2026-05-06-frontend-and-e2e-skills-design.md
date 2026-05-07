# 前端 UI 设计 Skill + E2E 测试 Skill 设计

> 日期：2026-05-06
> 状态：已批准

## 背景

项目需要两个项目级 skill，为前端开发提供纪律约束和自动化验证：

1. **frontend-design** — 强制前端开发遵循 DESIGN.md UI 规范
2. **e2e-testing** — 前端改动后自动运行 Playwright 测试

两个 skill 共享触发条件（`web/src/**`），职责独立。

## Skill 1：frontend-design

### 定位

行为约束型 skill。不提供组件库，不复制 DESIGN.md 内容。强制前端开发在改动前后对照 DESIGN.md 规范验证。

### 目录结构

```
.claude/skills/frontend-design/
├── SKILL.md        # 入口 — 触发规则 + 行为约束 + 验证 checklist
└── memory/         # 用户追加的设计要求（长期进化）
```

### 核心机制

1. **触发**：任何 `web/src/**` 文件修改时加载
2. **修改前**：读取 `neptune-ai/DESIGN.md` + `memory/` 下所有文件
3. **编码时**：严格遵循所有规范
4. **修改后**：逐项验证 checklist
5. **Memory**：用户提出新设计要求时，记录为 `memory/YYYY-MM-DD-<topic>.md`

### 关键设计决策

- **DESIGN.md 是唯一真相来源**，SKILL.md 不复制规范内容
- memory/ 用于记录 DESIGN.md 还没覆盖的新要求
- 当 memory 积累到一定程度，可合并回 DESIGN.md 主规范

## Skill 2：e2e-testing

### 定位

每次前端改动后自动运行 Playwright 测试套件，覆盖系统全部核心流程。

### 目录结构

```
.claude/skills/e2e-testing/
├── SKILL.md              # 入口 — 触发规则 + 覆盖要求 + 编写规范
├── playwright.config.ts  # 独立 playwright 配置
├── tests/
│   ├── helpers.ts        # 公共工具（loginViaApi, API helpers, SSE mock）
│   ├── smoke.spec.ts     # 冒烟测试 — 页面能否渲染
│   ├── auth.spec.ts      # 认证流程 — 登录/注册/token/401 恢复
│   ├── agents.spec.ts    # Agent 管理 — CRUD + 配置
│   ├── chat-sse.spec.ts  # 对话 + SSE 流式 — 核心链路
│   └── navigation.spec.ts # UI 渲染与导航 — 布局 + 路由
└── memory/               # 测试策略演进记录
```

### 核心机制

1. **触发**：任何 `web/src/**` 文件修改完成后自动运行
2. **执行**：`npx playwright test --config=.claude/skills/e2e-testing/playwright.config.ts`
3. **覆盖四大流程**：认证、Agent 管理、对话 SSE、UI 渲染
4. **SSE 测试**：mock 后端响应，不依赖真实大模型 API

### 关键设计决策

- 测试用例在 skill 目录下，随 skill 进化，不依赖 `web/tests/`
- SSE 测试通过 mock 后端响应验证前端解析逻辑
- 公共 helpers 统一管理（登录、API 调用、断言工具）

### 从 web/tests/ 迁移

现有 `web/tests/` 有 10 个测试文件。策略：
1. 提取通用 helpers 到 `skill/tests/helpers.ts`
2. 按功能重组为 5 个核心 spec 文件
3. 新增 SSE mock 层

## 协作关系

```
前端文件修改 (web/src/**)
  ├── 触发 frontend-design skill → 检查 UI 规范合规
  └── 触发 e2e-testing skill     → 运行 Playwright 测试
```

两个 skill 职责独立：frontend-design 管设计规范约束，e2e-testing 管功能正确性验证。
