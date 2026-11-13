# 界面控件

按钮、进度条、滚动列表这类控件在独立的包 `@sapling2d/ui` 里：

```sh
pnpm add @sapling2d/ui
```

作为插件安装：`plugins: [ui()]` 预加载一套中性的灰白圆角默认皮肤，并提供全局的按下反馈和点击音效默认值。不装插件也能用：传自己的贴图照常工作，`texture: null` 是纯色模式。

## 按钮

<<< ../../packages/ui/docs/examples/ui-button.test.ts#example

<<< ../../packages/ui/docs/examples/ui-button.test.ts#test

`Button` 由九宫格底图和居中的 `label` 组成。底图可以是默认皮肤、自己的 `texture`，或 `texture: null` 加 `backgroundColor` 的纯色。

| 成员 | 说明 |
|---|---|
| `clicked` | 按下并在按钮内抬起（Node2D 的信号） |
| `pressed` / `released`、`isPressed` | 按下状态 |
| `text`、`label` | 文字 |
| `disabled` | 半透明，点不到 |
| `pressEffect` | 按下反馈，默认 `{ scale: 1.1, tint?, duration: 0.08 }`，`false` 关闭 |
| `clickSound` | 点击音效；`null` 关闭 |

**按下反馈作用在内部的 `body` 上**（原点在按钮中心），默认围绕中心放大，按钮自身的 `scale` 和 `rect` 不变。图标等装饰也加到 `body` 下。`ui({ pressEffect })` 改全局默认。

手指的路径：

- 按下 → 视觉按下；滑出 → 恢复（仍然持有这根手指）；滑回 → 再次按下；在按钮内抬起 → `clicked`。
- 在外面抬起、切后台、按钮被隐藏或盖住、途中变成 `disabled` → 只发 `released`。
- 只认第一根手指。

点击音效：`ui({ clickSound: sfx('click.mp3') })` 给所有按钮设默认值（由插件预加载）。按钮自己的 `clickSound` 优先，记得放进场景的 `static assets`。

## Control 与锚点

`Control`（继承 `Node2D`）是界面控件的基类，直接实例化就是一个布局盒子。

- `size` / `rect`，原点在**左上角**（和 `ColorRect` 一样）；没设 `hitArea` 时，点击区域就是这个矩形。
- `anchor: { left | right | centerX, top | bottom | centerY }` 是到 `safeRect` 各边或中心的距离，进树和屏幕变化时自动重排。同时给 `left` 和 `right` 时拉伸宽度。
- `anchorTo: 'visible'` 改为相对整个可见区域（而不是安全区）。

::: warning 锚点只在 CanvasLayer 里有意义
`anchor` 是屏幕位置（设计坐标）。控件放在场景里会跟着相机走，并警告一次。
:::

## 进度条

<<< ../../packages/ui/docs/examples/ui-progress-bar.test.ts#example

<<< ../../packages/ui/docs/examples/ui-progress-bar.test.ts#test

- `value` 夹在 `minValue..maxValue` 之间（默认 0..1，血条可以直接 `maxValue: 100`）；`ratio` 是 0–1 的比例。`value` 可以补间。
- `valueChanged` 只在值真的变化时发出。
- `fillMode`：`leftToRight`（默认）、`rightToLeft`、`bottomToTop`、`topToBottom`。
- 底 `background` 和填充 `fill` 各是一张九宫格贴图（默认皮肤是深色面板 + 按 `fillColor` 染色的白色填充），也可以用纯色（`textureBackground: null` / `textureFill: null` 加 `backgroundColor` / `fillColor`）。`fillPadding` 让填充相对底图内缩，默认皮肤是 6。
- 填充节点始终铺满整条，用 `clipRect` 裁出已填充的部分，所以九宫格的圆角和高光在半满时不变形。不要用改 `scale.x` 的老办法。值为 0 时填充不显示，满时不裁剪。

## 滚动列表

<<< ../../packages/ui/docs/examples/ui-scroll.test.ts#example

<<< ../../packages/ui/docs/examples/ui-scroll.test.ts#test

`ScrollContainer` 把条目放进一个可以单指拖动的可见区里，带惯性和到边回弹。选关、商店、排行榜这类多于一屏的界面都用它。

- **条目加到 `content` 下**，直接加到容器上的节点不会滚动。
- **`contentSize` 要自己给**：引擎没有通用的包围盒。等高的行用 `行数 * 行距 - 间距` 就能算出来。
- 容器的 `clipRect` 就是它的 `rect`：滚出可见区的条目看不见，也点不到。

| 成员 | 说明 |
|---|---|
| `scrollOffset`、`scrollX` / `scrollY` | 内容向左 / 向上移动的量，夹在 `0..maxScroll`（`contentSize - size`） |
| `scrollTo(offset, { animate? })` | 立即跳到，或约 0.3 秒平滑滚过去；按下会打断动画 |
| `scrolled` | 滚动位置变化时发出 |
| `isScrolling` | 正在拖动、惯性、回弹或动画中 |
| `vertical` / `horizontal` | 滚动方向，默认只开竖向 |
| `dragThreshold` | 手指移动超过多少设计像素才算拖动，默认 12 |
| `inertia` / `deceleration` | 松手后的惯性，默认开；`deceleration` 是每秒损失的速度比例，默认 0.87 |
| `bounce` | 拖过边界时有阻尼、松手回弹，默认开；关掉时夹在边界内 |

手势：

- 按在按钮上，先由按钮捕获。手指移动超过 `dragThreshold` 后容器接管，按钮只收到 `released`，不会 `clicked`；在阈值内抬起就是普通的点击。所以列表里的按钮不需要自己区分点击和拖动。
- 按在空白处由容器自己捕获，不会触发 `pointerPress()`。
- 惯性滚动中按下只是把列表按停，不会点到条目。
- 只认一根手指。切后台、容器被隐藏或暂停时拖动结束、速度清零。

::: tip 按钮的动作放在 clicked 里
被拖走的按钮只会收到 `released`。不要在 `pressed` 里做不能撤销的事。
:::

暂时不画滚动条、不处理鼠标滚轮，嵌套的滚动容器之间也不做手势仲裁。

## 暂停菜单

`tree.paused` 时控件默认不响应。暂停菜单的面板设 `processMode: 'always'`，里面的滚动列表也一样（惯性和回弹在 `process` 里推进）。
