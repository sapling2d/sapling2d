# 曲线路径

`Curve2D` 按**走过的距离**在曲线上取点，弯道上也是匀速。适合塔防怪物的行进路线、弯曲的弹道、巡逻路线。

<<< ../../packages/engine/docs/examples/curve.test.ts#example

## 创建

- `Curve2D.catmullRom(points, { closed?, bakeInterval? })`：平滑地经过每一个控制点。用的是 centripetal 参数化，控制点间距不均（比如随机生成的路线）时也不会打结或出尖角。
- `Curve2D.polyline(points, { closed? })`：直线段相连。
- 控制点可以是 `Vector2`，也可以是任何带 `x` / `y` 的对象；相邻的重复点自动去掉。
- `closed: true` 时首尾相接，距离绕回起点，适合巡逻。

## 取点

| 成员 | 说明 |
|---|---|
| `length` | 曲线长度（像素） |
| `sample(distance, out)` | 把位置写进 `out` 并返回它；`out` 每帧复用，不分配内存 |
| `angleAt(distance)` | 前进方向（弧度，0 朝右，和 `rotation` 一致） |

开放曲线的距离超出 `[0, length]` 时停在端点。

## 用法

- 曲线只是数据，不是节点。节点自己记 `dist`，每帧 `dist += speed * dt` 再 `sample`。
- 减速、冰冻就是改 `speed`；"谁离终点最近"就是 `length - dist` 最小的那个；击退就是 `dist -= …`。
- 创建时预先采样成折线（间距 `bakeInterval`，默认 5 像素），之后取点是二分查找。
- 曲线不可变。每只怪一条随机路线就各建一条（一条只有几十个点，很便宜），但不要每帧新建。

## 测试

<<< ../../packages/engine/docs/examples/curve.test.ts#test
