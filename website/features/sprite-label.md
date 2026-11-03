# 贴图与文字

`Sprite2D` 显示一张贴图，`Label` 显示文字。贴图在场景的 `static assets` 里声明，进入场景前加载完成。

<<< ../../packages/engine/docs/examples/sprite-label.test.ts#example

- `tex('coin.png')` 的路径相对于 `public/assets/`。`sapling2d/vite` 插件会在构建时检查文件是否存在，写错路径会直接构建失败。
- `Sprite2D` 默认以贴图中心为原点（`centered: true`）；`offset`、`flipH`、`flipV` 调整显示。
- `Label` 的常用属性：`text`、`fontSize`、`color`、`fontWeight`、`align`、`verticalAlign`、`stroke`、`wrapWidth`、`lineHeight`。改 `text` 后下一帧画面更新。

## 像素风

小图放大显示的像素风游戏，在启动参数里设 `pixelArt: true`：

```ts
await startGame({ main: Game, pixelArt: true })
```

- 所有贴图用最近邻采样，放大后不模糊。
- 绘制时精灵的每个顶点对齐到物理像素，缩放倍数不是整数时也没有半像素的模糊边缘。文字不受影响。
- 只影响画面：节点的 `position` 照常是小数。

缩放倍数不是整数时，对齐有两个代价：移动中的精灵宽度可能在相邻两个物理像素之间跳动；旋转或缩放中的精灵，四个角各自对齐，形状会轻微抖动。要完全避免，就让设计分辨率按整数倍放大到屏幕，并尽量不旋转、缩放精灵。
