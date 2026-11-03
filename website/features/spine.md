# Spine 骨骼动画

角色用 Spine 做（骨骼、网格变形、换装、事件）时，用独立的包 `@sapling2d/spine`，基于官方的 `@esotericsoftware/spine-core` 4.3。

```sh
pnpm add @sapling2d/spine
```

<<< ../../packages/spine/docs/examples/spine.test.ts#example

<<< ../../packages/spine/docs/examples/spine.test.ts#test

## 资源

- 安装插件：`startGame({ plugins: [spine()] })`。
- `spineSkeleton(path, { atlas?, scale? })`，放进 `static assets`：
  - `path` 是 **Spine 4.3 导出的 JSON**，版本不对时加载报错；`.skel` 暂不支持。
  - 图集默认是同目录同名的 `.atlas`，不同名时写 `atlas`。页图和图集放在同一目录，和 `tex()` 一样走小游戏分包、切场景卸载。
  - `scale` 整体缩放骨架。
- 资源上能读到 `animationNames`、`skinNames`、`boneNames`、`slotNames`、`eventNames`、`rect`（设置姿势的包围盒），`data` 是 spine-core 的 `SkeletonData`。

## SpineSprite

构造参数：`{ skeleton, animation?, loop?, skin?, defaultMix?, speedScale?, flipH?, flipV?, physics? }`。

| 成员 | 作用 |
|---|---|
| `play(name, { loop, track })` | 播放（默认循环、轨道 0） |
| `queue(name, { loop, track, delay })` | 排在当前动画后面 |
| `stop(track, mixDuration)` | 停止 |
| `animation` / `isPlaying` | 轨道 0 的当前动画 |
| `speedScale` | 播放速度，和 `tree.timeScale` 叠加 |
| `defaultMix` / `mix(from, to, s)` | 动画之间的过渡时长 |
| `skin` / `setAttachment(slot, name \| null)` | 换装、换武器、换表情 |
| `flipH` / `flipV` | 翻转 |
| `bonePosition(bone)` / `boneRotation(bone)` | 骨骼在节点局部坐标里的位置和角度 |
| `rect` | 没设 `hitArea` 时的点击区域 |

信号：`animationStarted(name, track)`、`animationFinished(name, track)`（不循环的播完、循环的每圈一次）、`animationEvent(name, { int, float, string, time }, track)`。

动画在 `process` 之前推进，暂停时停止。原点是 Spine 的 root 骨骼（角色一般在脚底），坐标 y 向下。

## 跟随骨骼：SpineBoneNode

`SpineBoneNode({ bone })` 放在 `SpineSprite` 的直接子节点，每帧跟随那根骨骼的位置、旋转、缩放。枪口特效、手持武器、头顶血条挂在它下面。只能跟随，不能反过来驱动骨骼。

## 进阶

需要多轨道混合、IK 目标这类功能时，直接用 spine-core 的对象：`sprite.state`（`AnimationState`）和 `sprite.spine`（`Skeleton`）。改了姿势相关的东西之后调用 `refreshPose()`。

## 渲染与性能

- 每个 slot 一个网格，和精灵一起合批；slot 的混合模式（additive / multiply / screen）和裁剪都照 Spine。
- **不支持双色染色（tint black）**：会被忽略并警告一次。
- 静止的角色每帧没有开销；在播的角色每帧算一次顶点，一个 50 slot 的角色大约相当于 50 个精灵。

## 测试

无头测试读真实的骨架和图集（`createTestGame({ assetsDir })`），不读页图：动画时序、事件、骨骼位置和真机一致。`dump()` 显示 `skeleton`、`animation`、`playing`、`skin`、`flipH`。

::: warning 许可证
Spine Runtimes License 要求**每个使用本插件的开发者有自己的 Spine 编辑器许可**，并在产品文档里附上许可证；玩家不需要。
:::
