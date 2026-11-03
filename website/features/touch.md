# 屏幕按钮和摇杆

手机上没有键盘，屏幕按钮和摇杆就是虚拟按键。它们在独立的包 `@sapling2d/touch` 里，作为插件安装：

```sh
pnpm add @sapling2d/touch
```

`plugins: [touch()]` 会预加载一套默认皮肤（灰白半透明的圆），不传贴图也能看到控件。

## 屏幕按钮

<<< ../../packages/touch/docs/examples/touch-buttons.test.ts#example

`TouchScreenButton`（继承 `Sprite2D`）按住时，它的 `action` 处于按下状态。动作名和键盘绑定共用，`isActionPressed` / `isActionJustPressed` 照常用，游戏代码不用区分输入来自哪里。

| 成员 | 说明 |
|---|---|
| `action` | 按下时触发的动作，应该是已定义的动作（可以是没有绑定的 `[]`） |
| `texture` / `texturePressed` | 平时和按下时的贴图；不传用默认皮肤，`null` 只做输入不显示 |
| `hitArea` | 触摸区域，可以比贴图大（推荐）；不设时用贴图范围 |
| `isPressed`、信号 `pressed` / `released` | 按下状态 |

- 每个手指独立。滑出按钮、抬起、触摸取消、切到后台都会松开。
- 滑出后再滑回来不算按下，从别处滑进来也不算。需要滑动换方向的方向键，用后面讲的 `fixed` 摇杆。
- 和 `pointerPress()` 的区别：`pointerPress()` 是"屏幕上任意一处没被节点处理的按下"；按在屏幕按钮上的手指**不会**触发它，也不会点中下面的节点。
- 放进 `CanvasLayer`，固定在屏幕上。隐藏或暂停时按不下，按着的会在下一帧松开。
- 拾取按绘制顺序：画在上面的可点击节点（比如弹出的对话框）先收到指针；一个手指只按最上层的那个按钮。

## 摇杆

<<< ../../packages/touch/docs/examples/touch-joystick.test.ts#example

<<< ../../packages/touch/docs/examples/touch-joystick.test.ts#test

### 动作的力度

动作有**力度**（0–1）。按键、`pointerPress()`、屏幕按钮按下时是 1；摇杆按推动的程度给出 0–1（已经扣掉死区）。几个来源同时作用时取最大值。力度 ≥ 0.5 时动作算按下。

| 读取 | 返回 |
|---|---|
| `getActionStrength(action)` | 0–1 |
| `getAxis(neg, pos)` | -1 到 1，不分配内存 |
| `getVector(negX, posX, negY, posY)` | 长度不超过 1 的 `Vector2`；每次分配一个，热循环里用 `getAxis` |

### TouchJoystick

`TouchJoystick`（继承 `Node2D`）的常用属性：

| 属性 | 说明 |
|---|---|
| `actions` | `{ left, right, up, down }` 四个方向对应的动作 |
| `radius` | 推到这么远力度为 1，默认 100 |
| `deadzone` | 死区，默认 0.2 |
| `texture` / `textureKnob` | 底座和摇杆头；不设用默认皮肤，`null` 不显示 |
| `vectorX` / `vectorY` / `vector` | 当前方向（前两个不分配内存） |
| `isPressed`、信号 `pressed` / `released` | 按下状态 |

两种模式：

- `mode: 'dynamic'`（默认）：在 `region` 里按下的地方出现，松手后隐藏。`region` 默认是可见区域的左半边（设计坐标）。
- `mode: 'fixed'`：固定在 `position`，在 `hitArea` 里按下才算（默认是半径 1.5 × `radius` 的圆）。

::: tip 方向键
只配 `left` / `right`、`radius` 很小、`deadzone: 0` 的 `fixed` 摇杆就是一个方向键：按在哪边就是哪边，手指滑过去换方向不用抬起。
:::

- 只认一个手指：按着摇杆的手指不触发 `pointerPress()`、不点中下面的节点、不会滑进屏幕按钮。另一个手指可以同时按屏幕按钮。
- 抬起、触摸取消、切到后台、隐藏、暂停、移出树时松开，力度归零。
- 放进 `CanvasLayer`。`dynamic` 的区域里，画在它上面的按钮先收到指针，所以先加摇杆、后加按钮。摇杆本身不要旋转或缩放。

## 自己写控件

屏幕按钮和摇杆只用了引擎的公开能力：节点拾取（`inputPickable`、覆写 `hitTest`、`pointerDown` / `pointerMove` / `pointerUp`）加一个 `InputSource`。自己的控件可以照着写，见 [插件](/platforms/plugins)。
