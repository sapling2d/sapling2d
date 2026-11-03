# 平台游戏的角色

`CharacterBody2D` 是代码控制移动的角色：游戏自己算速度，引擎负责让它贴着[图块地图](./tilemap)的墙和地面滑动，不会穿墙。

<<< ../../packages/engine/docs/examples/character-body.test.ts#example

## 移动

- `shape` 是 `rectangle(w, h)`：以节点位置为中心、轴对齐，不随 rotation / scale 变化。
- 每个物理步设置速度（`velocityX` / `velocityY` / `setVelocity(x, y)`，或 `velocity`），然后调用 `moveAndSlide()`：先移动 x 再移动 y，被实心格挡住时贴着格子停下，那一轴的速度清零。
- `moveAndSlide()` 只能在 `physicsProcess` 里调用。
- 重力、加速度、跳跃都由游戏自己写。**重力每一步都要加**，站在地上也加，否则 `isOnFloor` 为 false。
- 跳跃用 `isActionJustPressed` 判断：在 `physicsProcess` 里它按物理步算，一次按下只在一个物理步里为 true。

## 碰撞结果

- `isOnFloor` / `isOnWall` / `isOnCeiling`
- `slideCollisionCount` / `getSlideCollision(i)`：撞到的 `tileMap`、`cellX`、`cellY`、`normal`（对象会复用，不要存起来）。

## 单向平台

图块属性 `collision: 'oneWay'` 的格子只在角色下落、且脚底原来在平台顶面以上时挡住它，可以从下面跳上去。速度再快也不会穿过去。

`collisionMask` 和图层的 `collisionLayer` 有交集才碰撞。

## 限制

- **只和 `TileMapLayer` 的格子碰撞**。它不是刚体：`StaticBody2D` 挡不住它（重叠时会警告一次），`RigidBody2D` / `Area2D` 也感知不到它。墙和地面都画进图块地图。
- 没有斜坡。
- 碰撞盒不随角色自己的 rotation / scale 变化：翻转贴图用子节点 `Sprite2D` 的 `flipH`。角色的祖先、图层和图层的祖先只能平移，旋转、缩放会报错。
- 角色之间不互相阻挡：主角和敌人、金币之间用 `HitTester` 判断。
- 图块集里没有任何碰撞图块的图层（纯装饰）不参与碰撞。
