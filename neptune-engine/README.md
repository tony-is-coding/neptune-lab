# @neptune/engine

Neptune lightweight agent harness kernel.

## Status: Facade (transitional)

Per spec `docs/superpowers/specs/2026-05-21-neptune-engine-harness-extraction-design.md`,
this package is currently a **thin re-export facade** over
`@neptune/engine-product/engine`. The facade exists so external consumers (notably
`neptune-ai/server`) can import from the canonical name `@neptune/engine` while
the underlying source migration (Stages 4-8 of the spec) lands incrementally.

When all 5 layers have been extracted into this package's own `src/` and the
facade re-exports flip to local imports, this README will be rewritten and the
`@neptune/engine-product` dependency dropped.

## Stage progress

- [x] Stage 1: 包名整改 + codemod
- [x] Stage 2: 物理目录改名
- [x] Stage 3: 建 engine 骨架 + facade
- [ ] Stage 4: 第一层挑回（零依赖）
- [ ] Stage 5: 第二层挑回
- [ ] Stage 6: 第三层挑回（Tool/Task 类型基石）
- [ ] Stage 7: 第四层挑回
- [ ] Stage 8: 第五层挑回（src/engine/）
