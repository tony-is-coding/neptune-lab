# 0001: Dara Mono-Repo 结构规范

日期: 2026-05-03

## 状态

已接受

## 背景

dara 仓库包含多个基于 neptune-engine SDK 的产品线。当前文档分散、CLAUDE.md 职责混乱、缺乏导航入口，需要建立统一的目录和文档规范。

## 决策

采用 CONTEXT.md / CONTEXT-MAP.md 驱动的文档导航体系，扁平产品线 + 顶层 shared/ 共享层结构。详细规范见 `docs/superpowers/specs/2026-05-03-mono-repo-structure-design.md`。

## 后果

- 所有产品线遵循统一的 CONTEXT.md 规范
- 文档按严谨性分级（docs/adr/、docs/design/、research-docs/）
- 各产品独立研发，通过 shared/ 共享跨产品资源
- neptune-buddy 等未来产品只需创建目录和 CONTEXT.md 即可加入
