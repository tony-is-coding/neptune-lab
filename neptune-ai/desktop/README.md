# Neptune-AI Desktop

Neptune-AI 的 Tauri 桌面应用。

## 技术栈

- **Tauri v2** - 桌面应用框架
- **React 19** - UI 框架
- **TypeScript** - 类型系统
- **TailwindCSS v4** - 样式框架
- **React Router v7** - 路由
- **Zustand** - 状态管理
- **Axios** - HTTP 客户端

## 前置要求

1. **Rust** - Tauri 需要 Rust 工具链
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **系统依赖** - 根据 Tauri 文档安装：
   - macOS: Xcode 命令行工具
   - Linux: 参考 https://tauri.app/start/prerequisites/
   - Windows: WebView2 和 Microsoft Visual C++ Redistributable

## 开发

### 1. 安装依赖

```bash
bun install
```

### 2. 启动开发服务器

```bash
bun run tauri dev
```

这将：
1. 启动 Vite 开发服务器 (http://localhost:1420)
2. 编译 Tauri 后端
3. 打开桌面应用窗口

### 3. 构建生产版本

```bash
bun run tauri build
```

构建产物将在 `src-tauri/target/release/bundle/` 目录下。

## API 配置

默认连接到 `http://localhost:3000/api/v1`。

如需修改，编辑 `src/api/client.ts` 中的 `baseURL`。

## 项目结构

```
src/
├── api/           # API 客户端
│   ├── client.ts  # Axios 封装
│   └── sse.ts     # SSE 客户端
├── components/    # React 组件
│   ├── Layout.tsx
│   ├── MessageBubble.tsx
│   └── ToolCallCard.tsx
├── hooks/         # React Hooks
│   └── useSSE.ts
├── pages/         # 页面组件
│   ├── Login.tsx
│   ├── AgentList.tsx
│   ├── AgentChat.tsx
│   └── admin/
│       ├── Templates.tsx
│       ├── Users.tsx
│       └── Billing.tsx
├── stores/        # 状态管理
│   └── auth.ts
├── types/         # TypeScript 类型
│   └── index.ts
├── App.tsx        # 路由配置
├── main.tsx       # 入口
└── index.css      # TailwindCSS
```

## 功能

### 已实现

- ✅ 用户登录/注册
- ✅ Agent 列表展示
- ✅ Agent 对话界面（基础）
- ✅ SSE 流式响应（基础）
- ✅ 路由守卫
- ✅ 响应式布局

### 待完善

- ⏳ SSE 对话完整实现 (2B-3)
- ⏳ Agent 模板创建/编辑 (2B-4)
- ⏳ 用户管理 (2B-4)
- ⏳ 用量计费 (2B-4)
- ⏳ 对话历史完整实现

## 后端 API

确保后端服务运行在 `http://localhost:3000`。

参考：`../server/README.md`
