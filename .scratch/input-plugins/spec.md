# Spec: 插件机制与 Input 收缩

Status: ready-for-agent
Date: 2026-10-20
ADR: docs/adr/0010-plugins.md

把 `Input` 收缩到跨平台核心（队列时序、动作、指针路由），用一个通用的插件机制承载平台差异化能力。键盘变成默认安装的内置插件，屏幕控件按公开 API 重写并离开核心，第一个外部插件是运动传感器（倾斜）。允许破坏性变化，发 0.3.0。

## 目标

- `Input` 公开面只剩：动作（`addAction` / `removeAction` / `hasAction` / `isActionPressed` / `isActionJustPressed` / `isActionJustReleased` / `getActionStrength` / `getAxis` / `getVector`）、指针原始状态（`pointerPosition` / `isPointerPressed` / `isPointerJustPressed` / `isPointerJustReleased` / `pressedPointers`）、扩展点（`addSource` / `removeSource` / `enqueue`）。
- `core/input/` 不 import 任何 `nodes/` 的类型；`Platform.onInput` 只产指针事件。
- 新设备的成本是一个插件文件：核心、`Platform`、`Game` 零改动。
- 确定性不变：所有事件（含插件事件）同一个队列、帧首按序处理；`isActionJustPressed` 的渲染帧 / 物理步语义不变。
- 每帧热路径不分配（iOS 无 JIT）。

## 接口

### 插件

```ts
// sapling2d
export interface Plugin {
  install(ctx: PluginContext): (() => void) | void
}
export interface PluginContext {
  readonly tree: SceneTree
  readonly platform: Platform
  provide<T>(token: ServiceToken<T>, service: T): void
}
export type ServiceToken<T> = abstract new (...args: never[]) => T

// GameOptions
plugins?: Plugin[]

// SceneTree
get<T>(token: ServiceToken<T>): T   // 没提供：throw `${token.name} is not installed. Pass its plugin in the game options: plugins: [...]`
```

- `Game.create`：建树 → 按顺序 `install` 每个插件 → 按 `options.actions` 加动作 → 注册 Autoload → 之后不变。卸载函数在 `game.destroy()` 里按相反顺序调用。
- `provide` 同一个 token 两次 → throw。
- 默认插件由入口决定：`sapling2d/browser` 的 `startGame` 和 `sapling2d/testing` 的 `createTestGame` 传 `plugins: [keyboard(), ...(options.plugins ?? [])]`；`sapling2d/wechat` 原样传；`Game.create` 自己没有默认。
- 不做"去掉默认插件"的开关。

### Platform

```ts
readonly kind: 'browser' | 'wechat' | 'headless'
onInput(callback: (event: RawPointerEvent) => void): () => void   // 只有指针
```

`BrowserPlatform.onInput` 里的键盘监听（含失焦补发 keyup）搬进键盘插件。

### Input 扩展点

```ts
export interface InputSource {
  readonly bindingTypes?: readonly string[]
  readonly eventTypes?: readonly string[]
  handle?(event: RawInputEvent): void
  beginFrame?(): void
  strength?(action: string, bindings: readonly InputBinding[]): number
  releaseAll?(queue: RawInputEvent[]): void   // 切后台：把按着的东西 push 成松开事件（queue 里没处理的按下也算）
}
input.addSource(source): void
input.removeSource(source): void
input.enqueue(event: RawInputEvent): void   // 原 _enqueue 公开；Game 和 g.inject 都用它

// 开放类型。注册表声明在 src/index.ts（和 ActionRegistry 一样）；内置的键盘插件直接登记在表里，外部插件用 declare module 'sapling2d' 合并
export interface InputEventRegistry { pointer: RawPointerEvent; key: RawKeyEvent }
export type RawInputEvent = InputEventRegistry[keyof InputEventRegistry]      // core/input/events.ts
export interface InputBindingRegistry { pointer: PointerBinding; key: KeyBinding }
export type InputBinding = InputBindingRegistry[keyof InputBindingRegistry]   // core/input/bindings.ts
```

`_flush` 的顺序：

