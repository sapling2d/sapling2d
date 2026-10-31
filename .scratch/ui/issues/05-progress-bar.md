# 05: `ProgressBar` —— 用 `clipRect` 填充的进度条

**What to build:** `new ProgressBar({ size: v(400, 40), value: 0.3 })` 放进 HUD 就是一条进度条：底图和填充各自是九宫格贴图（默认皮肤）或纯色，填充节点始终铺满整条、用自己的 `clipRect` 按比例裁掉未填充部分，所以九宫格不变形；支持四个填充方向、`minValue` / `maxValue`、`fillPadding`；值变化发 `valueChanged`，`dump` 显示 `value`。血条、经验条、加载条不再需要手算 `ColorRect` 宽度。

**Blocked by:** 02 — `clipRect`；04 — `@sapling2d/ui` 包与 `Control`

**Status:** ready-for-agent

- [ ] `value` 夹在 `[minValue, maxValue]`；`ratio` 只读为 0..1；默认范围 0..1
- [ ] 四个 `fillMode` 下填充节点的 `clipRect` 与 `ratio` 对应（左→右裁右边、右→左裁左边、下→上裁上边、上→下裁下边），`fillPadding` 内缩生效；`ratio` 为 0 和 1 的边界正确（0 时填充完全不可见，1 时无裁剪或裁剪等于整条）
- [ ] 填充节点的 `size` 与位置在值变化时不变，只有 `clipRect` 变（九宫格不变形的保证）
- [ ] `valueChanged` 只在值真的变化时发一次；`Tween` 能补间 `value`
- [ ] 纯色模式（`textureBackground: null` / `textureFill: null` + 颜色）不依赖插件；默认皮肤未装插件时警告一次
- [ ] `dump` 显示 `value`
- [ ] 包内 `docs/examples/ui-progress-bar.test.ts`，`llms.template.md` 界面控件一节加进度条段落与节点清单 / dump 条目；`CONTEXT.md` 加 `ProgressBar` 词条
- [ ] 浏览器里肉眼确认九宫格填充在半满时圆角不变形（截图记录在工单评论）
- [ ] `pnpm check` 绿
