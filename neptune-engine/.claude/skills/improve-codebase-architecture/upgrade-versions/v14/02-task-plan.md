# V14 任务计划

> 版本：V14
> 规划日期：2026-04-28
> 核心目标：SDK 构建修复 + 测试覆盖率提升到 90% + API 文档 + e2e 回归
> 基于：01-optimizer-research.md 10 个优化点

---

## 一、项目概述

V14 聚焦 OKR 路线图 V5 剩余 20% 工作，核心打通 SDK 发布链路：
1. **P1 阻塞项**：修复 `build:sdk`，使 SDK 可独立生成类型声明
2. **测试覆盖**：engine/ 从 ~70% 提升到 ~90%（补齐 11 个未覆盖模块）
3. **文档补齐**：配置 TypeDoc 生成 API 文档
4. **集成验证**：e2e_cli 适配新特性，SDK 依赖优化

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责范围 | 能力要求 |
|------|------|---------|---------|
| team-lead | 1 | 任务分配、进度管理、质量把控 | 协调能力、代码审核 |
| developer-1 | 1 | SDK 构建修复 + 存储测试 + Session测试 + TypeDoc | TypeScript、tsc 配置、测试编写 |
| developer-2 | 1 | 权限测试 + 错误测试 + 启动测试 + e2e适配 + 依赖优化 | 测试编写、e2e 验证、依赖管理 |

**团队规模**：3 人（1 lead + 2 developer）

**协作方式**：
- team-lead 负责任务分配和代码审核
- developer-1 专注构建链路 + 存储层
- developer-2 专注权限/错误测试 + 集成验证
- 通过 TaskList 协调进度

---

## 三、任务阶段规划

### 阶段 A：SDK 构建修复 + 测试启动（4 任务）

**目标**：`build:sdk` 通过 + 开始测试补齐

| 任务 | 执行人 | 验收 |
|------|--------|------|
| T1: SDK 构建配置修复 | developer-1 | `build:sdk` 零错误 |
| T2: 权限委托测试补齐 | developer-2 | 3 个 Delegate 全覆盖 |
| T3: 错误体系与辅助工具测试 | developer-2 | errors + helpers 覆盖 |
| T4: 存储层测试补齐 | developer-1 | 5 个实现全覆盖 |

### 阶段 B：构建验证 + 测试深化（4 任务）

**目标**：构建产物验证 + 剩余测试补齐

| 任务 | 执行人 | 验收 |
|------|--------|------|
| T5: SDK 构建产物验证 | developer-1 | 产物干净，体积 < 2MB |
| T6: Session 子模块测试 | developer-1 | TokenBudget + Transcript + Storage |
| T7: bootstrap 和 skill 测试 | developer-2 | initializeEngine + SkillLoader |
| T8: e2e_cli 新特性适配 | developer-2 | QueryEvent + EngineEventMap |

### 阶段 C：文档与优化（2 任务）

**目标**：API 文档生成 + 依赖优化

| 任务 | 执行人 | 验收 |
|------|--------|------|
| T9: API 文档生成 (TypeDoc) | developer-1 | docs/api/ 生成 |
| T10: SDK 依赖优化 | developer-2 | Provider SDK 可选化 |

---

## 四、任务清单

