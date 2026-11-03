# 输入

游戏代码只查**动作**（`jump`、`left`……），不关心动作来自键盘、触摸还是屏幕按钮。动作在启动参数 `actions` 里定义，每个动作可以有多个绑定。

<<< ../../packages/engine/docs/examples/input.test.ts#example

测试里模拟输入：

<<< ../../packages/engine/docs/examples/input.test.ts#test

## 动作

- 查询：`isActionPressed`、`isActionJustPressed`、`isActionJustReleased`。
- 用声明合并给动作名加类型：`declare module 'sapling2d' { interface ActionRegistry { jump: true } }`，拼错动作名就编译不过。
- `isActionJustPressed` 在 `process` 里按帧算，在 `physicsProcess` 里按物理步算。屏幕刷新率高于 60Hz 时有的帧没有物理步，所以跳跃这类按键放在 `physicsProcess` 里处理不会丢。

## 绑定

| 绑定 | 来源 |
|---|---|
| `pointerPress()` | 屏幕上任意一处**没被节点处理**的按下（"点屏幕开始游戏"） |
| `key('Space')` | 键盘（内置插件，三个入口都默认安装） |
| 屏幕按钮、摇杆 | `@sapling2d/touch` 插件 |
| `tilt('left')` | 倾斜传感器，`sapling2d/motion` 插件 |

几个来源同时作用时，动作的力度（0–1）取最大值；摇杆和倾斜会给出中间值，用 `getActionStrength`、`getAxis`、`getVector` 读取。

## 可点击的节点

`Node2D` 设 `inputPickable = true` 后能收到指针：信号 `pointerDown`、`pointerMove`、`pointerUp`、`clicked`。点击区域是 `hitArea`；`Sprite2D` 不设时用贴图范围。被节点处理掉的点击不会触发 `pointerPress()`。

::: tip 无头测试里贴图宽高是 0
需要点击的精灵，在测试里显式设 `hitArea`。
:::

小游戏没有键盘事件，但游戏代码不用区分：绑定了 `key()` 的动作在那里只是不会被键盘触发。
