# 界面层（CanvasLayer）

分数、按钮、暂停菜单这类界面应该固定在屏幕上，不随相机移动。把它们放进 `CanvasLayer`。

<<< ../../packages/engine/docs/examples/canvas-layer.test.ts#example

## 坐标

- `CanvasLayer` 下面的节点不跟随相机，用**设计坐标**（屏幕上的位置），但仍然随视口缩放。全局变换只算到 CanvasLayer 为止。
- 它下面的节点收到的指针事件 `position` 是设计坐标；场景里的节点收到的是世界坐标。

## 层级：`layer`

- `layer`（默认 1）≥ 0 画在场景上面（界面），< 0 画在场景下面（远景）。
- 同一层级按场景树里的顺序画，嵌套的层紧跟外层。
- 上面的层先收到指针事件。

## 显示和隐藏

- `visible = false` 时整层（包括嵌套在里面的层）不显示，也点不中。
- `CanvasLayer` 不是 `Node2D`：外面的 Node2D 隐藏**不影响**它（和 Godot 一样）。所以要跟着角色一起隐藏的血条，不要放进 CanvasLayer。

## 生命周期

- 属于场景的 CanvasLayer 随场景销毁。
- 需要跨场景的界面（例如全局 HUD），让 Autoload 继承 `CanvasLayer`。

## 物理

刚体、`CharacterBody2D`、`TileMapLayer` 也可以放进 CanvasLayer，坐标同样是设计坐标。`CharacterBody2D` 只和同一画布（同一个 CanvasLayer，或都在场景里）的图块地图碰撞。

::: warning clipRect 不裁 CanvasLayer
裁剪容器下面的 `CanvasLayer` 自成一层，照常全屏显示。弹窗里要一起裁掉的东西不要放进 CanvasLayer。
:::
