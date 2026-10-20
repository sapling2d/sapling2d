# 0011 — 插件资源：按包名挂载到 `~<包名>/`，差异收在构建工具里

**Status:** Accepted (2026-10-20)

## Context

ADR 0010 之后，平台差异化的能力以插件（npm 包）提供。一个像 `TouchJoystick` 这样的外部插件要带默认贴图，现在做不到：

- `tex(path)` 的路径相对游戏的 `public/assets/`，插件不知道游戏把东西叫什么，游戏也不知道插件要什么。
- 字节在 `node_modules/<pkg>/` 里：浏览器开发服务器不 serve、`vite build` 不发射；小游戏必须是包里的文件，`saplingWechat` 只拷 `public/assets`。
- `sapling()` 在构建期检查 `tex()` 字面量是否存在于资源目录，插件路径会被判成缺失。
- 场景用 `static assets` 预加载；插件的节点在哪一步保证贴图已加载没有定义。

参考：Godot 的 addon 整个进入 `res://addons/<name>/`，资源路径全局、导出自然包含；Unity 的包资源按 `Packages/<name>/...` 引用、构建按引用包含。两者的共同点是**包有自己的资源根，路径里带包名**。

## Decision

### 路径形态

插件资源的路径是 `~<包名>/<包内资源目录下的相对路径>`，包名是完整的 npm 名（含 scope）：`tex('~@foo/joystick/knob.png')`、`sfx('~foo-sfx/click.mp3')`。

`~` 的理由：webpack / Sass 里 `~` 就是 node_modules；URL 里是 unreserved 字符，文件名里在 macOS / Linux / Windows 都合法；游戏自己的资源目录不会有以 `~` 开头的顶层条目——构建期把这当作保留前缀校验，撞不了名。运行时**完全不改**：对 `tex()`、`Texture` 去重、`Platform.loadImage`、`WechatAssetPaths.resolve` 来说它就是一条普通路径，只要构建产物里 `assets/~@foo/joystick/knob.png` 这个文件存在。

### 挂载：按 `package.json` 字段

插件包在自己的 `package.json` 里声明 `"sapling2d": { "assets": "assets" }`（包内目录）。游戏 `package.json` 的 `dependencies` / `devDependencies` 里声明了这个字段的包被挂载到 `~<包名>/`；间接依赖不挂载；`sapling({ assetPackages: [...] })` 可以追加。不扫描 node_modules。`sapling2d` 自己也可以声明（以后放默认启动页美术之类）。

### 构建工具承担全部差异

- `sapling()`：`~` 路径对照挂载目录做存在性检查和"最相近文件"提示（和游戏资源一样）；开发服务器用中间件从 node_modules serve `assets/~<pkg>/...`；`vite build` 把每个挂载目录整个拷到 `dist/assets/~<pkg>/`。
- `saplingWechat()`：挂载目录和 `public/assets` 一起规划、拷贝、写进清单、算进包体积；`mainAssets` 的 glob 作用在同一种路径形态上（`'~@foo/loading/**'`），默认全部进分包。

挂载 = 整个目录进包（装了就用）。插件作者要把资源目录保持小，大资源拆成独立的包。

### 加载时机

`PluginContext.preload(assets)`：插件安装时登记的资源和入口场景的资源一起加载（在 `prepareAssets` 之后，分包里的也行，进度合并），并且**钉住**：切场景时不卸载，哪怕某个场景也列了同一张图又切走了。游戏也可以把插件导出的句柄写进自己的 `static assets`。

### 两条约定

- 插件节点**永远**接受游戏传入的贴图（`TouchJoystick({ texture, textureKnob })` 这种），默认皮肤只是默认值。
- 逃生口：`tex('data:image/png;base64,…')` 允许，`sapling()` 不检查，只适合几 KB 的图标（进 `game.js`、算主包、无 JIT 的 iOS 解析更慢），小游戏上要真机验证。

### 验证载体

把屏幕控件搬成独立的 workspace 包 `packages/touch`（npm 名 `sapling2d-touch`）：带默认的底座 / 摇杆头 / 按钮贴图，`touch()` 插件 `preload` 它们，游戏一行不配置也能显示摇杆；浏览器、小游戏、无头测试三端通过。这同时回答了"TouchJoystick 该不该在引擎里"：有了资源机制，它就是一个普通插件。

### 不做

Vite 原生的 `import url from 'pkg/x.png'`（会出现第二种路径形态：hash 过的 URL 检查不了、小游戏构建要维护映射表）；按引用只拷用到的文件（node_modules 里的代码不经过 `transform`，看不全）；扫描 node_modules 自动发现。

## Consequences

- 外部插件能带默认美术，游戏零配置可用；路径形态仍然只有一种，引擎运行时零改动。
- `sapling2d/vite` 变厚：挂载发现、中间件、两处拷贝。这是有意的——差异在构建工具里，不在核心（和 ADR 0010 同一种精神）。
- 小游戏包里会出现 `assets/~@foo/joystick/` 这样的目录；`~`、`@` 在小游戏文件路径里是否可读要真机核对，不行就在构建期改写目录名并在清单里带映射（预案，不先做）。
- `createTestGame` 读 `~pkg/x.json` 这类文本资源时要解析到 node_modules；图片在无头下本来不读。
- 屏幕控件搬出主入口是破坏性变化（0.4.0）：`import { TouchJoystick } from 'sapling2d-touch'`。

## Alternatives

- **只允许游戏提供贴图**：零改动，但插件没法开箱即用；作为约定保留，不作为唯一答案。
- **base64 内嵌**：零构建集成，但体积、主包预算和解析时间都不利；作为逃生口保留。
- **Vite 原生资源导入**：最"Web"，但和现有"相对资源目录的字面量路径 + 构建期检查 + 小游戏分包"模型冲突。
- **按模块图挂载被 import 的包**：dev 下预打包的依赖不经过插件钩子，判定不可靠；按 `package.json` 字段更直白。
