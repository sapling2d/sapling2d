# 物理与碰撞

物理用 [planck.js](https://piqnt.com/planck.js/)（Box2D 的 TypeScript 移植）。单位是像素和 px/s，重力默认 `(0, 980)`。

| 节点 | 用途 |
|---|---|
| `RigidBody2D` | 动态刚体：受重力、会碰撞 |
| `StaticBody2D` | 静态刚体：地面、墙 |
| `Area2D` | 检测区域：只报告进出，不挡住刚体 |
| `CollisionShape2D` | 碰撞形状：`circle(r)`、`rectangle(w, h)`、`polygon(points)`，必须是刚体或区域的直接子节点 |

## 例子：合成玩法

两个同级的球相撞，合成一个更高级的球：

<<< ../../packages/engine/docs/examples/physics.test.ts#example

- 接触信号 `bodyEntered` / `bodyExited` 在物理步结束后触发，回调里 `queueFree` 和 `add` 都是安全的。
- 两边都会收到信号：用 `isQueuedForDeletion` 保证只处理一次。

## 移动刚体

刚体的位置由物理决定。给 `position` 赋值等于瞬移，速度清零；要推它就施加冲量或力：

<<< ../../packages/engine/docs/examples/physics.test.ts#test

常用属性：`mass`、`friction`、`bounce`、`gravityScale`、`linearVelocity`、`angularVelocity`、`lockRotation`、`ccd`（快速移动的物体防穿透）。

## 检测区域

<<< ../../packages/engine/docs/examples/area.test.ts#example

## 碰撞层

`collisionLayer` / `collisionMask` 共 32 层，规则同 Godot：任一方的 mask 包含对方的 layer，两者就碰撞。用 `setCollisionLayerValue(n, bool)` 单独开关某一层。

## 注意

- 改碰撞形状（移动、修改、禁用、增删 `CollisionShape2D`）会重建形状，正在接触的对象会先收到一次 `bodyExited`、再收到一次 `bodyEntered`。
- `scale` 不影响碰撞形状。
- 微信小游戏的 iOS 端没有 JIT，同时活跃的刚体建议控制在 60–80 个以内。子弹这类大量对象用 `HitTester` 做命中判定，不要用刚体。