1. `actions.beginFrame()`、`pointer.beginFrame()`
2. `pointer.cancelUnhittable()`：被捕获的节点变得不可命中（`!canHit` / 离开树 / 已销毁）→ 给它发 `pointerUp`（不发 `clicked`），删掉这根指针的记录（之后它的事件忽略到抬起）。取代 `VirtualControls.releaseUnusable`。
3. 每个来源 `beginFrame?.()`
4. `actions.update()`
5. 逐个处理队列：指针事件先给 `PointerRouter`，再给订阅了该类型的来源；其它事件给订阅了该类型的来源（`Map<type, InputSource[]>` 路由，不广播）；每个事件之后 `actions.update()`。

力度：`max` 遍历所有来源的 `strength`，到 1 提前退出。`addAction` 时，绑定的 `type` 没有任何来源的 `bindingTypes` 认领 → `console.warn`（"binding type 'tilt' has no input source; install its plugin (plugins: [...])"），和 TouchScreenButton 未知动作的警告一致。

来源和切后台：`Input._releaseAll` 先让 `PointerRouter` 排队指针取消，再调每个来源的 `releaseAll(queue)`，来源把自己按着的东西 push 成松开事件（队列里还没处理的按下也要算：它们的松开在后台收不到）。全部在下一帧帧首按序处理。传感器的 start / stop 这类生命周期仍用 `tree.focusChanged`。

### 键盘插件（内置，`src/plugins/keyboard.ts`，从 `sapling2d` 导出）

```ts
export function keyboard(): Plugin
export function key(code: string): InputBinding          // { type: 'key', code }
export class Keyboard { isPressed(code: string): boolean } // tree.get(Keyboard)
export type RawKeyEvent = { type: 'keydown' | 'keyup'; code: string }
export type KeyBinding = { readonly type: 'key'; readonly code: string }   // 两者直接登记在 index.ts 的注册表里
```

- `install`：`provide(Keyboard, kb)`、`tree.input.addSource(kb)`（`bindingTypes: ['key']`、`eventTypes: ['keydown', 'keyup']`、`releaseAll`）。
- `kind === 'browser'`：`window` 上监听 `keydown` / `keyup`（忽略 `repeat`）→ `enqueue`；`blur` 时给按着的键补发 keyup。核心的 tsconfig 没有 DOM 库，插件只声明自己用到的几个成员（`WindowLike` / `KeyEventLike`），从 `globalThis.window` 取。
- `kind === 'wechat'` / `'headless'`：无生产者（小游戏没键盘；测试用 `g.inject` / `g.pressKey`）。不打印任何东西——键盘不存在是正常情况。

### 屏幕控件（`nodes/TouchScreenButton.ts`、`nodes/TouchJoystick.ts`，留在 `sapling2d` 主入口）

只用公开 API：`inputPickable = true`、`hitTest` 覆写、`pointerDown` / `pointerMove` / `pointerUp` 信号、自己实现 `InputSource` 并在 `_onEnterTree` / `_onExitTree` 里 `addSource` / `removeSource`。

- `TouchScreenButton`：`pointerDown` → 记下 `pointerId`、第一个手指时 `pressed`；`pointerMove` 时 `!hitTest(local)` → 松开这根手指（之后它滑回来不再按下）；`pointerUp` → 松开。`strength(action)`：`action` 匹配且有手指按着 → 1。**删除 `passbyPress`**。一个手指只能按最上层那个按钮。
- `TouchJoystick`：`hitTest(local)`：`fixed` 用 `hitArea`；`dynamic` 在没按着时判断 `region` 是否包含这个点（局部 → 节点坐标系：`globalTransform.apply(local)`；摇杆不旋转、不缩放，文档已写明），按着时返回 false（第二个手指不归它）。`pointerDown` / `pointerMove` / `pointerUp` 驱动 `_press` / `_drag` / `_release`。`strength(action)`：按 `actions.left/right/up/down` 给出分量。
- 隐藏 / 暂停 / 移出树 / 切后台的松开：全部来自核心的 `cancelUnhittable` 和 `pointercancel` → `pointerUp` 信号。节点自己不需要每帧检查。
- 删除：`core/input/VirtualControls.ts`、`VirtualButton` / `VirtualStick`、`PointerRouter` 的 `controls` 参数和 `_pick` 分支、`Input._addButton/_removeButton/_addStick/_removeStick`。
- `passbyPress` 的唯一使用者是 platformer 的左右方向键，改成只配 `left` / `right` 的 `fixed` 摇杆（见工单 02）。
- 验收：`grep -r 'nodes/' packages/engine/src/core/input` 为空；两个节点文件只 import `core/` 的公开类型。

