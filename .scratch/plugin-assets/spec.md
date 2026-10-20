# Spec: 插件资源（`~<包名>/` 挂载）与屏幕控件外迁

Status: ready-for-agent
Date: 2026-10-20
ADR: docs/adr/0011-plugin-assets.md（机制）、docs/adr/0010-plugins.md（插件）

让 npm 包形式的插件能带静态资源（贴图、音效、字体、JSON），游戏零配置可用；运行时引擎不改，差异全部收在 `sapling2d/vite`。用"把屏幕控件搬成带默认皮肤的独立包 `sapling2d-touch`"验证。

## 目标

- 插件代码里写 `tex('~@foo/joystick/knob.png')`，浏览器开发 / 构建、小游戏构建、无头测试三端都能用，`sapling()` 的构建期检查对它同样有效（缺文件报错、给最相近的文件名）。
- `tex()` / `Texture` / `Platform` / `WechatAssetPaths` 零改动；`Input` 零改动。
- 插件安装时可以预加载自己的资源，切场景不卸载。
- 屏幕控件搬出 `sapling2d` 主入口后，所有示例、模板、hero-guard、文档跟上，`pnpm check` 绿。

## 接口

### 路径

```
~<包名>/<包内资源目录下的相对路径>
~@foo/joystick/knob.png      ~foo-sfx/click.mp3      ~sapling2d/boot/logo.png
```

- 包名是完整 npm 名（含 scope）。`tex` / `sfx` / `music` / `sheet` / `atlas` / `aseprite` / `tileset` / `tiledMap` / `loadFont` 都接受。
- 游戏资源目录（`public/assets`）的顶层条目不得以 `~` 开头：`sapling()` 在 `buildStart` 报错。
- `data:` 开头的路径是逃生口：`sapling()` 跳过检查，`saplingWechat` 忽略（不是文件）。

### 插件包的声明

```json
{ "name": "@foo/joystick", "sapling2d": { "assets": "assets" } }
```

`assets` 是包内目录（相对包根，默认不存在就不挂载）。

### 挂载发现（`sapling2d/vite` 内部，`sapling()` 和 `saplingWechat()` 共用）

```ts
/** 包名 → 资源目录绝对路径。 */
export function discoverAssetMounts(root: string, extra: string[] = []): Map<string, string>
```

- 读 `<root>/package.json` 的 `dependencies` 和 `devDependencies` 的 key，加上 `extra`；每个包用 `createRequire(root + '/package.json').resolve('<pkg>/package.json')` 找到包根（workspace 链接也能解析），读它的 `sapling2d.assets`；没有这个字段的跳过；目录不存在的警告并跳过。
- 不递归到间接依赖。
- 结果在 `configResolved` 里算一次；dev 下 `package.json` 变化时重算（`watcher.on('change')`）。

### `sapling()`（浏览器）

- `SaplingPluginOptions.assetPackages?: string[]`：追加挂载的包。
- `transform` 校验：路径以 `~` 开头时拆出包名（`~@a/b/rest` 取两段，`~a/rest` 取一段），包没挂载 → 报错 `package "@a/b" is not installed or does not declare "sapling2d.assets" in its package.json`；挂载了就按 `resolve(mountDir, rest)` 做现有的"在目录里 / 存在 / 最相近"检查。`dependents` 照常登记，资源增删触发重检。
- dev：`configureServer` 加中间件，`/assets/~<pkg>/<rest>` → `mountDir/<rest>`，按扩展名给 `Content-Type`（png / jpg / webp / gif / json / mp3 / ogg / wav / ttf / otf / woff / woff2），其它 404 交给后面；同时 `watcher.add(mountDir)`。
- `vite build`：`writeBundle` 把每个挂载目录整个拷到 `<outDir>/assets/~<pkg>/`（跳过 `.DS_Store`）。
- 保留前缀校验：`buildStart` 扫 `assetsRoot` 顶层，有以 `~` 开头的条目就 `this.error`。

### `saplingWechat()`（小游戏）

