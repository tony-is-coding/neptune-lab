# Git 分支工作流

## 分支模型

```
main ← 稳定发布线（仅接受里程碑合入）
 │
develop ← 日常研发主线
 │
feature/* ← 功能分支（从 develop 拉出，合回 develop）
```

## 核心规则

### develop 分支

- **定位**：日常研发主线，所有功能开发基于此分支
- 功能分支从 develop 拉出，完成后通过 PR 合回 develop
- 保持可编译、可运行状态

### main 分支

- **定位**：稳定发布线，仅接受经过验证的里程碑版本
- **合入条件**：develop 上的代码达到里程碑标准后，先在 develop 打 tag（如 `v0.8.0`），再将 develop 合入 main
- 禁止直接向 main 推送代码
- 禁止未经 tag 的代码合入 main

### 功能分支

- 命名：`feat/<功能名>` 或 `fix/<问题描述>`
- 生命周期：从 develop 创建 → 开发完成 → PR 合入 develop → 删除分支

## 发布流程

```
1. develop 达到里程碑目标
2. 在 develop 上打 tag：git tag v0.X.0
3. 合入 main：git checkout main && git merge develop
4. 推送：git push origin main --tags
```

## 禁止事项

- 禁止 force push 到 main 或 develop
- 禁止跳过 PR 直接推送 develop（agent 分支除外）
- 禁止未打 tag 就将代码合入 main
