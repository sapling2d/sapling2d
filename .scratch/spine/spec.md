# Spec: Spine 骨骼动画插件 `@sapling2d/spine`

Status: ready-for-agent
Date: 2026-10-31
ADR: docs/adr/0012-spine-plugin.md（设计）、0010（插件）、0011（插件资源）、0002（节点自持数据）

让游戏用 Spine 4.3 导出的角色：`spineSkeleton()` 声明资源、`SpineSprite` 显示和播放、`SpineBoneNode` 挂点；浏览器、小游戏、无头三端同一份代码，动画逻辑在 Node 里可测。渲染是本包自己的 Pixi Mesh 同步，不依赖 `spine-pixi-v8`。

## 游戏侧 API

```ts
import { spine, spineSkeleton, SpineSprite, SpineBoneNode } from '@sapling2d/spine'

startGame({ main, plugins: [spine()] })

class Arena extends Scene {
  static assets = { hero: spineSkeleton('hero/hero.json') }   // 同目录 hero.atlas，页图按图集里的名字（hero.png）在同目录

  override ready() {
    const hero = this.add(new SpineSprite({ skeleton: Arena.assets.hero, animation: 'idle', position: v(375, 900), defaultMix: 0.2 }))
    hero.play('run')                       // 轨道 0，默认循环；返回 TrackEntry
    hero.play('jump', { loop: false })
    hero.queue('idle')                     // jump 播完接 idle（addAnimation）
    hero.animationFinished.connect((name) => { if (name === 'death') this.gameOver() }, this)
    hero.animationEvent.connect((name, e) => { if (name === 'footstep') this.tree.audio.play(STEP) }, this)
    hero.skin = 'red'                      // 换装
    hero.setAttachment('weapon', 'axe')
    hero.flipH = true                      // 朝左
    hero.speedScale = 0.5
    hero.bonePosition('hand')              // Vector2，节点局部坐标
    hero.add(new SpineBoneNode({ bone: 'gun-tip' })).add(new Particles2D({ ... }))   // 每帧跟着骨骼
    hero.state.setAnimation(1, 'aim', true)  // 进阶：spine-core 的 AnimationState / Skeleton
    hero.spine.findBone('head')
  }
}
```

### `spineSkeleton(path, options?)` → `SpineSkeleton`（实现 `Resource`）

| 项 | 说明 |
|---|---|
| `path` | 骨架 JSON，相对资源目录（`~<包名>/` 也行）。同一路径同一句柄。 |
| `options.atlas` | 图集文件，默认把 `path` 的扩展名换成 `.atlas`。 |
| `options.scale` | `SkeletonJson.scale`（美术按 2× 出图、运行时缩小），默认 1。 |
| `isLoaded` | 骨架解析完且所有页图加载完。 |
| `data` | spine-core `SkeletonData`（没加载时报错：放进 `static assets`）。 |
| `pages` | 页图句柄 `Texture[]`（加载后）。 |
| `animationNames` / `skinNames` / `boneNames` / `slotNames` | 字符串数组（排错、dump）。 |
| `rect` | 设置姿势的包围盒（`Rect2`，y 向下，含 `scale`）。 |

加载：`_load(platform)`：`loadText(json)` 和 `loadText(atlas)` 并行 → `new TextureAtlas(text)`，每页 `tex(joinPath(dirname(atlas), page.name))`，`handle._premultiplied = page.pma`，`page.setTexture(new SpinePageTexture(handle))` → `new SkeletonJson(new AtlasAttachmentLoader(atlas))`（`scale`）→ `readSkeletonData(jsonText)`；再用临时 `Skeleton` 算 `rect`；页图由引擎按 `_textures()` 加载。错误都带路径：版本不是 4.3（`json.skeleton.spine`）、图集缺 region（spine 的错误再包一层）、JSON 不是 Spine 导出。`_unload` 保留 `SkeletonData`（和 TiledMap 一样，切回来只重载页图）。

### `SpineSprite extends Node2D`

构造选项 `SpineSpriteOptions extends Node2DOptions`：`skeleton`（必填）、`animation?`（给了就在轨道 0 播）、`loop?`（默认 true）、`skin?`、`defaultMix?`（秒，默认 0）、`speedScale?`（默认 1）、`flipH?` / `flipV?`、`physics?: 'update' | 'pose' | 'none'`（默认 `update`）。