- `planAssets(assetsRoot, isMain, mounts)`：挂载目录里的文件以 `~<pkg>/<rest>` 的形式加入同一个列表，和 `public/assets` 的文件一起按 `isMain` 分主包 / 分包（默认全进分包）。
- `copyAsset` 对 `~` 路径从挂载目录拷到 `<outDir>/assets/~<pkg>/...` 或 `<outDir>/assets-sub/~<pkg>/...`；清单 `main` 里也用 `~` 路径；体积报告算进去。
- `WechatAssetPaths` 不改：`resolve('~@foo/joystick/knob.png')` → `assets/~@foo/joystick/knob.png` 或 `assets-sub/~@foo/joystick/knob.png`。
- 真机核对 `~`、`@` 在小游戏包路径里可读（05）。不可读的预案：构建期把目录名改写成安全形式并在清单里带 `aliases`，`WechatAssetPaths` 查表——不先做。

### 运行时（`sapling2d`）

```ts
interface PluginContext {
  …
  /** 登记插件自己的资源：和入口场景的资源一起在启动时加载，切场景不卸载。 */
  preload(assets: AssetMap): void
}
```

- `Game.create`：收集所有插件 `preload` 的资源，在 `prepareAssets` 之后和 `options.main.assets` 合并成一次 `loadAssets`（进度合并，启动页看到的是一条进度）。
- `SceneTree` 新增钉住集合（`_pinned: Set<资源>`，由 `assetResources` 归结到整张图）；`_unloadUnused` 跳过钉住的。
- `createTestGame`：`readNodeFile` 遇到 `~<pkg>/<rest>` 时解析到 `node_modules/<pkg>/<sapling2d.assets>/<rest>`（用 `createRequire(cwd + '/package.json')`）；图片不读（宽高 0）。
- `tex('data:…')`：`Texture.path` 原样；浏览器 `img.src = data:` 直接可用；小游戏 `wx.createImage().src` 真机验证（05）。

### `sapling2d-touch`（`packages/touch`）

- 从 `sapling2d` 搬出 `TouchScreenButton`、`TouchJoystick`（代码不变，只换 import）；主入口不再导出它们。
- `package.json`：`"sapling2d": { "assets": "assets" }`，`assets/` 里是默认皮肤：`joystick-base.png`、`joystick-knob.png`、`button.png`（圆形、灰白带透明度、各 ≤ 10 KB，由 `scripts/gen-assets.mjs` 生成）。
- 导出 `TOUCH_SKIN = { base: tex('~sapling2d-touch/joystick-base.png'), knob: tex('~sapling2d-touch/joystick-knob.png'), button: tex('~sapling2d-touch/button.png') }`。
- `touch()` 插件：`install` 里 `ctx.preload(TOUCH_SKIN)`。节点的默认值：`TouchJoystick` 不传 `texture` / `textureKnob` 时用 `TOUCH_SKIN`（显式传 `null` 才是不显示）；`TouchScreenButton` 不传 `texture` 时用 `TOUCH_SKIN.button`。没装 `touch()` 时默认皮肤没加载：节点进树时 `console.warn` 一次并照常工作（只是不显示），提示 `plugins: [touch()]`。
- 依赖 `sapling2d`（`peerDependencies: { "sapling2d": ">=0.4" }` + 仓库内 `workspace:*`）；用 `sapling2d/testing` 测试；tsdown 单入口；发布用 `pnpm publish`。
- 游戏代码：`import { touch, TouchJoystick, TouchScreenButton } from 'sapling2d-touch'`，`plugins: [touch()]`。

## 顺序

每一步 `pnpm check` 绿。

1. 01 `sapling()`：挂载发现、`~` 校验、dev 中间件、浏览器构建拷贝、保留前缀、`data:` 跳过
2. 02 `saplingWechat()`：规划 / 拷贝 / 清单 / 体积（依赖 01 的挂载发现）
3. 03 运行时：`PluginContext.preload`、钉住、`createTestGame` 解析、`data:` 贴图
4. 04 `packages/touch`：搬控件、默认皮肤、`touch()`；示例 / 模板 / hero-guard / 文档跟上；0.4.0
5. 05 真机：小游戏包里 `~@` 路径可读、`data:` 图片可显示；发布 `sapling2d` 0.4.0 和 `sapling2d-touch` 0.1.0

## 不在范围内

按引用只拷用到的文件；间接依赖的挂载；Vite 原生资源导入；目录名改写预案；`sapling2d` 自己带默认启动页美术（机制支持，之后再用）。
