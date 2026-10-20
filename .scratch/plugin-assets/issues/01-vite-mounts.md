# 01 — `sapling()`：按 `package.json` 字段挂载插件资源，`~<包名>/` 路径的校验、serve 和拷贝

**What to build:** `sapling2d/vite` 里的挂载发现和浏览器端的全部支持。规格见 `../spec.md`"挂载发现"和"`sapling()`"两节。

- `discoverAssetMounts(root, extra)`（`src/vite/mounts.ts`，`sapling()` 和 02 的 `saplingWechat()` 共用）：读游戏 `package.json` 的 `dependencies` / `devDependencies` + `extra`，`createRequire` 解析每个包的 `package.json`，取 `sapling2d.assets`；目录不存在时 `console.warn` 并跳过。附带 `parseMountPath(path)` → `{ pkg, rest } | null`（`~@a/b/x` 取两段，`~a/x` 取一段，不以 `~` 开头返回 null）。
- `SaplingPluginOptions.assetPackages?: string[]`。
- `transform`：`~` 路径对照挂载目录做现有的三项检查（在目录里 / 存在 / 最相近文件名）；包没挂载时的报错要说清楚两种可能（没装、没声明字段）。`data:` 路径跳过。
- `configureServer`：中间件 serve `/assets/~<pkg>/<rest>`；`watcher.add(mountDir)`；`package.json` 变化时重算挂载并 full-reload。
- `writeBundle`：挂载目录整个拷到 `<outDir>/assets/~<pkg>/`。
- `buildStart`：`assetsRoot` 顶层有以 `~` 开头的条目 → 报错（保留前缀）。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `test/vite-plugin.test.ts`：临时目录里造一个 `node_modules/@foo/joystick/{package.json,assets/knob.png}`（`package.json` 带 `sapling2d.assets`）和游戏 `package.json`（`dependencies: { "@foo/joystick": "*" }`）；`tex('~@foo/joystick/knob.png')` 构建成功，`dist/assets/~@foo/joystick/knob.png` 存在
- [ ] 缺文件：`tex('~@foo/joystick/knb.png')` 报错并提示 `knob.png`
- [ ] 没挂载的包：`tex('~@bar/x/a.png')` 的报错同时提到"没安装"和"没声明 sapling2d.assets"
- [ ] 包在 `dependencies` 里但没有字段 → 不挂载；只在 `assetPackages` 里 → 挂载；无 scope 包名 `~foo-sfx/click.mp3` 正确拆分
- [ ] `public/assets/~x/` 存在时 `buildStart` 报错
- [ ] `tex('data:image/png;base64,AAAA')` 不报错
- [ ] dev 中间件：用 `createServer()` 起开发服务器，`GET /assets/~@foo/joystick/knob.png` 返回 200 和 `image/png`；`GET /assets/~@foo/joystick/nope.png` 404
- [ ] 现有 10 个用例不变
- [ ] `pnpm check` 绿

**实现提示**

- `sapling2d/vite` 由 Node 原生加载：相对导入带 `.ts` 扩展名（见 `index.ts` 末尾的注释）。
- `createRequire(join(root, 'package.json'))` 能解析 pnpm 的符号链接和 workspace 包；解析失败（没装）要捕获。
- 中间件放在 Vite 的 `publicDir` 处理之前（`configureServer` 返回的函数是"之后"，直接 `server.middlewares.use` 是"之前"）。
- `transform` 跳过 `node_modules` 里的文件不变：插件自己代码里的 `~` 路径不在这里校验（插件作者在自己仓库里校验），但挂载目录整个拷贝保证运行时存在。
