# 01 — 核心口子：Plugin、InputSource、开放的事件 / 绑定类型，键盘变成内置插件

**What to build:** 通用插件机制和 `Input` 的唯一扩展点，并把键盘从核心和 `BrowserPlatform` 里搬出来做成第一个（默认安装的）插件。键盘是这个口子的第一个消费者，两者一起做才能验证。规格见 `../spec.md`"接口"一节，决策见 `docs/adr/0010-plugins.md`。

- `Plugin` / `PluginContext` / `ServiceToken`（`core/plugin.ts`）；`GameOptions.plugins`；`Game.create` 建树后、加动作前按顺序安装；`game.destroy()` 按相反顺序卸载；`SceneTree.get(token)`；`provide` 重复报错。
- `Platform.kind`；`Platform.onInput` 收窄为 `RawPointerEvent`；三个实现跟上。
- `InputSource`、`input.addSource` / `removeSource` / `enqueue`；`_flush` 按 spec 的顺序；按 `eventTypes` 路由（`Map<string, InputSource[]>`，`addSource` 时建好，热路径不分配）；力度取所有来源的最大值；`addAction` 时未被认领的绑定类型 `console.warn`。
- `InputEventRegistry` / `InputBindingRegistry` 声明合并；核心只登记 `pointer`。
- 键盘插件 `src/plugins/keyboard.ts`：`keyboard()`、`key()`、`Keyboard`、`RawKeyEvent`，从 `sapling2d` 导出；浏览器生产者（含 `blur` 补发）；`tree.focusChanged(false)` 时来源把按着的键排队成 keyup。`Input` 删掉 `_keysDown`、`isKeyPressed`、key 事件处理。
- `sapling2d/browser` 的 `startGame` 和 `createTestGame` 默认 `plugins: [keyboard(), ...]`；`sapling2d/wechat` 原样传。
- `sapling2d/testing`：`TestGameOptions.plugins`；`g.inject(event)`；`keyDown` / `keyUp` / `pressKey` 改走 `inject`；`HeadlessPlatform.injectInput` 只收指针事件。
- **这一步不动屏幕控件**：`VirtualControls` 暂时改成 `Input` 内部登记的一个 `InputSource`（只改 `strength` 的接入方式，`PointerRouter` 的耦合留给 02）。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `startGame({ main, plugins: [p] })` 和 `createTestGame({ ..., plugins: [p] })` 会调用 `p.install`，顺序和数组一致，`ctx.platform.kind` 正确
- [ ] `tree.get(Token)` 取到 `provide` 的服务；没装时的错误信息包含 token 名和 `plugins: [...]` 提示；同一个 token 提供两次报错
- [ ] `game.destroy()` 调用卸载函数（顺序相反）
- [ ] 一个测试用的来源（`bindingTypes: ['test']`、`eventTypes: ['test']`）：`g.inject({ type: 'test', … })` 后 `handle` 在下一次 `step` 的帧首收到；`strength` 参与动作力度；和键盘取最大
- [ ] 核心指针事件先到节点信号、再到订阅了 `pointerdown` 的来源
- [ ] `addAction('x', [{ type: 'nope' }])` 打一次警告，`key()` / `pointerPress()` 不警告
- [ ] 键盘：`test/input.test.ts` 现有 21 个用例全部通过（改 `isKeyPressed` 为 `tree.get(Keyboard).isPressed`）；`pressKey` 的 just-pressed 渲染帧 / 物理步语义不变
- [ ] 切后台：按着的键在下一帧帧首松开，`isActionJustReleased` 为 true；队列里还没处理的 keydown 也不会卡住
- [ ] `createTestGame({ plugins: [] })` 仍然有键盘（默认在前面）
- [ ] `BrowserPlatform.onInput` 只剩指针监听；`WechatPlatform` / `HeadlessPlatform` 有 `kind`
- [ ] 每帧热路径不新增分配：`_flush` 空队列时不创建数组 / 闭包（看一眼 `--cpu-prof` 或直接读代码）
- [ ] `VirtualControls` 作为内部来源接入，`test/touch-button.test.ts` 和 `test/touch-joystick.test.ts` 不改即通过
- [ ] `pnpm check` 绿（`isKeyPressed` 在 examples / templates / hero-guard / `docs/examples` 里都没有使用者，只有 `test/input.test.ts` 要改）

**实现提示**

- 声明合并要合并到接口**声明所在的模块**：引擎内部的键盘插件写 `declare module '../core/input/events'`，外部插件写 `declare module 'sapling2d'`。两者作用于同一个接口。
- `ServiceToken<T> = abstract new (...args: never[]) => T`：类本身当 token，`Keyboard` 这种构造函数带参数的也能用。
- `addAction` 的警告要在插件全部安装之后才有意义，所以 `Game.create` 先装插件再加动作。
- `Game` 里 `platform.onInput((e) => tree.input.enqueue(e))` 不变，只是类型变窄。
