# 透明度与颜色

`Node2D` 有三个颜色属性，都可以写在构造参数里，也都可以补间：

| 属性 | 默认 | 作用范围 | 说明 |
|---|---|---|---|
| `alpha` | `1` | 自己和子节点 | 不透明度 0–1，父子相乘。为 0 时仍能被点中，要隐藏用 `visible` |
| `modulate` | `0xffffff` | 自己和子节点 | 颜色乘子 0xRRGGBB，每个像素乘上它：`0xff6666` 偏红、`0x888888` 变暗。只能变暗或偏色，不能变亮 |
| `selfModulate` | `0xffffff` | 只有自己的贴图 / 文字 | 同上，但不影响子节点（Boss 变红而血条不变）；和 `modulate` 叠乘 |

```ts
// 受伤变红再恢复：颜色属性按 RGB 通道补间
enemy.modulate = 0xff4040
enemy.createTween().to(enemy, { modulate: 0xffffff }, 0.2)
// 淡出后销毁
fx.createTween().to(fx, { alpha: 0 }, 0.3).call(() => fx.queueFree())
```

## 受击闪白：`Sprite2D.flash`

`modulate` 是乘法，没法把角色变成白色。受击闪白用 `flash`：

<<< ../../packages/engine/docs/examples/flash.test.ts#example

<<< ../../packages/engine/docs/examples/flash.test.ts#test

- `flash`（0–1，默认 0）在贴图的形状上叠一层 `flashColor`（默认白色）。为 1 时整个形状变成纯色，透明的地方仍然透明。
- 受击时设成 1，再补间回 0；反复受击时先 `kill()` 上一个补间。`flashColor` 也能补间。
- `modulate`、`alpha`、`blendMode` 照常作用在闪光上：被 `modulate` 染蓝的节点闪出来是淡蓝。
- 帧动画、图集的帧、翻转、`offset` 都照常对齐。只作用于这个精灵自己，不影响子节点。
- 代价：一张图第一次闪白时，显存里会生成一张**同样大小**的白色剪影，之后这张图的所有帧、所有精灵共用。大图集闪一次就多占一份显存，所以给要闪白的角色单独打一张图集。

## 叠加发光：`blendMode`

火光、爆炸、刀光、魔法这类发光的特效，用 `blendMode: 'add'`：颜色相加，叠在别的东西上会把它照亮。普通混合只会盖上一层颜色，看起来发灰。

<<< ../../packages/engine/docs/examples/blend-mode.test.ts#example

<<< ../../packages/engine/docs/examples/blend-mode.test.ts#test

- 取值：`'inherit'`（默认，跟随父节点）、`'normal'`、`'add'`。作用于自己和整棵子树，子节点可以设回 `'normal'`。
- **不传进 `CanvasLayer`**：界面层自成一层，要发光就在层里面的节点上设。
- 贴图、`ColorRect`、文字、粒子、图块地图都按它绘制。`alpha` 照常起作用（淡出时光也变弱），`selfModulate` 给光染色。
- 发光贴图做成**白色、黑底或透明底、中心亮边缘暗**，颜色交给 `selfModulate`。
- 背景越暗效果越好；同一处叠太多层会过曝成一片白。
- 混合模式不同的相邻节点不能合批：同屏很多发光特效时，把它们放在同一个父节点下，让它们在绘制顺序上挨在一起。