| 编号 | 任务名称 | 任务目标 | 执行人 | 依赖 | 验收标准 |
|------|---------|---------|--------|------|---------|
| T1 | SDK 构建配置修复 | 修复 tsconfig.sdk.json，使 build:sdk 通过 | developer-1 | 无 | 1. `bun run build:sdk` 零错误<br>2. `dist/sdk/index.d.ts` 生成<br>3. tsconfig.sdk.json 移除 builtin-tools<br>4. 设置 emitDeclarationOnly: true |
| T2 | 权限委托测试补齐 | 为 3 个 PermissionDelegate 写测试 | developer-2 | 无 | 1. ReadOnlyPermissionDelegate 测试通过<br>2. RBACPermissionDelegate 测试通过（角色映射、权限检查）<br>3. AuditPermissionDelegate 测试通过（审计日志记录）<br>4. 每个至少 5 个测试用例 |
| T3 | 错误体系与辅助工具测试 | 为 errors + helpers + EngineState + Session 补测试 | developer-2 | 无 | 1. EngineError cause 链测试通过<br>2. EngineErrorCode 分类测试通过<br>3. collectText/waitForResult 测试通过<br>4. EngineState 测试通过<br>5. Session 数据实体测试通过 |
| T4 | 存储层测试补齐 | 为 storage/ 5 个实现写测试 | developer-1 | 无 | 1. InMemoryBackend CRUD + 边界测试通过<br>2. FilesystemBackend 读写 + 错误处理测试通过<br>3. CompositeBackend LRU 路由 + 降级测试通过<br>4. InMemorySessionStore 测试通过<br>5. SQLiteSessionStore 测试通过 |
| T5 | SDK 构建产物验证 | 验证构建产物干净可用 | developer-1 | T1 | 1. dist/sdk/ 零 React/Ink 类型引用<br>2. dist/sdk/ 体积 < 2MB<br>3. package.json files 字段正确<br>4. 脚本添加 build:verify 验证命令 |
| T6 | Session 子模块测试 | 补齐 TokenBudget + TranscriptParser + SessionContextStorage | developer-1 | 无 | 1. TokenBudgetManager 预算计算测试通过<br>2. TranscriptParser JSONL 解析测试通过<br>3. SessionContextStorage 上下文传播测试通过 |
| T7 | bootstrap 和 skill 测试 | 补齐 initializeEngine + SkillLoader 测试 | developer-2 | T3 | 1. initializeEngine 配置验证测试通过<br>2. initializeEngine 组件初始化测试通过<br>3. SkillLoader 加载测试通过<br>4. SkillLoader 目录创建测试通过 |
| T8 | e2e_cli 新特性适配 | e2e_cli 使用 V13 新类型特性 | developer-2 | 无 | 1. query 返回类型改用 QueryEvent（替换 any）<br>2. 事件监听使用 EngineEventMap 类型安全<br>3. 配置改用新格式（tools/skills 顶层，保持旧格式兼容）<br>4. e2e_cli tsc 无错误 |
| T9 | API 文档生成 | 配置 TypeDoc 生成 SDK 文档 | developer-1 | T5 | 1. typedoc.json 配置完成<br>2. `bun run docs:api` 可生成文档<br>3. 文档输出到 docs/api/<br>4. engine/ 公共 API 覆盖率 100% |
| T10 | SDK 依赖优化 | Provider SDK 可选化 | developer-2 | T2, T8 | 1. bedrock-sdk/vertex-sdk/foundry-sdk 移到 optionalDependencies<br>2. 各 Provider 优雅降级（try/catch + error message）<br>3. bun install 验证可选依赖不阻塞安装<br>4. engine/ 测试全部通过 |

---

## 五、依赖关系图

```
T1 (构建修复) ──────→ T5 (构建验证) ──→ T9 (TypeDoc)
                       ↗
T4 (存储测试) ────────→ 覆盖率统计
T6 (Session测试) ─────→ 覆盖率统计     → V5 门禁
T2 (权限测试) ──────┬→ 覆盖率统计
T3 (错误测试) ──────┤→ T7 (启动测试)
T8 (e2e适配) ───────┤→ 覆盖率统计
                    └→ T10 (依赖优化)
```

**关键路径**：T1 → T5 → T9（SDK 构建 → 验证 → 文档）

**并行路径**：T2/T3/T4/T6/T8 之间无依赖，最大化并行

---

## 六、工作量估算

| 任务 | 复杂度 | 新增测试数估算 | 文件改动估算 |
|------|--------|-------------|------------|
| T1 | 中 | 0 | 1-2 文件（tsconfig） |
| T2 | 低 | ~15 | 3 文件 |
| T3 | 低 | ~15 | 4-5 文件 |
| T4 | 中 | ~20 | 5 文件 |
| T5 | 低 | ~5 | 2-3 文件 |
| T6 | 中 | ~15 | 3 文件 |
| T7 | 中 | ~10 | 2 文件 |
| T8 | 低 | 0 | 2-3 文件 |
| T9 | 中 | 0 | 2-3 文件 |
| T10 | 中 | ~5 | 3-4 文件 |
| **合计** | — | **~85** | **~30 文件** |

---

## 七、版本完成标准

V14 版本完成需满足：

1. **SDK 构建门禁**：`bun run build:sdk` 零错误，`dist/sdk/index.d.ts` 生成
2. **测试覆盖门禁**：engine/ 测试用例 ≥ 530（当前 446 + ~85 新增）
3. **API 文档门禁**：`bun run docs:api` 生成完整 API 文档
4. **e2e 验证门禁**：e2e_cli tsc 零错误，类型安全
5. **全部测试通过**：`bun test` 零失败
