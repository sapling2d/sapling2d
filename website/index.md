---
layout: home

hero:
  name: sapling2d
  text: 用代码写 2D 游戏
  tagline: Godot 风格的节点树，PixiJS 渲染，Box2D 物理。浏览器里开发，同一份代码发布成微信小游戏；场景树能在 Node 里逐帧跑测试。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 核心概念
      link: /guide/concepts
    - theme: alt
      text: GitHub
      link: https://github.com/sapling2d/sapling2d

features:
  - title: Godot 风格的节点树
    details: Node、Scene、生命周期、类型化的信号、Groups、Autoload、Timer、Tween。继承节点类写游戏对象，没有编辑器，也没有场景文件。
  - title: 一份代码，两个平台
    details: 浏览器里用 Vite 开发；saplingWechat() 构建成微信小游戏，自动分主包和资源分包，超出 4 MB / 30 MB 限制时构建失败。
  - title: 确定性的无头测试
    details: sapling2d/testing 在 Vitest 里逐帧推进游戏、模拟点击和按键，把场景树打印成文本。同一个 seed，同样的结果。
  - title: 对 agent 友好
    details: 全部是普通的 TypeScript。llms.txt 把整个 API、能跑的示例和常见陷阱放在一个文件里，给编程 agent 直接读。
---

## 30 秒看懂

```ts
import { Node2D, Scene, v } from 'sapling2d'
import { startGame } from 'sapling2d/browser'

class Mover extends Node2D {
  speed = 120 // 像素/秒
  override process(dt: number) {
    this.x += this.speed * dt
  }
}

class Main extends Scene {
  override ready() {
    this.add(new Mover({ position: v(100, 200) }))
  }
}

await startGame({ main: Main })
```

[从安装开始 →](/guide/getting-started)