| 成员 | 说明 |
|---|---|
| `skeleton: SpineSkeleton` | 资源（只读）。 |
| `spine: Skeleton`、`state: AnimationState` | spine-core 的运行时对象（进阶）。 |
| `play(name, { loop = true, track = 0 }?)`: TrackEntry | `state.setAnimation`。未知动画名报错并列出可用的。 |
| `queue(name, { loop = true, track = 0, delay = 0 }?)`: TrackEntry | `state.addAnimation`。 |
| `stop(track = 0, mixDuration = 0)` | `state.setEmptyAnimation`（混回设置姿势）。 |
| `animation: string \| null` | 轨道 0 当前动画名。 |
| `isPlaying` | 轨道 0 有动画且（循环或还没播完）。 |
| `speedScale` | `state.timeScale`（≥ 0）。 |
| `defaultMix` / `mix(from, to, seconds)` | `AnimationStateData`。 |
| `skin: string \| null` | `setSkin` + `setupPoseSlots`；未知皮肤报错。 |
| `setAttachment(slot, name \| null)` | `skeleton.setAttachment`。 |
| `setupPose()` | 回到设置姿势（清轨道）。 |
| `flipH` / `flipV` | 骨架 `scaleX` / `scaleY` 取负。 |
| `bonePosition(name): Vector2`、`boneRotation(name): number`（弧度） | 骨骼世界变换换成节点局部坐标；未知骨骼报错。 |
| `rect: Rect2` | 资源的包围盒按翻转镜像；没设 `hitArea` 时的点击区域。 |
| 信号 `animationStarted(name, track)`、`animationFinished(name, track)`、`animationEvent(name, event: SpineEvent, track)` | spine 的 `start` / `complete` / `event`。`SpineEvent = { int, float, string, time }`。 |

- 每帧（`_internalProcess`）：`state.update(dt)`、`spine.update(dt)`、`state.apply(spine)`、`spine.updateWorldTransform(Physics.*)`；有动画在播或手动改了姿势就 `_poseVersion++`。暂停 / `timeScale` 按引擎规则。
- 进树时 `tree.get(SpineRuntime)`，没装 `spine()` 报错：`SpineSprite requires the spine plugin: plugins: [spine()] from '@sapling2d/spine'`。
- `dumpProps`：`skeleton`（路径）、`animation`、`playing`、`skin`（非默认）、`speedScale`（≠ 1）、`flipH` / `flipV`。
- dark tint（slot 有 `darkColor`）：渲染忽略，每个资源警告一次。

### `SpineBoneNode extends Node2D`

`{ bone: string }`。必须是 `SpineSprite` 的直接子节点（进树时检查，否则报错）。每帧（父节点更新骨架之后——快照顺序父先于子）把 `position` / `rotation` / `scale` 设成骨骼的世界变换（`appliedPose` 的 `worldX / worldY / getWorldRotationX / getWorldScaleX|Y`，角度转弧度、y 向下已由 `yDown` 处理）。不支持反过来驱动骨骼。

### `spine()` 插件 / `SpineRuntime`

`spine()`：`install(ctx)` 登记 `SpineSprite` 的渲染内容（`registerNodeContent`，幂等）、`ctx.provide(SpineRuntime, { version: '4.3' })`。没有选项。

## 渲染（`SpineContent`，`packages/spine/src/render.ts`）

- `display`：一个 `Container`；每个（slot, attachment）一个缓存项 `{ mesh: Mesh, vertices: Float32Array, uvs, indices: Uint16Array, texture: Texture | null, resource, tint, alpha, blend }`，第一次出现时创建（`MeshGeometry({ positions, uvs, indices })`、`batchMode = 'batch'`、`roundPixels = pixelArt`）。
- `sync(node, ctx)`：`node.visible` 且 `_poseVersion` 变了（或页图资源变了）才跑。遍历 `spine.drawOrder.appliedPose`：Region / Mesh 附件 → `computeWorldVertices` 写进缓存的 `vertices`，`buffer.update()`；`uvs = sequence.getUVs(index)`（变了才写）；颜色 `tint` / `alpha`；`blendMode`（Normal → `'inherit'`，Additive → `'add'`，Multiply → `'multiply'`，Screen → `'screen'`）；贴图 `ctx.textures.get(handle)`（`_resource` 变了才取）。Clipping 附件 → `SkeletonClipping.clipStart / clipTrianglesUnpacked / clipEnd`，裁剪后的顶点 / uv / 索引写进该项（尺寸变了换新数组）。alpha 为 0 或没附件 → 不显示。
- 子对象顺序和可见 slot 顺序一致：逐个比较，不一致才 `removeChildren` + `addChild`。
- 每帧不分配：缓存数组复用；只有附件第一次出现 / 裁剪尺寸变化分配。
- `destroy`：销毁所有 mesh 和 geometry。

