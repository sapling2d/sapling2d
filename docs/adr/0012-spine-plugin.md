# 0012 — Spine 骨骼动画：独立插件包，逻辑用 spine-core、渲染用引擎的 NodeContent 扩展点

**Status:** Accepted (2026-10-31)

## Context

很多 2D 手游的角色动画是 Spine 做的（骨骼、网格变形、换装、事件），`AnimatedSprite2D` 的 PNG 序列替代不了：体积大、不能换装、没有骨骼挂点。引擎要能显示 Spine 角色，并且保持 code-first 的三条底线：节点自持数据、渲染层只做同步（ADR 0002）；无头测试里逻辑可运行、结果确定；浏览器和小游戏同一份代码。

Spine 官方的 Web 运行时（`@esotericsoftware/spine-ts`）分成 `spine-core`（纯 TS：加载、骨架、动画状态、裁剪，不碰 DOM）和各渲染器的集成（`spine-pixi-v8`、`spine-webgl`、`spine-canvas`、`spine-phaser`、`spine-threejs`）。`spine-pixi-v8` 的 `Spine` 类自己持有骨架和动画状态、用 Pixi 的 `Assets` 加载（`fetch` + `Image`，小游戏没有）、靠 `Ticker` 推进、按 slot 挂进 Pixi 的批处理器，并依赖 `spine-canvas`。Godot 的 `spine-godot` 把资源（`SpineSkeletonDataResource` = 骨架文件 + 图集）和节点（`SpineSprite`，Node2D）分开，动画通过 `get_animation_state().set_animation(track, name, loop)`，事件是信号，`SpineBoneNode` 跟随骨骼；运行时对象可以直接拿到。

引擎现状里有两处"封闭"的地方挡着插件：`createContent()`（节点类型 → Pixi 内容）是写死的 `instanceof` 链；`AssetMap` 是封闭联合，`loadAssets` 按 `kind` 分派。Spine 的运行时版本和编辑器版本绑定（4.3 的运行时读不了 4.2 的导出，JSON 结构都不同），许可证要求集成方告知用户需要自己的 Spine 编辑器许可。

## Decision

### 包：`@sapling2d/spine`（`packages/spine`）

- 只依赖 `@esotericsoftware/spine-core`（4.3 这一条线）做加载、骨架、动画状态、事件、裁剪，**不依赖 `spine-pixi-v8`**：它要 Pixi `Assets` / `Ticker`、`fetch` / `Image`（小游戏没有），而且骨架归它的 `Spine` 显示对象所有，和"节点自持数据"冲突。
- 渲染由本包自己写：每个 slot 一个 Pixi `Mesh`（标准着色器，`batchMode: 'batch'`，和精灵一起合批），顶点由 spine-core 的 `computeWorldVertices` 算，裁剪用 `SkeletonClipping`，颜色 = 骨架 × slot × 附件 × `selfModulate`，混合模式按 slot（Normal 跟随节点，Additive / Multiply / Screen 用 Pixi 的同名模式）。只用 Pixi 的公开 API。`Skeleton.yDown = true`，坐标直接是 y 向下。
- `spine()` 插件：`install(ctx)` 向渲染层登记 `SpineSprite` 的内容工厂、提供 `SpineRuntime` 服务（版本信息）。三个平台都能装；无头下登记没有渲染器用，无害。
- `peerDependencies`：`sapling2d`、`pixi.js`（和引擎共用同一份）。包的大版本跟随 Spine 的大版本线，文档写明"读 Spine 4.3 的导出"；加载时检查 `skeleton.spine` 版本，不是 4.3 报错（4.2 的 JSON 会被静默读成空骨架）。

### 资源：`spineSkeleton(path, { atlas?, scale? })` → `SpineSkeleton`

- 路径是骨架 JSON（相对资源目录），图集默认同目录同名 `.atlas`，图集页的图片按图集里的文件名相对图集目录用 `tex()` 取句柄——页图走引擎现有的贴图管线（`Platform.loadImage`、`TextureCache`、小游戏分包、切场景卸载）。
- 加载 = 读两个文本 + 解析（`TextureAtlas` + `SkeletonJson`）+ 加载页图；无头下文本从 `assetsDir` 读真实文件，页图宽高为 0 但图集里带 `size`，UV 和包围盒都正确——**骨骼位置、事件时刻、动画完成在 Node 里可测**。
- 图集页的 `pma` 标记写到贴图句柄上（`Texture._premultiplied`），`TextureCache` 按它建 `ImageSource`（`alphaMode`），PMA 和非 PMA 导出都正确。
- 只支持 JSON；`.skel` 二进制等 `Platform.loadBinary`（小游戏 iOS 没有 `TextDecoder`，spine-core 的二进制读取不依赖它，可做）。

### 节点：`SpineSprite`（Node2D）与 `SpineBoneNode`

