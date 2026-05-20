---
name: "frontend-design"
description: "\u524d\u7aef UI \u5f00\u53d1\u65f6\u5f3a\u5236\u9075\u5faa DESIGN.md \u89c4\u8303\u3002\u6bcf\u6b21\u6539\u52a8\u524d\u540e\u5bf9\u7167\u9a8c\u8bc1\u989c\u8272\u3001\u5b57\u4f53\u3001\u5e03\u5c40\u3001\u7ec4\u4ef6\u6837\u5f0f\u3002\u7528\u4e8e web/src/** \u4e0b\u7684\u4efb\u4f55\u524d\u7aef\u6587\u4ef6\u4fee\u6539\u3002"
---

# Frontend Design — UI 规范约束

## 触发时机

任何 `web/src/**` 下的文件修改时，必须加载此 skill。

## 行为约束（必须按顺序执行）

### Step 1：修改前 — 加载规范

1. 读取 `neptune-ai/DESIGN.md` 获取完整设计规范（唯一真相来源）
2. 读取 `.agents/skills/frontend-design/memory/` 下所有 `.md` 文件，获取追加的设计要求
3. 理解当前要修改的组件/页面在设计系统中的角色

### Step 2：编码时 — 严格遵循

编码过程中所有 UI 相关决策必须符合 DESIGN.md + memory/ 中的规范。

### Step 3：修改后 — 逐项验证

修改完成后，对照以下 checklist 逐项检查：

**颜色验证**
- [ ] 主背景是否使用 Parchment `#f5f4ed`？（严禁纯白 `#ffffff` 作为页面背景）
- [ ] 卡片表面是否使用 Ivory `#faf9f5`？
- [ ] 品牌色是否仅用于主 CTA（Terracotta `#c96442`）？
- [ ] 所有中性色是否为暖调（黄棕底色）？是否有冷蓝灰色？（严禁）
- [ ] 边框是否使用 Border Cream `#f0eee6`（浅）或 `#e8e6dc`（强调）？

**字体验证**
- [ ] 标题是否使用 Serif 字体（Anthropic Serif / Georgia）？
- [ ] 正文/UI 是否使用 Sans 字体（Anthropic Sans / Arial）？
- [ ] Serif 字体 weight 是否不超过 500？（严禁 700+）
- [ ] 正文 line-height 是否 >= 1.40？（推荐 1.60）

**布局验证**
- [ ] 间距是否基于 8px 基数？（刻度: 3/4/6/8/10/12/16/20/24/30）
- [ ] 圆角是否 >= 6px？（严禁尖角）
- [ ] 最大容器宽度是否 ~1200px？

**阴影验证**
- [ ] 是否使用 ring shadow（`0px 0px 0px 1px`）代替传统 drop shadow？
- [ ] 如需 drop shadow，是否极度柔和（opacity <= 0.05）？

**组件验证**
- [ ] 按钮样式是否符合 4 种变体之一（Warm Sand / White / Dark / Terracotta）？
- [ ] 卡片是否有 `1px solid #f0eee6` 边框？
- [ ] 输入框 focus 是否使用 Focus Blue `#3898ec`？

## 新增设计要求的记录

当用户提出 DESIGN.md 未覆盖的设计要求时：

1. 在 `memory/` 下创建文件：`YYYY-MM-DD-<topic>.md`
2. 文件格式：
   ```markdown
   # <Topic>
   > 日期：YYYY-MM-DD
   > 来源：用户要求 / 设计决策

   ## 规范内容
   （具体的设计要求描述）

   ## 适用范围
   （哪些组件/页面需要遵循）
   ```
3. 后续前端开发自动加载此文件

## 严格禁忌

以下行为在任何情况下都不允许：
- 使用冷蓝灰色（如 `#6b7280`、`#9ca3af`、`#e5e7eb`）
- 使用纯白 `#ffffff` 作为页面背景
- Serif 标题使用 bold (700+) weight
- 圆角 < 6px
- 使用传统重投影（如 `box-shadow: 0 4px 12px rgba(0,0,0,0.15)`）
- 使用非设计系统定义的饱和色