## 核心新增 / 修改（`sapling2d`）

1. `src/render/NodeContent.ts`：`registerNodeContent(cls, factory)`（Map，重复登记覆盖）；`createContent` 内置链之后按登记表 `instanceof`。`RenderContext` 接口（`pixelArt`、`textures: { get(texture): PixiTexture }`），`SyncContext` 满足它。
2. 新入口 `sapling2d/render`（`src/render/index.ts`）：导出 `registerNodeContent`、`NodeContent`、`RenderContext`、`PixiRenderer`、`CONTENT_LABEL`。`package.json` `exports` / `publishConfig.exports`、`tsdown` 入口。
3. `src/core/assets.ts`：`export interface Resource { readonly kind: string; readonly path: string; readonly isLoaded: boolean; _load(platform): Promise<void>; _unload(): void; _textures?(): Texture[] }`；`AssetMap` 联合加 `Resource`；`assetRoot` / `assetResources` / `loadOne` 按 `'_load' in asset` 分派（`loadOne`：`_load` 后再加载 `_textures()` 里没加载的）。`Texture._premultiplied: boolean`（@internal）；`TextureCache._imageSource` 按它设 `alphaMode: 'premultiplied-alpha'`。主入口导出 `type Resource`。
4. `SceneTree._pin`：存资源本身，`_unloadUnused` 时展开（`assetResources`）再判断。
5. `src/vite/index.ts` + `mounts.ts`：`discoverAssetFunctions(root, extra)`——依赖包 `package.json` 的 `sapling2d.assetFunctions: string[]`；`sapling({ assetFunctions })` 追加；`findAssetReferences(code, fns = DEFAULT_FNS)` 动态拼正则；`transform` 的快速预检也用这个列表。
6. 文档：`CONTEXT.md`（Spine、Resource、render 扩展点词条，Entry points）、`llms.template.md`（入口表、Spine 一节 + 示例、节点清单、dump 表、插件一节的"现有插件"、常见陷阱：版本 / 许可证 / PMA）、三个 README 入口表、`templates/game/AGENTS.md`。

## 示例与验证

- `examples/spine`：官方 `spineboy`（4.3 导出，`spineboy-pro.json` + `spineboy.atlas` + `spineboy.png`，放 `public/assets/spineboy/`）。场景：spineboy 站在屏幕下方 `idle`；点击 → `jump` 接 `idle`；按 `KeyA` / `KeyD` 或屏幕左右半区切 `walk` / `run` 并翻转；`shoot` 时 `gun-tip` 骨骼上的 `SpineBoneNode` 挂一个 `Particles2D` 喷火花；`footstep` 事件在 HUD 计数。`test/spine.test.ts` 无头：事件次数、`bonePosition` 随动画变化、`animationFinished` 时刻、暂停不推进。浏览器截图；小游戏构建打印包体积、模拟器跑通；真机留验证工单。
- `packages/spine/test`：手写的最小 4.3 JSON + atlas（一根骨骼、一个 region、一个 mesh、一个 clipping、一个事件、两套皮肤、一个 additive slot）+ `spineboy-ess.json` / `.atlas` 作集成夹具（不要 PNG）。用例见各工单。

## 顺序

每步 `pnpm check` 绿。

1. 01 核心的扩展点：`sapling2d/render` 登记表、`Resource` 协议、PMA 标记、`_pin` 展开、`sapling()` 的 `assetFunctions`
2. 02 `@sapling2d/spine`：资源、节点、插件、`SpineBoneNode`（无头测试全绿）
3. 03 渲染内容 `SpineContent` + 同步测试
4. 04 `examples/spine` + 文档（llms、CONTEXT、README、模板）
5. 05 浏览器 / 模拟器 / 真机验证与发布（engine 0.4.0、spine 0.1.0）

## 不在范围内

dark tint 渲染、`.skel`、`SpineSlotNode`、驱动骨骼、Spine 4.2 及更早（另开大版本线）、骨架之间共享 `AnimationState`、`SkeletonBounds` 多边形命中（用 `hitArea`）。