- 构造：`{ skeleton, animation?, loop?, skin?, defaultMix?, speedScale?, flipH?, flipV?, physics? }`。资源没加载就报错（要放进 `static assets`）。
- 常用操作是轨道 0 的糖：`play(name, { loop, track })`、`queue(name, { loop, track, delay })`、`stop(track, mix)`、`animation`、`isPlaying`、`speedScale`、`defaultMix`、`mix(from, to, s)`、`skin`、`setAttachment(slot, name)`、`setupPose()`、`bonePosition(name)` / `boneRotation(name)`、`rect`（设置姿势的包围盒，也是默认点击区域）。信号 `animationStarted`、`animationFinished`（Spine 的 complete：循环动画每圈一次）、`animationEvent`（Spine 用户事件，含 int / float / string）。
- 进阶直接用 spine-core 的对象：`state`（`AnimationState`）、`spine`（`Skeleton`），`play` / `queue` 返回 `TrackEntry`。不包一层 Godot 式的 wrapper：spine-core 本身就是 TS。
- 每帧在 `_internalProcess` 里 `state.update` → `skeleton.update` → `state.apply` → `updateWorldTransform(Physics.update)`；暂停时不推进，`timeScale` 自然生效。只有姿势变了（动画在播、换装、手动改）才让渲染层重新同步（`_poseVersion`）。
- `SpineBoneNode({ bone })`：放在 `SpineSprite` 下面的 Node2D，每帧把自己的变换设成那根骨骼的世界变换（跟随模式）；枪口特效、手持武器都挂它下面。

### 核心的两个扩展点（`sapling2d`）

1. **`sapling2d/render`**：`registerNodeContent(cls, (node, ctx) => NodeContent)`——`createContent` 的内置链之后查登记表。导出 `NodeContent`、`RenderContext`（`pixelArt`、`textures.get(handle)` → Pixi 贴图）、`PixiRenderer`（含同步测试用的 `_createForSyncTests`）。不再有第二种"节点 → 显示对象"的路：插件节点和内置节点走同一条。
2. **`Resource` 协议**：`{ kind, path, isLoaded, _load(platform), _unload(), _textures?() }`，`AssetMap` 接受它；`loadAssets` 调 `_load` 再加载 `_textures()`；切场景按资源 + 它的贴图判断卸载；`PluginContext.preload` 钉住的资源在卸载时展开它的贴图。`TiledMap` 就是它的第一个实现（不改）。
3. `sapling()` 的字面量路径检查：包的 `package.json` 声明 `"sapling2d": { "assetFunctions": ["spineSkeleton"] }`，构建期对 `spineSkeleton('…')` 做存在性检查；`sapling({ assetFunctions })` 可追加。

### 许可证

Spine Runtimes License：集成到工具 / 引擎里免费，但**每个使用本插件的开发者要有自己的 Spine 编辑器许可**，并且分发时带上许可证声明。README 和 `llms.txt` 明示；本仓库不复制 spine-core 的代码（npm 依赖）。示例用官方 `spineboy` 导出（官方仓库允许评估使用）。

### 不做（v1）

双色染色（dark tint：Pixi 要专门的批处理器；用了的 slot 警告一次）；`.skel`；`SpineSlotNode` / 驱动骨骼模式；一个 `SpineSprite` 混合多份骨架；编辑器里的预览（没有编辑器）。

## Consequences

- 引擎核心零 Spine 代码；不装 `@sapling2d/spine` 的游戏包里没有 spine-core（约 90 KB gzip）。
- `sapling2d/render` 是一条新的公开面：任何第三方节点类型都能有自己的 Pixi 内容。`Resource` 让插件带自己的资源格式（以后 Live2D、DragonBones、字体一样走）。
- 逻辑在无头测试里完整可跑：动画状态、事件、骨骼位置和真机一致；渲染同步用 `_createForSyncTests` 断言 mesh 数量 / 顺序 / 贴图。
- 运行时版本绑定由本包承担：Spine 出 4.4 时发本包的新大版本；游戏按自己的编辑器版本选。
- iOS 无 JIT 的代价：每个 slot 每帧 `computeWorldVertices`（无分配）+ Pixi 合批拷贝；一个 50 slot 的角色约等于 50 个精灵。真机数据等验证工单。

## Alternatives

- **直接包一层 `spine-pixi-v8`**：少写渲染，但要给它换掉 `Assets` / `Ticker` / `fetch` / `Image`、骨架归它所有、无头测试还要 import 它；它还依赖 `spine-canvas`。拒绝。
- **`SkeletonRendererCore` + 自定义着色器**：spine-core 4.3 自带的渲染命令生成器（按贴图合并、带逐顶点颜色）。一个角色几条命令、几次绘制，但自定义着色器不能和精灵合批，`roundPixels` / `pixelArt` 要自己做。先用每 slot 一个 Mesh；性能不够再换。
- **把 Spine 放进引擎核心**：`sapling2d` 会带上 spine-core 和许可证义务；拒绝（ADR 0010 的"不装不进包"）。
- **节点上用 Godot 式 wrapper（`SpineAnimationState` 等）**：Godot 需要是因为 GDScript 不能直接用 C++ 对象；TS 里 spine-core 的类型就是文档。只做轨道 0 的糖。
