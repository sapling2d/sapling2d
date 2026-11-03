# 帧动画与图集

把多帧画在一张图里（图集），再用 `AnimatedSprite2D` 按顺序播放。图集的每一帧都是普通的 `Texture`，也可以直接给 `Sprite2D` 用。

<<< ../../packages/engine/docs/examples/animation.test.ts#example

<<< ../../packages/engine/docs/examples/animation.test.ts#test

## 两种图集

| 函数 | 适用 | 读取帧 |
|---|---|---|
| `sheet(path, { columns, rows })` | 等大格子的网格图 | `frame(i)`、`frames(start, end)`（含两端）、`count` |
| `atlas(path, data)` | 打包工具产出的图集，`data` 是图集 JSON（直接 import） | `get(name)`、`frames(prefix)`、`names`、`has` |

- `sheet` 的帧尺寸 = 整张图尺寸 ÷ 列数（行数），图片加载后才知道，无头模式下为 0。
- `atlas` 读通用的图集 JSON（JSON Hash / JSON Array；Pixi、Phaser、Aseprite、TexturePacker、free-tex-packer 都产出这种格式，Phaser 3 的多页 JSON 也认）。尺寸来自 JSON，无头模式下也正确；支持裁剪透明边、旋转的帧和锚点。
- 同一张图的帧共用一份显存，绘制时能合批。图集放进 `static assets`，切换场景时按整张图判断是否卸载。

## AnimatedSprite2D

- 一套动画：`frames` + `fps`（默认 10）+ `loop`（默认 true）。
- 多套动画：`animations: { 名字: { frames, fps, loop } }`，用 `play(name)` 切换。
- 控制：`play(name?)`、`pause()`、`stop()`（回到第 0 帧）、`frame`（可赋值）、`frameCount`、`speedScale`、`isPlaying`、`animation`。
- 信号：`frameChanged`；`animationFinished`（不循环的动画播完时触发，参数是动画名）。
- `texture` 由动画控制，不要直接赋值。
- 动画决定玩法时（攻击动作的出手帧）加 `processInPhysics: true`：按物理步推进，倍速下出手的那个物理步和 1 倍速一样。

## 每帧时长不同

攻击动作通常是"慢慢蓄力、一下挥出、慢慢收招"，每帧时长不一样。用 `durations`（秒）代替 `fps`：

<<< ../../packages/engine/docs/examples/animation-timing.test.ts#example

<<< ../../packages/engine/docs/examples/animation-timing.test.ts#test

- `durations` 的长度和 `frames` 相同，每个值大于 0；和 `fps` 只能二选一。
- `getAnimationDuration(name?)` 是一轮的总秒数，`getFrameTime(name, frame)` 是这一帧开始的时间点。两者都**不算** `speedScale`，实际时间要除以它。
- 命中帧在 `frameChanged` 里按 `frame` 判断。一次推进跨过好几帧时，每一帧都会触发，不会被跳过。

## Aseprite

美术在 Aseprite 里用 tag 分段、调每帧时长、用 slice 标挂点（枪口、剑尖），导出 png + json 之后，程序不用改任何数字。导出时 `--list-tags` 和 `--list-slices` 不能漏：

```sh
aseprite -b hero.aseprite --sheet public/assets/hero.png --data src/hero.json --format json-array --list-tags --list-slices --sheet-type packed
```

<<< ../../packages/engine/docs/examples/aseprite.test.ts#example

<<< ../../packages/engine/docs/examples/aseprite.test.ts#test

- `aseprite<Tag>(path, data)`：类型参数是 tag 的名字，只用于类型检查。放进 `static assets`。
- 帧按导出顺序编号：`frame(i)`、`frames(start, end)`、`count`、`duration(i)`（秒）。
- `animation(tag?, { loop })` 得到一个 tag 的动画（`frames` + `durations`）；`animations({ tag: { loop } })` 得到所有 tag。
  - 播放方向 `forward` / `reverse` / `pingpong` / `pingpong_reverse` 会展开成帧序列，和 Aseprite 里播放的一样。
  - tag 没设播放次数时循环；设了 N 次就展开 N 遍、不循环。攻击这类只播一次的动作写 `{ attack: { loop: false } }`。
