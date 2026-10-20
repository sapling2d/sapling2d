# 01 — `sapling()`：按 `package.json` 字段挂载插件资源，`~<包名>/` 路径的校验、serve 和拷贝

**What to build:** `sapling2d/vite` 里的挂载发现和浏览器端的全部支持。规格见 `../spec.md`"挂载发现"和"`sapling()`"两节。

- `discoverAssetMounts(root, extra)`（`src/vite/mounts.ts`，`sapling()` 和 02 的 `saplingWechat()` 共用）：读游戏 `package.json` 的 `dependencies` / `devDependencies` + `extra`，`createRequire` 解析每个包的 `package.json`，取 `sapling2d.assets`；目录不存在时 `console.warn` 并跳过。附带 `parseMountPath(path)` → `{ pkg, rest } | null`（`~@a/b/x` 取两段，`~a/x` 取一段，不以 `~` 开头返回 null）。
- `SaplingPluginOptions.assetPackages?: string[]`。
- `transform`：`~` 路径对照挂载目录做现有的三项检查（在目录里 / 存在 / 最相近文件名）；包没挂载时的报错要说清楚两种可能（没装、没声明字段）。`data:` 路径跳过。
- `configureServer`：中间件 serve `/assets/~<pkg>/<rest>`；`watcher.add(mountDir)`；`package.json` 变化时重算挂载并 full-reload。
- `writeBundle`：挂载目录整个拷到 `<outDir>/assets/~<pkg>/`。
- `buildStart`：`assetsRoot` 顶层有以 `~` 开头的条目 → 报错（保留前缀）。

**Blocked by:** None — can start immediately

**Status:** done（2026-10-20）

- [x] `test/vite-plugin.test.ts`：临时目录里造一个 `node_modules/@foo/joystick/{package.json,assets/knob.png}`（`package.json` 带 `sapling2d.assets`）和游戏 `package.json`（`dependencies: { "@foo/joystick": "*" }`）；`tex('~@foo/joystick/knob.png')` 构建成功，`dist/assets/~@foo/joystick/knob.png` 存在（嵌套目录 `skins/dark/base.png` 也在）
- [x] 缺文件：`tex('~@foo/joystick/knb.png')` 报错并提示 `~@foo/joystick/knob.png`
- [x] 没挂载的包：`tex('~@bar/x/a.png')` 的报错同时提到"没安装"和"没声明 sapling2d.assets"
- [x] 包在 `dependencies` 里但没有字段 → 不挂载（引用它报同样的错）；只在 `assetPackages` 里 → 挂载；无 scope 包名 `~another-pkg/click.mp3` 正确拆分
- [x] `public/assets/~mine/` 存在时 `buildStart` 报错
- [x] `tex('data:image/png;base64,…')` 不报错
- [x] dev 中间件：`createServer()` + `listen()`，`GET /assets/~@foo/joystick/knob.png` 返回 200 和 `image/png`；没有的文件和没挂载的包不归它管（落到 Vite 自己的处理）
- [x] 现有 10 个用例不变（加上 `data:` 一共 19 个）
- [x] `pnpm check` 绿（engine 508）

**实现提示**

- `sapling2d/vite` 由 Node 原生加载：相对导入带 `.ts` 扩展名（见 `index.ts` 末尾的注释）。
- 中间件放在 Vite 的 `publicDir` 处理之前（`configureServer` 返回的函数是"之后"，直接 `server.middlewares.use` 是"之前"）。
- `transform` 跳过 `node_modules` 里的文件不变：插件自己代码里的 `~` 路径不在这里校验（插件作者在自己仓库里校验），但挂载目录整个拷贝保证运行时存在。

## Comments

**实现（2026-10-20）：**

- **找包不用 `require.resolve('<name>/package.json')`**：很多包的 `exports` 不暴露 `package.json`（`ERR_PACKAGE_PATH_NOT_EXPORTED`）。改成从 root 沿 `node_modules` 向上找 `<dir>/node_modules/<name>/package.json`，`realpathSync` 解析 pnpm 的符号链接（workspace 包也能找到），挂载目录是真实路径，watcher 稳定。
- **路径解析的通用化**：`transform` 里原来写死 `assetsRoot` 的三项检查改成 `base` / `wanted` / `shown` 三个变量：游戏资源 `base = assetsRoot`，插件资源 `base = 挂载目录、wanted = rest`，提示里的文件名经 `shown` 加回 `~<pkg>/` 前缀。`tiledMap` 的外部图块集检查也用 `base`，所以插件包里的 Tiled 关卡同样能查。
- **资源 URL 前缀**跟着 `assetsDir` 走：`assetsRoot` 在 `publicDir` 里时用相对路径（默认 `/assets`），否则退回 `/assets`。
- **构建拷贝跟随 `copyPublicDir`**：`saplingWechat` 把 `publicDir` 和 `copyPublicDir` 都关了，所以小游戏构建里 `sapling()` 不拷，由 02 负责；浏览器构建 `cpSync(recursive)` 整个挂载目录，跳过 `.DS_Store`。
- 中间件对不存在的文件和没挂载的包都 `next()`，交给 Vite：测试里只断言不是 `image/png`（Vite 对 `.png` 的 404 形态不是我们定的）。
- 导出了 `discoverAssetMounts` / `parseMountPath` / `MOUNT_PREFIX`，02 直接用。
