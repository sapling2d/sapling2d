# 03 — 运行时：`PluginContext.preload`、钉住的资源、无头测试解析 `~<包名>/`、`data:` 贴图

**What to build:** 引擎这边配合插件资源的三件小事。规格见 `../spec.md`"运行时"一节。

- `PluginContext.preload(assets: AssetMap)`：`Game.create` 收集，在 `prepareAssets` 之后和 `options.main.assets` 合并成一次 `loadAssets`（进度一条）。入口场景的 `static assets` 和插件资源重复时只加载一次（`loadAssets` 本来就按句柄去重）。
- `SceneTree._pin(assets)`（@internal）：`assetResources` 归结到整张图后加入 `_pinned`；`_unloadUnused` 跳过钉住的资源。
- `createTestGame`：`readNodeFile` 遇到 `~<pkg>/<rest>` → `createRequire(join(cwd, 'package.json')).resolve('<pkg>/package.json')` 的目录 + `sapling2d.assets` + `rest`；没装或没字段时抛出和构建期同样措辞的错误。
- `tex('data:…')`：确认 `Texture.path` 原样进 `platform.loadImage`，浏览器可用；文档写明"小游戏真机验证"（05）。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `test/plugins.test.ts`：插件 `preload({ icon: tex('~x/icon.png') })` 后 `createTestGame` 返回时该贴图 `isLoaded`（无头下宽高 0 也算已加载）；切到一个也列了它的场景再切走，它仍然 `isLoaded`；没钉住的场景资源照常卸载（现有卸载用例不变）
- [ ] 加载进度：启动页看到的 `loadProgress` 单调到 1，插件资源和场景资源合并（spy `platform.loadImage` 的调用次数 = 去重后的数量）
- [ ] `createTestGame({ assetsDir })` 读 `tiledMap('~@foo/levels/1.json')` 走 node_modules（临时目录里造假包）；没装时的错误信息包含包名和 `sapling2d.assets`
- [ ] `pnpm check` 绿；`llms.txt` 的"插件"一节加 `ctx.preload` 一句（示例测试 `docs/examples/plugin-assets.test.ts` 可以和 04 一起做）

**实现提示**

- `Game.create` 里 `loadAssets(options.main.assets, …)` 那一处改成合并后的 `AssetMap`（key 加前缀避免和场景的 key 撞：`{ ...pluginAssets, ...main.assets }` 以场景为准即可，加载按句柄去重和 key 无关）。
- 钉住的集合存资源对象（`Texture` 整张图、`AudioStream`），不是路径：`_unloadUnused` 比较的就是对象。
