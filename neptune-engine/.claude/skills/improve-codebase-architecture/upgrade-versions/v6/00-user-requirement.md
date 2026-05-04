# V6 用户需求文档

## 需求概述
继续 V5 核心层深度解耦的后续待办工作，以架构优化为主线。

## 优化目标
- 将 Claude Code 核心执行能力从 CLI 宿主中进一步解耦
- 消除大文件结构性瓶颈（REPL.tsx 6314行、SessionStorage 5106行）
- 完善模块间解耦（Provider、Permission、Memory、QueryDeps）

## 关注范围
V5 后续待办中的架构类优化项，共 7 项。

## 优先级排序
1. **P0** O15 REPL.tsx 拆分（6314行）— headless/SDK 模式的关键阻塞
2. **P1** 剩余工具 UI 分离（~18个文件）— CoreTool 接口完整性
3. **P2** O2 Provider 适配器 + O7 SessionStorage + O8 QueryDeps
4. **P3** O11 Permission + O12 Memory

## 约束条件
- 最小改动现有代码，优先包裹和外扩
- 核心 agent loop 尽量不变
- 100% 向后兼容

## 验收标准
- tsc 零错误
- 全量测试通过
- lint:layers 零违规
- 新增模块零 React 依赖
