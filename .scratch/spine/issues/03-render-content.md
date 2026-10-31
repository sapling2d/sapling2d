# 03 — `SpineContent`：每 slot 一个 Pixi Mesh 的渲染同步

**What to build:** `packages/spine/src/render.ts` 和 `spine()` 里的 `registerNodeContent(SpineSprite, …)`。规格见 `../spec.md`"渲染"。用 `PixiRenderer._createForSyncTests()`（`sapling2d/render`）做同步测试，不需要 WebGL。

**Blocked by:** 02

**Status:** done（2026-10-31）

- [x] 同步后内容容器的子对象 = 有 region / mesh 附件的 slot，顺序和 `drawOrder.appliedPose` 一致；draw order 动画改变顺序后子对象重排；没附件的 slot 隐藏
- [x] region 附件 4 顶点 6 索引、mesh 附件顶点数 = `worldVerticesLength / 2`、索引 = `triangles`；顶点随动画变化（和 `computeWorldVertices` 一致）
- [x] clipping：被裁的 slot 顶点 / 索引来自 `SkeletonClipping`，裁完全不可见时隐藏
- [x] 颜色：slot 颜色 × 附件颜色 × `selfModulate` → `tint`，alpha 乘积 → `alpha`；additive slot 的 `blendMode === 'add'`，normal 是 `'inherit'`
- [x] 贴图：页图没加载时 `Texture.EMPTY`，加载后换成缓存里的 Pixi 贴图；页图资源换了会重新取；`pixelArt` → `roundPixels`
- [x] 姿势没变（没动画在播、没改装）时 `sync` 不写缓冲区（`_poseVersion` 不变）；隐藏时不同步
- [x] 节点离开树时 mesh 和 geometry 销毁
- [x] 每帧不分配：附件首次出现之后同步 100 帧不新建数组（用 `vi.spyOn(Float32Array)` 或计数器验证不现实，就 review 代码路径 + 注释）
- [x] `pnpm check` 绿

## Comments

**实现（2026-10-31）：** `src/render.ts`。和 spec 的出入 / 坑：

- 页图资源的比较不能放在 `&&` 短路后面：第一次同步时 `_poseVersion` 不等就跳过了记录，第二次才记、误判成"变了"（多同步一次）。现在每次同步都先算 `pagesChanged`。
- 裁剪：spine 的 `clipTrianglesUnpacked` 对完全在多边形内的三角形也会"裁"（输出不共享顶点：一个 quad 变 6 个顶点 12 个值），所以被 clipping 覆盖的 slot 顶点数和原来不同；裁剪后的数组按精确长度分配（Pixi 按数组长度算顶点 / 索引数），顶点数变化时才重新分配。
- 最小夹具里 clip 槽设置姿势不带附件（否则每个用例的 body 都是裁过的），测裁剪时 `setAttachment('clip', 'clip')`；用例改了共享的附件顶点要还原。
- 浏览器验证：spineboy 18 个 slot 全部 `batched`、一张贴图、混合模式 inherit；渲染平均 0.5 ms / 帧（M 系列 Mac，Chrome），首帧 267 ms（着色器编译 + 上传）。
