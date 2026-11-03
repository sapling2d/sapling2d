# 快速开始

::: warning 早期版本
sapling2d 还在 1.0 之前，API 可能会变。
:::

## 安装

```sh
npm install sapling2d
npm install -D vite vitest typescript
```

需要 Node.js 20.19 或更高版本。

## 第一个场景

游戏对象都继承节点类，覆写生命周期方法；`Scene` 是场景树的根，在 `ready()` 里用 `this.add()` 搭建子节点。

<<< ../../packages/engine/docs/examples/quickstart.test.ts#example

在浏览器里启动：

```ts
// src/main.ts
import { startGame } from 'sapling2d/browser'
import { Main } from './game'

await startGame({ main: Main })
```

```html
<!-- index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { sapling } from 'sapling2d/vite'

// sapling()：构建时检查 tex() / sfx() / music() 引用的资源文件是否存在
export default defineConfig({ plugins: [sapling()] })
```

运行 `npx vite`，打开页面就能看到画面。默认的设计分辨率是 750×1334（竖屏）。

## 写一个测试

不开浏览器也能运行游戏：`createTestGame` 在 Node 里无头运行场景树，按帧推进，结果是确定的。

<<< ../../packages/engine/docs/examples/quickstart.test.ts#test

`g.dump()` 把场景树打印成文本，每行是 `名字 (类名) 属性=值`。断言失败时先看它，比猜原因快。详见 [无头测试](./testing)。

## 用模板起项目

仓库里的 [`templates/game`](https://github.com/sapling2d/sapling2d/tree/main/templates/game) 是一个完整的游戏骨架：

```
src/game.ts          游戏本身（和平台无关）：场景、节点、gameOptions
src/main.ts          浏览器入口
src/main.wechat.ts   微信小游戏入口
test/                无头测试
public/assets/       贴图、声音、字体：tex('ball.png') 就是 public/assets/ball.png
AGENTS.md            给编程 agent 的说明
```

复制这个目录后，把 `package.json` 里 `sapling2d` 的版本从 `workspace:*` 改成 npm 上的版本。常用命令：

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 浏览器里开发 |
| `pnpm check` | 类型检查 + 测试（Vitest 不做类型检查，两个都要过） |
| `pnpm dev:wechat` | 构建微信小游戏到 `dist-wechat/`，监听改动 |
| `pnpm build:wechat` | 小游戏的发布构建（真机预览和上传用这个） |

开发时在浏览器控制台里运行 `sapling.tree.dump()`，可以看到实时的场景树。

## 下一步

- [核心概念](./concepts)：节点树、生命周期、每帧的执行顺序
- [功能](/features/sprite-label)：贴图、信号、输入、物理、相机……
- [微信小游戏](/platforms/wechat)：同一份代码发布成小游戏
