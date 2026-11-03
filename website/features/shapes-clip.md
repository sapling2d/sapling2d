# 矩形、九宫格与裁剪

做血条、面板、弹窗、滚动列表常用的三样东西。

## 纯色矩形：ColorRect

<<< ../../packages/engine/docs/examples/color-rect.test.ts#example

<<< ../../packages/engine/docs/examples/color-rect.test.ts#test

- 属性：`size`、`color`（0xRRGGBB）；透明度用 `alpha`。`color` 和 `size` 都能补间。
- 原点在**左上角**（和 `Sprite2D` 默认居中不同）：血条改 `scale.x`，左端固定、从右边缩短。
- 没有 `hitArea` 时，点击区域就是这个矩形（无头模式下也是），可以当简单的按钮底板或遮罩。
- 和贴图一起合批绘制，几十个血条不会增加绘制调用。圆、圆环这类形状用贴图加 `modulate`。

::: warning 当按钮或遮罩用时要设 `inputPickable: true`
不设的话照常画出来，但点不到、也挡不住下面的点击，而且没有任何提示。
:::

## 九宫格：NineSliceSprite

边框、按钮底板这类要拉伸到不同尺寸的图，用九宫格：四个角不缩放，上下边只横向拉伸，左右边只纵向拉伸，中间两个方向都拉伸。

<<< ../../packages/engine/docs/examples/nine-slice.test.ts#example

<<< ../../packages/engine/docs/examples/nine-slice.test.ts#test

- 属性：`texture`、`margins`（`{ left, top, right, bottom }`，或一个数字表示四边相同，单位是贴图原始尺寸的像素）、`size`。
- 原点在**左上角**，和 `ColorRect` 一样；`size` 能补间。没有 `hitArea` 时点击区域就是 `(0, 0)–size`，设 `inputPickable: true` 就能当按钮。
- 边框贴图做成**正方形、四边是花边、中间可以拉伸**的样子，`margins` 就是花边的宽度。`size` 小于两边边距之和时，四个角按比例缩小。
- `selfModulate` 给边框染色（按钮按下时变暗）。图集里裁掉透明边的帧也能用。

## 裁剪：clipRect

`Node2D.clipRect` 只画矩形里的部分：

<<< ../../packages/engine/docs/examples/clip.test.ts#example

<<< ../../packages/engine/docs/examples/clip.test.ts#test

- `clipRect` 是局部坐标的 `Rect2`，默认 `null`（不裁剪）。节点自己的内容和整个子树都被裁，嵌套时取交集；随节点的变换走（旋转、缩放、相机都照常）。
- `Rect2` 不可变，改范围就赋一个新的。
- 拾取也遵守裁剪：被裁掉的部分点不到。被裁掉的位置算空白，会触发 `pointerPress()` 动作。正在拖着的节点滚出裁剪区不会被打断。
- 子树里的 `CanvasLayer` 自成一层，**不受**祖先裁剪。弹窗里要一起裁掉的东西不要放进 CanvasLayer。
- 用途：滚动列表的窗口、按比例填充的进度条（改填充节点的 `clipRect`，九宫格不变形）、只露出一部分的图。圆形或贴图形状的遮罩暂不支持。
- 性能：真机实测 10 个裁剪容器约 0.45 ms。
