# 01 — 核心扩展点：`sapling2d/render` 登记表、`Resource` 协议、PMA 标记、`sapling()` 的 `assetFunctions`

**What to build:** 让一个外部包能带自己的节点渲染和资源格式，核心不认识 Spine。规格见 `../spec.md`"核心新增 / 修改"。

- `registerNodeContent(cls, factory)`；`createContent` 内置链之后查登记表；`RenderContext` 公开接口；新入口 `sapling2d/render`（`package.json` exports / publishConfig / tsdown）。
- `Resource` 接口进 `AssetMap`；`assetRoot` / `assetResources` / `loadOne` 泛化；`loadOne` 在 `_load` 之后加载 `_textures()`；`_pin` 存资源、卸载时展开。
- `Texture._premultiplied` → `TextureCache` 的 `alphaMode`。
- `discoverAssetFunctions`（依赖包 `sapling2d.assetFunctions`）+ `sapling({ assetFunctions })`；`findAssetReferences(code, fns?)`。

**Blocked by:** None

**Status:** done（2026-10-31）

- [x] `registerNodeContent(MyNode, …)` 后同步时创建它的内容；未登记的 Node2D 子类仍是空容器；重复登记覆盖
- [x] 一个只实现 `Resource` 的假资源放进 `static assets`：`_load` 被调用、`_textures()` 的贴图被加载；切到不用它的场景时资源和贴图都卸载；另一场景共用同一张页图时不卸载；`ctx.preload` 钉住的资源的贴图不卸载
- [x] `_premultiplied` 的贴图创建的 `ImageSource.alphaMode === 'premultiplied-alpha'`，其它不变
- [x] `sapling({ assetFunctions: ['spineSkeleton'] })` 和依赖包声明 `assetFunctions` 都能让 `spineSkeleton('missing.json')` 构建失败、存在时通过；现有 `findAssetReferences` 测试不变
- [x] `pnpm check` 绿；`pnpm --filter sapling2d build` 产出 `dist/render.js` / `render.d.ts`

## Comments

**实现（2026-10-31）：** `test/resource.test.ts`（假资源 `Manifest` 走完加载 / 共用图片 / 钉住三条路；登记表；`_premultiplied`）、`test/vite-plugin.test.ts` 加 4 个用例（`discoverAssetFunctions`、`findAssetReferences(code, fns)`、依赖包声明和 `sapling({ assetFunctions })` 两条构建路径）。和 spec 的出入：

- `Resource` 的分派用 `'_load' in asset`（不是 `kind`）：`Resource.kind` 是开放的字符串，按字面量窄化会把它排除不掉。
- `_pin` 存声明的句柄、`_unloadUnused` 时再展开：自定义资源的图片要 `_load` 之后才知道（之前 `_pin` 在安装时就展开，Tiled 关卡的图块集图片其实也漏了）。
- `loadOne` 在 `_load` 之后加载 `_textures()` 里还没加载的图片；`TiledMap._load` 自己也加载（幂等，没改）。
- `NodeContent` 变成泛型 `NodeContent<T extends Node2D = Node2D>`，`sync` 的 ctx 类型是公开的 `RenderContext`（`SyncContext extends RenderContext`）；`CONTENT_LABEL` 导出。
- `sapling2d/render` 顺带导出 `PixiRenderer`（插件的渲染同步测试要 `_createForSyncTests()`）。
