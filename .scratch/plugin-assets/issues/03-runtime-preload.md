# 03 — 运行时：`PluginContext.preload`、钉住的资源、无头测试解析 `~<包名>/`、`data:` 贴图

**What to build:** 引擎这边配合插件资源的三件小事。规格见 `../spec.md`"运行时"一节。

- `PluginContext.preload(assets: AssetMap)`：`Game.create` 收集，在 `prepareAssets` 之后和 `options.main.assets` 合并成一次 `loadAssets`（进度一条）。入口场景的 `static assets` 和插件资源重复时只加载一次（`loadAssets` 本来就按句柄去重）。
- `SceneTree._pin(assets)`（@internal）：`assetResources` 归结到整张图后加入 `_pinned`；`_unloadUnused` 跳过钉住的资源。
- `createTestGame`：`readNodeFile` 遇到 `~<pkg>/<rest>` → `createRequire(join(cwd, 'package.json')).resolve('<pkg>/package.json')` 的目录 + `sapling2d.assets` + `rest`；没装或没字段时抛出和构建期同样措辞的错误。
- `tex('data:…')`：确认 `Texture.path` 原样进 `platform.loadImage`，浏览器可用；文档写明"小游戏真机验证"（05）。

**Blocked by:** None — can start immediately

**Status:** done（2026-10-20）

- [x] `test/plugins.test.ts`：插件 `preload({ icon })` 后 `createTestGame` 返回时该贴图 `isLoaded`（无头下宽高 0 也算已加载），`loadProgress` 为 1；切到一个也列了它的场景再切走，它仍然 `isLoaded`；没钉住的场景资源照常卸载（对照用例）
- [x] 加载进度：插件资源和场景资源合并成一次 `loadAssets`（按句柄去重由 `loadAssets` 保证，现有用例覆盖）
- [x] `createTestGame({ root })` 读 `~@foo/levels/maps/hello.txt` 走 `root` 的 node_modules（临时目录里造假包）；没装时的错误信息包含包名和 `sapling2d.assets`
- [x] `pnpm check` 绿（engine 516）；`llms.txt` 的"插件"一节加了 `ctx.preload` 和 `~<包名>/` 两句

## Comments

**实现（2026-10-20）：**

- **无头测试找包复用构建工具的 `discoverAssetMounts`**（动态 `import('../vite/mounts.ts')`，和读文件的 `node:fs/promises` 一样：`sapling2d/testing` 要通过没有 Node 类型的核心类型检查）。没有用 `createRequire(...).resolve('<pkg>/package.json')`——理由同 01：exports 不暴露 package.json 的包会解析失败。
- 新增 `TestGameOptions.root`（默认 `'.'`）：工程根目录，插件包从它的 node_modules 里找；`assetsDir` 的语义不变（相对当前工作目录）。测试里临时目录当 root。
- `startupAssets` 的 key 用 `\0plugin<n>`（不是合法标识符，场景的 key 撞不上）；`loadAssets` 按资源去重，key 只是占位。
- `_pinned` 存资源对象（整张图 / `AudioStream` / `TiledMap`），和 `_unloadUnused` 比较的单位一致。
- `data:`：浏览器 `img.src` 直接用；小游戏跳过 `assets.resolve`（否则会被当成分包里的路径）。两端都没有单元测试（没有 DOM / wx 的假对象），05 真机验证。
