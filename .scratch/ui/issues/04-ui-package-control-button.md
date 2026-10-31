# 04: `@sapling2d/ui` 包骨架、`ui()` 插件与默认皮肤、`Control`、`Button`

**What to build:** 新 workspace 包 `@sapling2d/ui`，形态照 `@sapling2d/touch`（同样的 tsconfig / tsdown / vitest 配置、`"sapling2d": { "assets": "assets" }` 挂载、生成皮肤 PNG 的脚本、包内 `docs/examples`）。装上 `plugins: [ui()]` 后，`new Button({ text: '开始', size: v(300, 100) })` 放进 `CanvasLayer` 就是一个可用的按钮：默认九宫格皮肤、文字居中、按下时视觉主体围绕中心缩放到 1.1 倍（可配置为压暗或关闭）、滑出恢复、抬起在内发 `clicked` 并播放全局或按钮自己的音效、`disabled` 变半透明且点不到、切后台 / 被盖住自动恢复。`Control` 是带 `size` / `rect` / `anchor` 的基类，可直接实例化当布局盒子，`anchor` 按 `safeRect` 在换屏时重排。不装插件、`texture: null` 时是纯色按钮。

**Blocked by:** None (can start immediately)

**Status:** done（2026-10-31）

- [x] 包结构、`pnpm check` 覆盖新包；`peerDependencies` 的 `sapling2d` 版本范围指向本轮将发布的 minor；根 README / 模板 `AGENTS.md` 的包清单提到 `@sapling2d/ui`
- [x] `ui({ pressEffect?, clickSound? })` 提供 `UiTheme`（皮肤句柄 `UI_SKIN`、全局 `pressEffect` 默认 `{ scale: 1.1, duration: 0.08 }`、全局 `clickSound`）并 `ctx.preload` 默认皮肤；三个平台都能装
- [x] 默认皮肤由脚本生成（按钮底图、按钮按下态、面板 / 进度条底图、进度条填充，每张 ≤ 64×64，灰白中性、可被 `modulate` 染色）；用默认皮肤但没装 `ui()` 的控件进树时警告一次（照 touch 的做法）；`texture: null` 的纯色模式不需要插件
- [x] `Control`：`size` / `rect`（左上角原点）、`hitTest` 用 `rect`（设 `hitArea` 时用 `hitArea`）、`inputPickable` 默认 false、可直接实例化；`anchor`（`left` / `right` / `top` / `bottom` / `centerX` / `centerY`，`anchorTo: 'safe' | 'visible'`）进树和 `viewport.resized` 时重算位置，左右（上下）同时给时拉伸 `size`；场景里（非 CanvasLayer）设 `anchor` 警告一次；`g.setScreen` 换屏后位置按新 `safeRect` 正确
- [x] `Button`：`label: Label` 可访问；`texture` / `margins` / `texturePressed` / `backgroundColor`；按下时视觉主体 `scale` 到 `pressEffect.scale`、节点自身 `scale` 与 `rect` 不变；`pressEffect: false` 主体不动；`tint` 配置时主体 `selfModulate` 变化；按下 / 松开之间先 `kill` 上一个补间
- [x] 手指路径测试：按下 → `pressed` 一次、`isPressed` true；滑出 → 主体恢复、无 `released`；滑回 → 再按下；抬起在内 → `clicked` 一次、`released` 一次、`g.audio.log` 有音效；抬起在外 / 切后台 / 隐藏 / 途中 `disabled = true` → 无 `clicked`、`released` 一次、主体恢复
- [x] `disabled`：`alpha` 0.5（可配）、`inputPickable` false；再启用后恢复
- [x] `clickSound` 优先级：按钮选项 > `UiTheme` 全局 > 无；`null` 显式关闭
- [x] `dump`：`Control` 显示 `size`（`anchor` 非空时显示）；`Button` 按着时 `pressed`、禁用时 `disabled`
- [x] 包内 `docs/examples/ui-button.test.ts` 可运行示例，`llms.template.md` 新节"界面控件（`@sapling2d/ui`）"引用它；节点清单、dump 属性表、常见陷阱（暂停菜单里的控件要 `processMode: 'always'`）更新；`CONTEXT.md` 加 `Control` / `Button` / `UiTheme` 词条和 Entry points 条目
- [x] 浏览器里用一个示例（如 towerdefense 的升级卡片换成 `Button`，或临时页面）肉眼确认缩放围绕中心、皮肤正常，截图记录在工单评论
- [x] `pnpm check` 绿

## Comments

**2026-10-31：** 完成。`packages/ui`（`@sapling2d/ui` 0.1.0）照 touch 包的配置搭起来：`ui({ pressEffect?, clickSound? })` 提供 `UiTheme`、预加载默认皮肤（`scripts/gen-assets.mjs` 生成的 4 张圆角九宫格：按钮、按钮按下态、面板、进度条填充，共 1.9 KB）和全局音效；`Control`（`size` / `rect` / `hitTest` / `anchor` / `anchorTo`，`sizeChanged` 钩子，离树时断开 `resized`）；`Button`（原点左上角，视觉主体 `body` 在中心承担缩放与压暗，`background` 是九宫格或 `ColorRect`，`label` 居中；`pressed` / `released`；`disabled` 时 `hitTest` 也返回 false，所以路由器抬起时不会发 `clicked`；离树时按着算松开）。测试 19 个（control 6、button 12、docs 示例 1）。文档：llms 模板新节"界面控件（`@sapling2d/ui`）"、节点清单、dump 表、常见陷阱、插件列表；CONTEXT 词条和 Entry points；模板 `AGENTS.md`、根 README。游戏验证：`examples/towerdefense` 的升级卡片换成 `Button`（标题是按钮文字、说明加在 `body` 下），13 个测试不改即通过；浏览器里按住卡片看到围绕中心放大 1.04 并换成按下态底图，抬起后选中升级、面板关闭。

两点留给后面：`peerDependencies` 暂时写 `>=0.4.0`，08 发布时改成本轮的 minor；默认按下反馈是缩放 1.1（讨论中给的数字），真机上觉得夸张的话在 08 调。切后台的语义：`pauseOnBackground` 让游戏挂起，按着的手指在回到前台的第一帧收到抬起（`released`），测试按这个写。
