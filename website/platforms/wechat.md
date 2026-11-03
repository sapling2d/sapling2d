# 微信小游戏

同一份游戏代码，换一个入口和一个 Vite 配置，就能构建成微信小游戏。

## 入口

游戏本身写在和平台无关的文件里（模板里是 `src/game.ts`），两个入口都很薄：

```ts
// src/main.ts（浏览器）
import { startGame } from 'sapling2d/browser'
import { gameOptions } from './game'
await startGame(gameOptions)
```

```ts
// src/main.wechat.ts（小游戏）
import { startGame } from 'sapling2d/wechat'
import { gameOptions } from './game'
startGame(gameOptions)
```

## 构建

单独写一个 Vite 配置：

```ts
// vite.wechat.config.ts
import { defineConfig } from 'vite'
import { sapling, saplingWechat } from 'sapling2d/vite'

export default defineConfig({
  plugins: [sapling(), saplingWechat({ entry: 'src/main.wechat.ts' })],
})
```

| 命令 | 构建类型 | 用途 |
|---|---|---|
| `vite build -c vite.wechat.config.ts --watch` | 开发构建：内联 sourcemap，超过 4 MB | 只能在开发者工具的模拟器里跑 |
| `vite build -c vite.wechat.config.ts` | 发布构建：压缩、无 sourcemap | 真机预览和上传 |

用微信开发者工具打开 `dist-wechat/` 目录，它会在文件变化时自动重新编译。`saplingWechat({ release: true })` 可以强制指定构建类型。

环境变量 `WX_APPID` 设为你的 AppID。小游戏不接受 `touristappid`，可以用测试号。

## 资源与分包

资源放在 `public/assets/`，`tex('a.png')` 在浏览器和小游戏里路径相同。

- `public/assets/boot/` 放进**主包**；其余资源放进一个**分包**，在启动页显示之后下载（下载进度算进 `tree.assets.progress`，失败时重试 2 次）。
- **启动页（`loading`）用到的资源必须放在 `boot/`**，否则启动时报错。
- 主包上限 4 MB（含 `game.js`），所有包合计 30 MB。构建时打印各包大小，超过 80% 时警告，发布构建超限时失败。
- `saplingWechat({ mainAssets })` 可以改分包规则（glob 或函数）。

## 在终端里看真机日志

1. 运行日志服务：`pnpm log-server`（模板里有）。
2. 构建时设 `SAPLING_LOG_URL=http://<局域网 IP>:7777/log`。
3. 手机上打开小游戏的「开发调试」。

之后 `console` 输出和未捕获的错误都会转发到终端；`sapling2d/wechat` 的 `snapshot('label')` 把手机屏幕截图存到 `logs/`。

## 和浏览器的差异

- 只用 WebGL1。
- 没有键盘事件（键盘插件装着，但不会触发）；触摸是多点的。
- `loadFont(path)`（从 `sapling2d/wechat` 导入）加载包里的字体。
- **开发者工具的模拟器和真机差异很大**（全局对象、计时器单位、WebGL 行为），以真机为准。

## iOS 上的性能

iOS 小游戏基本没有 JIT，**分配内存（对象、数组、闭包、迭代器）特别贵**；读写普通字段、getter、`Map.get` 并不慢。每帧处理几百个对象的代码这样写：

- 移动用 `node.x += …`，不分配对象；`node.position = node.position.add(…)` 每次分配两个 `Vector2`。
- 碰撞判定先把位置读进预先分配的数组，内层循环只做算术。
- 热循环里用下标循环，少用 `for…of`、`map` / `filter`、箭头函数和展开运算符。
- 同时活跃的刚体控制在 60–80 个以内；子弹这类大量对象用 `HitTester`。
- 每帧都跑的类不要用 `#private` 字段：构建目标是 ES2017，`#x` 会变成 WeakMap 查找，在 iOS 上慢 2–3 倍。用 TypeScript 的 `private _x`。
- 发布构建会压缩类名：逻辑里不要依赖默认的节点名或 `constructor.name`，按名字找节点就显式传 `name`，判断类型用 `instanceof`。
