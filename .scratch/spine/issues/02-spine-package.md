# 02 — `@sapling2d/spine`：资源、节点、插件、`SpineBoneNode`（无头）

**What to build:** `packages/spine`（照 `packages/touch` 的工程结构：`package.json`、`tsconfig*.json`、`tsdown.config.ts`、`vitest.config.ts`、`src/env.d.ts`），依赖 `@esotericsoftware/spine-core@^4.3.13`，peer `sapling2d`、`pixi.js`。`package.json` 声明 `"sapling2d": { "assetFunctions": ["spineSkeleton"] }`。规格见 `../spec.md`。

- `src/resource.ts`：`SpineSkeleton` / `spineSkeleton()`、`SpinePageTexture`（spine `Texture` 子类，持句柄）、版本检查、`rect`。
- `src/SpineSprite.ts`、`src/SpineBoneNode.ts`、`src/plugin.ts`（`spine()`、`SpineRuntime`）、`src/index.ts`。渲染内容留给 03（这张工单里 `spine()` 只 provide，登记在 03 接上）。
- 夹具：`test/fixtures/minimal/`（手写 4.3 JSON + atlas）、`test/fixtures/spineboy/`（官方 `spineboy-ess.json` + `spineboy.atlas`，不要 PNG）。

**Blocked by:** 01

**Status:** done（2026-10-31）

- [x] 资源：`createTestGame({ assetsDir })` 后 `isLoaded`、`pages` 路径（图集目录 + 页名）、`animationNames` 等、`rect` 和 spine 的 `getBounds` 一致（y 向下）；`atlas` / `scale` 选项；版本不是 4.3 报错并说明；图集缺 region 的错误带路径；同一路径同一句柄；`spineboy-ess` 能加载
- [x] 节点：`animation` 选项立即播放；`play` / `queue` / `stop` / `animation` / `isPlaying`；`animationFinished` 在正确的帧触发（按 `fps` 和时长算），循环动画每圈一次；`animationEvent` 的时刻、int / float / string；`speedScale` 和 `tree.timeScale` 叠加；`tree.paused` 不推进；`defaultMix` / `mix`
- [x] `skin` 换装后 `setAttachment` 生效；未知动画 / 皮肤 / 骨骼报错并列出可选项；`flipH` 让 `bonePosition` 的 x 取反
- [x] `bonePosition` / `boneRotation` 随动画变化，且和 spine-core 直接算的一致
- [x] `SpineBoneNode` 每帧跟随；不是 `SpineSprite` 的子节点时进树报错
- [x] 没装 `spine()` 时进树报错并提示
- [x] `dump()`：`Hero (SpineSprite) position=(…) skeleton=hero/hero.json animation=idle playing`
- [x] 每帧热路径不分配（`play` 之外）
- [x] `pnpm check` 绿

## Comments

**实现（2026-10-31）：** `packages/spine`，36 个用例（resource 8、sprite 13、bone-node 2、render 12、docs 示例 1）。和 spec 的出入：

- `isPlaying` 对"空动画"（`stop()` 之后的 `<empty>` 轨道项）返回 false，`animation` 返回 null（spine 的空动画也是一个 TrackEntry）。
- 多加了 `refreshPose()`：直接改 `spine`（spine-core 的 Skeleton）之后让渲染层本帧更新；`skin` / `setAttachment` / `flipH` / `setupPose` 内部都走它。
- `_dirty` 初始为 false（构造时已经 `updateWorldTransform`，首次同步靠 `_poseVersion` 0 ≠ -1），否则静止的角色第一帧多同步一次。
- 一帧 = 1/60 秒累加有浮点误差：0.5 秒的事件在第 31 帧触发、1 秒的动画在第 60 帧完成——测试按这个写，文档不承诺"恰好第 N 帧"。
- 官方 spineboy 的图集叫 `spineboy.atlas`，骨架叫 `spineboy-ess.json` / `spineboy-pro.json`：要写 `{ atlas }`；夹具只放 JSON 和 atlas（无头不读 PNG）。
- `SpineBoneNode` 的 y 轴取反（spine 的局部 y 朝上，引擎朝下），否则挂上去的子节点上下颠倒；翻转时分解成 旋转 + 带符号的缩放。
- 版本检查看 `skeleton.spine` 的 major.minor（spineboy 4.3 示例导出写的是 `4.3.75-beta`，也算 4.3）。
