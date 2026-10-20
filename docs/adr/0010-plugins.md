# 0010 — 插件机制：Input 只保留跨平台核心，平台差异由插件承担

**Status:** Accepted (2026-10-20)

## Context

`Input` 现在是一个门面（队列 + 键盘状态，委托给 `ActionMap`、`PointerRouter`、`VirtualControls`），还不臃肿，但有六处"每加一种设备就要改核心"的硬编码：

- `RawInputEvent` 和 `InputBinding` 都是封闭联合（指针 | 键盘），`_flush` 用 `'code' in e` 区分。
- `_strength()` 写死了键盘、指针、屏幕按钮、摇杆四种来源；`_releaseAll()` 写死键盘和指针。
- 原始状态 getter（`isKeyPressed`、`pointerPosition`…）：加手柄就会长出 `getGamepadAxis`，加传感器就长出 `accelerometer`。
- `Platform.onInput` 是单一事件流，类型绑在封闭联合上。
- `core/input/VirtualControls.ts` 通过 `VirtualButton` / `VirtualStick` 接口认识节点的私有成员（`_pointerIds`、`_setPressed`、`_accepts`），`PointerRouter._pick` 为它开了分支，`Input` 上有四个 `_addButton` / `_addStick`：核心反向依赖 `nodes/`。

接下来要做的能力都是平台差异化的：加速度计 / 陀螺仪（赛车、平衡类，浏览器和小游戏都有，但权限和省电生命周期完全不同）、手柄（只有浏览器有）、小游戏的广告 / 分享 / 登录（只有小游戏有）。按现在的结构，每一项都会同时撑大 `Input` 和 `Platform`。

参考：Godot 的 `Input` 单例把传感器、震动、鼠标模式全挂在一起，是膨胀的反例；但它的 `InputEvent` 开放类型 + `InputMap` + `parse_input_event()` 是对的。Unity 新 Input System 把设备和动作分成两层，动作层只认 Button / Axis 控件，设备运行时注册，传感器要显式启用，屏幕控件伪装成虚拟手柄；整套是独立 package——它本身就是旧 `Input.acceleration` / `Input.gyro` 膨胀后的重写。Phaser 把 keyboard / gamepad 做成按配置开关的子插件。

## Decision

### 通用插件机制

```ts
interface Plugin {
  /** Game.create 时按 plugins 顺序各调用一次（在加入口场景和定义动作之前）。返回卸载函数。 */
  install(ctx: PluginContext): (() => void) | void
}
interface PluginContext {
  readonly tree: SceneTree      // tree.input.addSource(...)、tree.focusChanged
  readonly platform: Platform   // platform.kind
  /** 提供一个服务，游戏用 tree.get(Token) 取。同一个 token 提供两次报错。 */
  provide<T>(token: ServiceToken<T>, service: T): void
}
startGame({ main, plugins: [motion(), ads()] })
this.tree.get(MotionInput).acceleration        // 没装时报错并提示 plugins: [motion()]
```

安装口是通用的，不是输入专用：小游戏广告 / 分享 / 登录以后走同一条路。服务按类 token 查找，不用声明合并往 `SceneTree` 上挂属性（类型永远存在、没装时是 undefined，排错困难）。

### 三条硬规则

1. **`Input` 不再增长。** 它只管：事件队列与帧首统一处理的时序、`ActionMap`、指针路由。此后不再增加任何公开成员和事件类型，新设备一律通过 `InputSource` 接入。
2. **平台只产核心事件。** `Platform.onInput` 的类型收窄为指针事件；`Platform` 新增 `kind: 'browser' | 'wechat' | 'headless'`。插件自己向 `window` / `wx` 注册监听，差异在插件内部处理。这不只是为了瘦身：iOS 的 `DeviceMotionEvent.requestPermission()` 必须在原生手势回调的调用栈里同步调用，而引擎队列推迟到帧首处理，只有插件自己挂监听才做得到。
3. **插件必须在三个 kind 上都能安装。** 不支持的平台装 mock，`console.info` 一次，不抛错——浏览器里 `ads()` 弹一个假奖励框、`share()` 直接 resolve；headless 的 mock 就是测试用的假实现（事件靠 `g.inject` 注入、结果可断言）。游戏在浏览器里开发、在 Node 里测试时永远跑得起来。

### Input 的唯一扩展点：`InputSource`

```ts
interface InputSource {
  /** 认领的绑定类型。addAction 时没有来源认领的绑定给出警告（"安装 motion()"）。 */
  readonly bindingTypes?: readonly string[]
  /** 订阅的事件类型（自己的事件，也可以是核心指针事件——手势插件用）。按类型路由，不广播。 */
  readonly eventTypes?: readonly string[]
  /** 订阅的事件按队列顺序到达；核心指针事件先给 PointerRouter，再给订阅它的来源（只读观察）。 */
  handle?(event: RawInputEvent): void
  /** 帧首、动作更新前：轮询型设备（Web Gamepad）在这里取状态。 */
  beginFrame?(): void
  /** 给动作的力度 0–1。既容纳按绑定驱动的来源（key、tilt），也容纳按动作名驱动的（TouchScreenButton.action）。 */
  strength?(action: string, bindings: readonly InputBinding[]): number
}
```

`Input` 公开 `addSource` / `removeSource` / `enqueue`；动作力度是所有来源的最大值（到 1 提前退出，不分配）。事件和绑定的类型用仓库已有的声明合并模式变成开放的：`InputEventRegistry`、`InputBindingRegistry`（和 `ActionRegistry`、`StorageRegistry` 一样）。切后台时插件在 `tree.focusChanged` 里把自己按着的东西排队成松开事件，和核心的 `pointercancel` 一起在下一帧帧首按序处理——确定性和今天完全一样。

