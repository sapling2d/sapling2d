# 图块地图

用一张图块集拼出关卡：地面、墙、平台。可以在代码里摆格子，也可以直接读 [Tiled](https://www.mapeditor.org/) 做的关卡。

## TileMapLayer

<<< ../../packages/engine/docs/examples/tilemap.test.ts#example

### 图块集

`tileset(path, { tileSize, tiles, columns?, margin?, spacing? })`，放进 `static assets` 预加载。

- 图块编号从 1 开始：图集左上角是 1，从左到右、从上到下。0 表示空格子。
- `tiles` 给图块定义属性：`collision`（`'solid'` 整格实心 / `'oneWay'` 单向平台）和 `data`（游戏自己的字段）。`tileSet.tile(id)` 读取。

### 图层

`TileMapLayer` 是一层格子，大小（`width × height` 格）创建后固定，格子左上角在节点原点。多层地图就是多个节点，叠放顺序看场景树。

| 方法 | 作用 |
|---|---|
| `setCell(cx, cy, id)` / `eraseCell` / `getCell` | 改、删、读格子（地图外返回 0） |
| `getCellTileData` | 格子上图块的属性，空格子为 null |
| `localToMap` / `mapToLocal` | 像素 → 格子；格子 → 格子中心的像素 |
| `getUsedRect` / `usedCellCount` | 用到的范围（单位是格）、非空格子数 |

- 只画屏幕内的区块（16 × 16 格），改格子很便宜（顶碎砖块直接 `eraseCell`）。几万格的关卡也只是一个节点，不要用 `Sprite2D` 一格一格地拼。
- 图层可以平移，不要旋转、缩放（碰撞按格子查）。

### 限制

- 一个图块集只能用一张图；图块不能翻转、旋转，没有动画。
- 碰撞只有整格，没有斜坡。
- **图块地图不生成物理刚体**：`RigidBody2D` 不会被它挡住。和图块碰撞的角色用 [`CharacterBody2D`](./character-body)。

## Tiled 关卡

<<< ../../packages/engine/docs/examples/tiled.test.ts#example

### 加载

- `tiledMap(path)` 读 Tiled 的 JSON 格式关卡，放进 `static assets`。图块集（嵌入的或外部 JSON）和图片按 Tiled 里的相对路径放，都要在资源目录里。
- **扩展名用 `.json`**（Tiled 保存时可以选）：微信小游戏的代码包可能不收 `.tmj` / `.tsj`。XML 格式（`.tmx` / `.tsx`）不支持。
- vite 插件会检查关卡文件和它引用的图块集、图片。切换场景时图片按张判断是否卸载，两个关卡共用的图不会被卸载。

### 读取

- `TileMapLayer.fromTiled(map)`：每个图块层建一个 `TileMapLayer`（名字、偏移、可见性、不透明度来自 Tiled），从下到上排列；`fromTiled(map, name)` 只建那一层。
- 地图数据：`tileLayers`、`tileLayer(name)`、`layerNames`、`width` / `height`（格）、`tileSize`、`pixelWidth` / `pixelHeight`（设相机 limit 用）、`tileSets`、`properties`。
- `objects(layerName?)`：对象层的数据（`id`、`name`、`type`、`x`、`y`、`width`、`height`、`properties`……）。矩形和点的 (x, y) 是左上角 / 点本身，**图块对象是左下角**（Tiled 的约定）。

### 在 Tiled 里设置碰撞

- 在图块集编辑器里选中图块，加**字符串**属性 `collision`，值为 `solid`（实心）或 `oneWay`（单向平台）。其他属性进 `getCellTileData(...).data`。
- Tiled 碰撞编辑器里画的形状**不起作用**（会警告）。
- 图块层加整数属性 `collisionLayer` 设置碰撞层（默认 1）。

### 限制

加载时遇到这些情况会报错，并指出是哪个图层或图块集：

- 只支持正交、非无限的地图；
- 图块是正方形、和地图格子一样大；每个图块集一张图片；一个图块层只用一个图块集；
- 图块不能翻转、旋转；
- 图块层格式用 CSV（Map Properties → Tile Layer Format）；
- 不支持图层组、图片图层。动画图块只画第一帧（会警告）。

无头测试读真实文件：`createTestGame({ ..., assetsDir })`，默认 `public/assets`。