### 运动传感器插件（`sapling2d/motion`，`src/plugins/motion/`）

```ts
export function motion(options?: { smoothing?: number }): Plugin   // smoothing 默认 0.2（指数平滑系数，0 = 不平滑）
export class MotionInput {
  readonly x: number; readonly y: number; readonly z: number   // 含重力的加速度，单位 g，设备坐标：屏幕向右 +x、向上 +y、朝外 +z；平滑后
  readonly available: boolean       // 这个平台有没有传感器（headless 为 true）
  readonly permission: 'granted' | 'denied' | 'prompt' | 'unsupported'
}
export function tilt(dir: 'left' | 'right' | 'forward' | 'back', opts?: { deadzone?: number; full?: number }): InputBinding
// 倾斜角（度）：deadzone（默认 5）以内力度 0，到 full（默认 30）线性增加到 1。left/right 绕屏幕纵轴（x 分量），forward/back 绕横轴（y 分量）。竖屏；横屏留到以后。
export type RawMotionEvent = { type: 'motion'; x: number; y: number; z: number }   // 单位 g
```

- 浏览器：`devicemotion` 的 `accelerationIncludingGravity` ÷ 9.81。iOS 13+：在第一次 `pointerdown` / `touchend`（捕获阶段的一次性监听，和 `BrowserAudio` 的解锁一样）里同步调用 `DeviceMotionEvent.requestPermission()`，结果写进 `permission`；拒绝了就不再尝试。
- 小游戏：`wx.startAccelerometer({ interval: 'game' })` + `wx.onAccelerometerChange`（已经是 g 单位；轴向真机核对）。`tree.focusChanged`：false → `wx.stopAccelerometer`，true → 重新 start。补 `wx.d.ts`。
- headless：没有生产者，`available = true`，`g.inject({ type: 'motion', x, y, z })`。
- 来源：`eventTypes: ['motion']`、`bindingTypes: ['tilt']`；`handle` 做平滑并更新 `x/y/z`；`strength` 从 `x/y` 算倾斜角再归一化。没有每帧代码。
- 演示：`examples/racer`（目录里只剩未跟踪的 `dist/` 和 `node_modules/`，可直接用）：竖屏公路，车左右移动，`steerLeft` / `steerRight` 同时绑 `key('KeyA')` / `tilt('left')`，游戏只读 `getAxis`。小游戏和浏览器两个入口。`permission === 'prompt'` 时显示"点击屏幕开启重力感应"。

### 测试工具（`sapling2d/testing`）

- `TestGameOptions.plugins` 透传（`createTestGame` 在前面加 `keyboard()`）。
- 新增 `g.inject(event: RawInputEvent)`：`tree.input.enqueue(event)`。`keyDown` / `keyUp` / `pressKey` 改走它；`pointer*` 仍走 `HeadlessPlatform.injectInput`（类型收窄为指针事件）。

## 顺序

每一步 `pnpm check` 绿，再做下一步。

1. 01 核心口子 + 键盘插件（一起做：键盘是口子的第一个消费者，拆开就没法验证）
2. 02 捕获取消 + 屏幕控件重写 + 删 `VirtualControls`
3. 03 `sapling2d/motion` + `examples/racer`
4. 04 文档：CONTEXT.md、llms 模板、`templates/game/AGENTS.md`、hero-guard 类型检查、0.3.0
5. 05 真机验证（需要用户的手机）

## 不在范围内

手柄插件、横屏下的倾斜轴向换算、`pointerEnter` / `pointerExit` 与显式捕获（passby 的前提）、震动、广告 / 分享 / 登录插件（机制就绪后各自开 spec）、去掉默认插件的开关、鼠标滚轮和右键。
