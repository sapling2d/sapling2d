# 0013 — 裁剪是 Node2D 的属性、渲染与拾取共用一套规则；界面控件放独立包

**Status:** Accepted (2026-10-31)

## Context

对比主流小游戏引擎（Cocos Creator、LayaAir 把 Mask、ScrollView、Button、Widget、ProgressBar 作为标配），sapling2d 最大的能力缺口是 UI：原语只有 `Label`、`ColorRect`、`NineSliceSprite`、`CanvasLayer`，渲染层没有任何裁剪能力。真实游戏（hero-guard）为此自己写了 `Button`、`Overlay`、`Dialog` 和皮肤表，选关面板因为没有滚动只能硬排三关；进度条靠改 `scale.x` 实现，九宫格会变形。

要决定的有三件事：裁剪以什么形态进引擎；裁剪和指针拾取的关系；控件放核心还是独立包。

真机 spike（`spikes/clip/REPORT.md`，iPhone 17，微信基础库 3.17.6，WebGL1）：Pixi v8 的 `Container.mask`（stencil）嵌套 4 层、旋转、和 `keep` 模式的根 mask 叠加都正确；10 个裁剪容器对 200 个精灵的渲染代价约 +0.45 ms / 帧，60 fps 不掉。Pixi v8 不会自动把轴对齐矩形的 mask 换成 scissor。

## Decision

### 裁剪是 `Node2D.clipRect`，不是节点

`clipRect: Rect2 | null`（局部坐标，默认 null）裁掉节点自己的内容和整个子树，嵌套取交集，随节点变换走；子树里的 `CanvasLayer` 自成一层不受影响。滚动窗口、进度条填充、头像框都只是"某个节点裁子树"，不值得多一个节点类型（Godot 的 `clip_children` 也是属性）。第一版只做矩形；圆形 / 贴图遮罩需要另一套渲染设施，不在此 ADR 内。

渲染层用 Pixi 的容器 mask（矩形 Graphics，stencil），放在节点容器的第 0 个子对象、算进"节点自己的显示对象"（`_syncChildren` 对账时和内容层、覆盖层同类，否则每帧会被移掉），只在矩形变化时重建几何，置 null 时移除并销毁。不做 scissor 路径：spike 数据说明不值得；出现几十个同屏裁剪容器时再评估。

### 拾取遵守同一套规则

被自己或祖先的 `clipRect` 裁掉的位置点不到，`clicked` 也要求抬起时在裁剪区里（`hitsAt` 和路由器的抬起判定都走 `Node2D._insideClips`，沿 `_canvasParent` 链到 CanvasLayer 为止）。正在拖着的节点滚出裁剪区不被打断（帧首的 `cancelUnhittable` 不看裁剪）。被裁掉的位置算空白，会触发 `pointerPress()` 动作。draw-order 测试用 Pixi 容器上的 mask 交叉验证拾取结果，保证画不出来的地方也点不到。

### 控件放独立包 `@sapling2d/ui`，核心只加原语

判据沿用 ADR 0010 / 0011：**需要渲染层或指针路由私有能力的进核心（原语）；用公开 API 写得出来、带默认皮肤的进独立包**。控件包验证原语够不够用，和 `@sapling2d/touch` 验证 `InputSource` 一样；写不出来就补原语，不把控件搬进核心。

`@sapling2d/ui`：`ui()` 插件预加载一套中性的默认皮肤（`~@sapling2d/ui/`，ADR 0011）并提供 `UiTheme`（按下反馈和点击音效的全局默认）；`Control`（`size` / `rect`、点击区域默认是矩形、按 `safeRect` 的锚点）、`Button`、`ProgressBar`。控件原点一律在左上角（和 `ColorRect` 一样）；`Button` 的按下反馈作用在原点在中心的内部主体 `body` 上，节点自身的 `scale` / `rect` 不变，布局不受影响。所有取消路径（滑出抬起、切后台、隐藏、途中禁用）只走 `pointerUp` 一条信号，控件不需要区分"抬起"和"取消"；`disabled` 时 `hitTest` 返回 false，路由器抬起时就不会发 `clicked`。皮肤只有默认一套：实际游戏里按钮图大多各不相同，按控件传 `texture` 即可，不做全局换皮。

### 挂起：捕获转移与滚动列表

`ScrollContainer` 需要"手指滑过阈值后把捕获从子按钮手里抢过来"的原语（`Node2D.capturePointer`），它是该原语唯一的消费者。按本 ADR 的判据，没有消费者的原语不进核心：两者一起挂起（工单 03 / 06 / 07），等滚动列表或翻页器立项时再做。

## Consequences

- 游戏不再需要自己拼按钮和进度条；hero-guard 的 `Button` 变成 `@sapling2d/ui` 按钮的一层皮肤适配，HUD 的三条血条 / 经验条换成 `ProgressBar`。
- `clipRect` 让渲染和拾取有了同一个"可见性"概念；以后任何控件都可以靠它裁内容而不用切贴图。
- 每个带裁剪的节点多一次 stencil 写入；按 spike 的数据，UI 里一两个裁剪容器可以忽略。
- 滚动列表仍然缺位：长列表的界面（多于一屏的关卡、商店）暂时要靠分页或固定布局。