### 键盘是默认安装的内置插件

键盘只有浏览器有，按规则 1 不属于核心。但每个游戏都在浏览器里开发、测试靠 `pressKey`，所以它做成**真正的插件、由入口默认安装**：三个入口（`sapling2d/browser`、`sapling2d/wechat`、`createTestGame`）都默认带 `keyboard()`；小游戏里它没有事件源，装它是为了 `key()` 绑定有人认领（真机验证时发现：不装的话每个带键盘绑定的游戏启动都警告）、`tree.get(Keyboard)` 三端可用，代价是 game.js 多 1.4 KB gzip。`plugins` 追加在默认之后。`key()`、`keyboard()`、`Keyboard` 仍从 `sapling2d` 主入口导出，游戏代码不变；`tree.input.isKeyPressed(code)` 变成 `tree.get(Keyboard).isPressed(code)`。

选真插件而不是"Input 内部的一个 source"，是因为它用最简单的设备把 `install`、`kind` 分支、mock、headless 注入、`tree.get`、registry 合并全部跑一遍——机制在第一天就有一个真实消费者。

### 屏幕控件按公开 API 重写，离开核心

`TouchScreenButton` 和 `TouchJoystick` 只用节点拾取的公开能力（`inputPickable`、覆写 `hitTest`、`pointerDown` / `pointerMove` / `pointerUp`、指针捕获）加 `InputSource`（节点自己就是一个来源，进树登记、出树移除）重写。删除 `VirtualControls`、`VirtualButton` / `VirtualStick`、`PointerRouter._pick` 的分支和 `Input._add*/_remove*`。验收标准：这两个节点搬到仓库外一行不改。

核心为此补一个通用能力：**被捕获的节点变得不可命中**（隐藏、暂停、排队销毁、离开树）时，帧首给它发一次 `pointerUp`（不发 `clicked`），这根手指之后的事件忽略到抬起。它取代原来专给控件的 `releaseUnusable`，对任何被拖着的节点都是对的。

砍掉两个只有 `VirtualControls` 才做得到的行为：`passbyPress`（滑入按下）和一个手指同时按下几个重叠按钮。前者要做需要 `pointerEnter` / `pointerExit` 和显式捕获，等有游戏需要再加；后者和节点拾取"最上层赢"的规则一致。

### 第一个外部插件：运动传感器

`sapling2d/motion`：`motion()` 插件、`MotionInput` 服务、`tilt(dir)` 绑定（倾斜角换算成 0–1 力度，和键盘共用动作）。两端都有、有真实的权限 / 省电生命周期，最能检验机制。手柄只有浏览器有，之后再做。

### 不做

去掉默认插件的开关（没有需求）；给 `SceneTree` 挂插件属性；`Platform` 上的可选能力字段（`motion?: MotionBackend`——膨胀只是从 `Input` 挪到 `Platform`，核心仍要认识每种设备）；震动（是输出不是输入，以后另开 `tree.haptics` 或由插件自己提供）。

## Consequences

- `Input` 公开面从 20 个成员减到动作查询 + 指针原始状态 + `addSource` / `removeSource` / `enqueue`；`core/input` 不再认识任何节点类型。
- 新设备的成本 = 一个插件文件；核心、`Platform`、`Game` 零改动。不装的插件不进包。
- 破坏性变化（0.3.0）：`isKeyPressed` 移走；`passbyPress` 删除；`RawInputEvent` 核心只剩指针；`HeadlessPlatform.injectInput` 只收指针事件，插件事件用 `g.inject`；`Platform` 实现必须提供 `kind`。hero-guard 只用动作和指针信号，不受影响。
- 插件事件走同一个队列，headless 测试用 `g.inject({ type: 'motion', … })` 驱动，和 `tap` / `pressKey` 同一条路。
- 每个绑定的强度来源在 `addAction` 时可检查：忘装插件会立刻有提示，而不是动作永远不触发。
- 插件内部允许同时出现 `window` 和 `wx` 分支；"核心代码不碰 `window` / `document` / `wx`"的规则不变，插件不是核心。
- 轮询型设备（Web Gamepad）帧内更短的按下会丢，Unity / Godot 在 Web 上一样；事件型设备没有这个问题。
- ADR 0001 里"引擎自行统一输入流、自管命中测试"的决定不变。

## Alternatives

- **`Platform` 加可选能力字段**（`audio` / `storage` / `prepareAssets?` 的做法）：类型清楚，但每种设备都要同时改 `Platform`、三个实现和 `Input`；`BrowserPlatform` 会 import 所有浏览器后端。拒绝。
- **每平台一个插件入口**（`sapling2d/motion/browser`、`/wechat`）：最纯，但游戏要在两个 main 里各 import 对的那个，装错是运行时错误；和"浏览器里永远跑得起来"的 mock 规则也不协调。
- **插件用声明合并给 `SceneTree` / `Input` 挂属性**（Phaser 风格 `tree.motion`）：顺手，但类型和运行时脱节。
- **键盘留作 `Input` 内部的 source**：少一个概念，但机制没有真实消费者，规则 1 还要留例外。
- **`VirtualControls` 留在核心**：改动最小，但核心继续认识节点私有成员，`PointerRouter` 继续有专用分支——正是这次要去掉的东西。
