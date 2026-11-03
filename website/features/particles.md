# 粒子

`Particles2D` 是粒子发射器，用来做火花、爆炸、拖尾。粒子本身不是节点，数据存在发射器里，一个发射器只有一次绘制调用。

<<< ../../packages/engine/docs/examples/particles.test.ts#example

<<< ../../packages/engine/docs/examples/particles.test.ts#test

## 发射

- `emitting`（默认 true）：持续发射，每秒 `rate` 个（默认 `amount / lifetime`）。
- `emit(n)`：马上爆发 n 个（默认 `amount`）。
- `oneShot: true`：`emitting` 一变成 true 就爆发 `amount` 个，然后自动关掉。
- `amount` 是同时存活的上限，到了上限不再发射。
- 全部消失、且不再发射时发出 `finished` 信号，一般在这里 `queueFree()`。

## 运动和外观

| 属性 | 作用 |
|---|---|
| `direction` ± `spread` | 发射方向（弧度，跟着节点的全局旋转）和散开角度（默认 π，即所有方向） |
| `speedMin` / `speedMax` | 初速度范围 |
| `gravity` | 重力 |
| `damping` | 每秒损失速度的比例 |
| `lifetime` / `lifetimeRandomness` | 寿命和寿命的随机程度 |
| `scaleStart` → `scaleEnd` | 缩放随寿命线性变化 |
| `alphaStart` → `alphaEnd` | 不透明度随寿命线性变化 |

粒子不旋转。颜色用 `selfModulate`（只染粒子）或 `modulate`；发光的特效配合 [`blendMode: 'add'`](./color-effects)。

## 坐标

默认粒子发射后留在原地，不随节点移动，适合火花、拖尾。`localCoords: true` 时粒子跟着节点走。

## 其他

- 每帧不分配内存。
- 随机数用 `tree.fxRng`：测试可复现，但和游戏逻辑的 `tree.rng` 分开，加减粒子特效不会改变同一个 seed 的对局。
- 时间受 `timeScale` 和暂停影响。
- `aliveCount` 是存活的粒子数，`dump()` 里显示为 `particles=`。
