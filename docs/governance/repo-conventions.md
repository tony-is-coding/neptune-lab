# Neptune Lab 仓库统一规范

## 目录规范

- 每个产品线是一个顶级目录，有独立的 `CONTEXT.md`
- 根 `CONTEXT-MAP.md` 是仓库导航入口
- `shared/` 存放跨产品共享资源
- 各产品内部遵循相同的文档结构规范（详见 [DOCUMENTATION.md](../DOCUMENTATION.md)）

## 文档规范

- `docs/adr/` — 架构决策记录（详见 [ADR README](../adr/README.md)）
- `{product}/docs/design/` — 产品设计文档（正式）
- `{product}/docs/feature-design/` — 功能设计文档（仅 engine）
- `docs/governance/` — 团队规范
- `docs/references/` — 外部参考资料（学习用，可归档删除）

## 依赖规范

- engine 不依赖任何产品代码
- 产品之间互不依赖
- shared 不依赖任何产品和 engine
- 产品可以依赖 shared 和 engine

## 新增产品流程

1. 创建目录 + CONTEXT.md
2. 更新 CONTEXT-MAP.md
3. 如有架构决策，补 ADR
