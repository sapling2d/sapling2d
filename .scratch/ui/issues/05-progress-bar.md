# 05: `ProgressBar` —— 用 `clipRect` 填充的进度条

**What to build:** `new ProgressBar({ size: v(400, 40), value: 0.3 })` 放进 HUD 就是一条进度条：底图和填充各自是九宫格贴图（默认皮肤）或纯色，填充节点始终铺满整条、用自己的 `clipRect` 按比例裁掉未填充部分，所以九宫格不变形；支持四个填充方向、`minValue` / `maxValue`、`fillPadding`；值变化发 `valueChanged`，`dump` 显示 `value`。血条、经验条、加载条不再需要手算 `ColorRect` 宽度。

**Blocked by:** 02 — `clipRect`；04 — `@sapling2d/ui` 包与 `Control`

**Status:** done（2026-10-31）

- [x] `value` 夹在 `[minValue, maxValue]`；`ratio` 只读为 0..1；默认范围 0..1
- [x] 四个 `fillMode` 下填充节点的 `clipRect` 与 `ratio` 对应（左→右裁右边、右→左裁左边、下→上裁上边、上→下裁下边），`fillPadding` 内缩生效；`ratio` 为 0 和 1 的边界正确（0 时填充完全不可见，1 时无裁剪或裁剪等于整条）
- [x] 填充节点的 `size` 与位置在值变化时不变，只有 `clipRect` 变（九宫格不变形的保证）
- [x] `valueChanged` 只在值真的变化时发一次；`Tween` 能补间 `value`
- [x] 纯色模式（`textureBackground: null` / `textureFill: null` + 颜色）不依赖插件；默认皮肤未装插件时警告一次
- [x] `dump` 显示 `value`
- [x] 包内 `docs/examples/ui-progress-bar.test.ts`，`llms.template.md` 界面控件一节加进度条段落与节点清单 / dump 条目；`CONTEXT.md` 加 `ProgressBar` 词条
- [x] 浏览器里肉眼确认九宫格填充在半满时圆角不变形（截图记录在工单评论）
- [x] `pnpm check` 绿

## Comments

**2026-10-31：** 完成。`ProgressBar extends Control`：`value` / `minValue` / `maxValue` / `ratio`、`valueChanged`（夹紧后真变了才发）、四个 `fillMode`、`fillColor`（贴图填充走 `selfModulate`，纯色走 `color`）、`fillPadding`（默认皮肤 6）；底和填充各自是九宫格（默认皮肤 panel + barFill）或 `ColorRect`。填充节点始终铺满，`clipRect` 按比例裁；0 时 `visible = false`、满时 `clipRect = null`（没有遮罩开销）。`value` 可补间（`Tween.to` 的泛型重载）。测试 9 个 + 文档示例 1 个；llms 模板加"进度条"小节、节点清单 / dump 表；CONTEXT 词条。游戏验证：塔防 HUD 加了命的条（范围按首次 update 的命数定，低于 30% 变红），浏览器里 4/10 时填充左侧圆角完好、右侧直切，九宫格不变形。`pnpm check` 全绿。

按用户决定：皮肤只保留默认一套，不加 `ui({ skin })` 全局覆盖——实际游戏里按钮图大多各不相同，按控件传 `texture` 就够。
