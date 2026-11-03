# 插件

平台各自不同的能力（键盘、传感器、手柄、小游戏的广告 / 分享 / 登录）不在引擎核心里，而是做成**插件**。

## 使用插件

```ts
import { motion, MotionInput, tilt } from 'sapling2d/motion'
startGame({ main, plugins: [motion()], actions: { steerLeft: [key('KeyA'), tilt('left')] } })
this.tree.get(MotionInput).permission   // 插件提供的服务按类取；没装时报错并提示 plugins: [...]
```

- 插件在建树之后、定义动作之前按顺序安装。三个入口都默认装键盘插件 `keyboard()`；`plugins` 里的插件追加在默认的之后。
- **插件在三个平台（浏览器、小游戏、无头）上都能装**：不支持的平台装一个 mock，控制台 info 一次，游戏照常跑。浏览器里开发、Node 里测试，永远不会因为少了传感器或广告而报错。
- 测试里用 `g.inject(event)` 注入插件的事件。

| 插件 | 来自 | 用途 |
|---|---|---|
| `keyboard()` | `sapling2d`（内置，默认安装） | 键盘，`key('Space')` 绑定 |
| `motion()` | `sapling2d/motion` | [倾斜](/features/motion) |
| `touch()` | `@sapling2d/touch` | [屏幕按钮和摇杆](/features/touch) |
| `ui()` | `@sapling2d/ui` | [界面控件](/features/ui) |
| `ads()` | `@sapling2d/ads` | [小游戏广告](/platforms/ads) |
| `spine()` | `@sapling2d/spine` | [Spine 骨骼动画](/features/spine) |

::: tip 忘了装插件
定义动作时出现 `binding type "tilt" has no input source` 的警告，或 `tree.get(X)` 报 `X is not installed`，都是 `plugins: [...]` 里少了对应的插件。
:::

## 写一个插件

实现 `Plugin` 接口的 `install(ctx)`，它返回一个卸载函数（`game.destroy()` 时调用）。`ctx` 提供：

| 成员 | 用途 |
|---|---|
| `ctx.tree` | 场景树 |
| `ctx.platform.kind` | `browser` / `wechat` / `headless`，按平台选实现 |
| `ctx.provide(Token, service)` | 提供服务，游戏用 `tree.get(Token)` 取 |
| `ctx.preload(assets)` | 插件自己的贴图 / 音效，和入口场景的资源一起加载，切场景不卸载 |
| `ctx.autoload(cls)` | 注册跨场景存活的节点 |

向 `window` / `wx` 注册监听是插件自己的事，引擎核心不碰。

### 插件包里的资源

资源用 `tex('~<包名>/<路径>')` 引用。包的 `package.json` 声明资源目录，构建工具负责校验、serve、拷进产物（浏览器和小游戏都是）：

```json
{ "sapling2d": { "assets": "<目录>" } }
```

### 输入类插件：InputSource

`InputSource` 是 `Input` 唯一的扩展点。用 `tree.input.addSource(...)` 登记：

| 成员 | 作用 |
|---|---|
| `eventTypes` | 订阅的事件类型；自己的事件用 `tree.input.enqueue` 入队，和指针事件同一个队列、帧首按序处理 |
| `bindingTypes` | 认领的绑定类型（定义动作时没人认领就警告） |
| `handle(event)` | 处理事件 |
| `strength(action, bindings)` | 给动作的力度 0–1，所有来源取最大 |
| `beginFrame()` | 轮询型设备每帧读一次 |
| `releaseAll(queue)` | 切后台时把按着的东西排队成松开 |

事件和绑定的类型用声明合并登记（都要有 `type` 字段）：

```ts
declare module 'sapling2d' {
  interface InputEventRegistry { motion: … }
  interface InputBindingRegistry { tilt: … }
}
```

屏幕按钮和摇杆（`@sapling2d/touch`）就是用这套公开能力写的，可以照着看。

### 自带节点和资源格式的插件

`@sapling2d/spine` 是这类插件的例子。

- **渲染**：节点自持数据，渲染用 `sapling2d/render` 的 `registerNodeContent(NodeClass, (node, ctx) => content)` 登记。`content.display` 是挂在节点容器下的 Pixi 显示对象，每帧调用 `sync(node, ctx, changed)`；`ctx.textures.get(handle)` 把贴图句柄换成 Pixi 贴图。同步逻辑的测试用 `PixiRenderer._createForSyncTests()`。
- **资源**：实现 `Resource` 协议（`kind`、`path`、`isLoaded`、`_load(platform)`、`_unload()`、`_textures()`），就能放进 `static assets` / `ctx.preload`，引擎负责加载、去重、切场景卸载。
- **构建期检查**：包的 `package.json` 声明 `"sapling2d": { "assetFunctions": ["spineSkeleton"] }`，`sapling()` 会在构建时检查这些函数的字面量路径是否存在。