- `slice(name, frame)` 返回 slice 在这一帧的 `{ bounds, pivot }`，**以精灵中心为原点**，直接加到精灵位置上即可（`flipH` 时 x 取反）。`frame` 传播放中精灵的 `sprite.texture`，或者图里的帧号；返回的对象是共用的，不要修改。
- 仓库里提交导出好的 png + json，其他人不需要安装 Aseprite。

## PNG 序列（TexturePacker）

高清手绘的角色一般在 Spine、AE、Animate、PS 里做好，导出成 PNG 序列（`hero_attack_01.png` …），再打包成图集。这种 JSON 里没有帧时长和命中帧，写在代码里：

<<< ../../packages/engine/docs/examples/texturepacker.test.ts#example

<<< ../../packages/engine/docs/examples/texturepacker.test.ts#test

- **同一个角色的所有序列用相同的画布尺寸导出**（武器挥出去的部分也要在画布里），打包时开启 trim 裁掉透明边。帧的尺寸仍是画布尺寸、以画布中心对齐，切换动作时角色不会跳。
- 画布没法统一时用**锚点**：在 TexturePacker 里把每帧的 pivot 放在角色脚底，导出的 JSON 里每帧带 `pivot`（PixiJS 格式叫 `anchor`，两个都认）。`Sprite2D` 默认以锚点为原点，切换动作时脚底不动。
- `frames(prefix)` 只取前缀后面**紧跟编号**的帧，按编号排序：`frames('hero_attack_')` 不会混进 `hero_attack_heavy_01.png`。一帧都没取到时，报错会提示更合适的前缀。
- `durations` 的长度和帧数对不上时报错：美术加减了帧，记得改时长。

## 多页图集与旋转的帧

一张图放不下（小游戏上单页别超过 2048）时分成几页，每页一张图、一个 JSON。`atlas()` 传两个顺序一致的数组：

<<< ../../packages/engine/docs/examples/multipack.test.ts#example

<<< ../../packages/engine/docs/examples/multipack.test.ts#test

- 页的顺序错了会报错。帧名在所有页里唯一，`get` / `frames(prefix)` 不用管帧在哪一页。
- Phaser 3 格式把所有页放在一个 JSON 里，只传这一个 JSON。
- 加载和卸载以页为单位；`pages` 是每页的 `Texture`。
- JSON 里 `rotated: true` 的帧（TexturePacker 的 Allow rotation）会在渲染时转回来，尺寸、锚点、点击范围都按原图算。
- 不支持 polygon 打包、`meta.scale` 缩放变体、法线贴图、plist / XML 等格式。

## 自己打包图集：`@sapling2d/pack`

散图打成图集不需要 TexturePacker：

```sh
pnpm add -D @sapling2d/pack
pnpm sapling-pack art/items public/assets --json src   # art/items/**/*.png → public/assets/items.png + src/items.json
```

```ts
import itemsData from './items.json'
static assets = { items: atlas('items.png', itemsData) }
```

- 帧名是相对输入目录的路径（`coin.png`、`hero/attack_01.png`），`frames('hero/attack_')` 照常用。
- 默认裁掉透明边（`--no-trim` 关掉）、不旋转、单页最大 2048（`--max-size`）、帧间距 2（`--padding`）。放不下时自动分页（`items-0.png`、`items-1.png`……）。
- 输出是确定的：同样的输入得到逐字节相同的文件。产物提交进仓库，改了散图重跑一次。
- 在自己的脚本里可以调用 `packAtlas(name, sprites, options)`：输入 RGBA 像素，输出每页的像素和 JSON，不读写文件。
