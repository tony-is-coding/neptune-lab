# CLAUDE.md — Neptune CLI

## 顶级规则

所有沟通过程、文档都必须使用中文。

## 项目概述

Neptune CLI 是基于 neptune-engine SDK 构建的终端产品。代码源自 Claude Code CLI 的反编译/逆向工程版本，许多模块被 stub 或 feature flag 关闭。

## 开发命令

```bash
bun install           # 安装依赖
bun run dev           # 开发模式
bun test              # 运行测试
bun run build         # 构建
bunx tsc --noEmit     # 类型检查
```

## 技术栈

- 运行时：Bun（不是 Node.js）
- UI：React + Ink（终端渲染）
- 模块系统：ESM + TSX
- 构建：Bun.build with splitting
