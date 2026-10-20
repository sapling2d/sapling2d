# 01 — 核心口子：Plugin、InputSource、开放的事件 / 绑定类型，键盘变成内置插件

**What to build:** 通用插件机制和 `Input` 的唯一扩展点，并把键盘从核心和 `BrowserPlatform` 里搬出来做成第一个（默认安装的）插件。键盘是这个口子的第一个消费者，两者一起做才能验证。规格见 `../spec.md`"接口"一节，决策见 `docs/adr/0010-plugins.md`。

- `Plugin` / `PluginContext` / `ServiceToken`（`core/plugin.ts`）；`GameOptions.plugins`；`Game.create` 建树后、加动作前按顺序安装；`game.destroy()` 按相反顺序卸载；`SceneTree.get(token)`；`provide` 重复报错。
- `Platform.kind`；`Platform.onInput` 收窄为 `RawPointerEvent`；三个实现跟上。
- `InputSource`、`input.addSource` / `removeSource` / `enqueue`；`_flush` 按 spec 的顺序；按 `eventTypes` 路由（`Map<string, InputSource[]>`，`addSource` 时建好，热路径不分配）；力度取所有来源的最大值；`addAction` 时未被认领的绑定类型 `console.warn`。
- `InputEventRegistry` / `InputBindingRegistry` 声明合并；核心只登记 `pointer`。
- 键盘插件 `src/plugins/keyboard.ts`：`keyboard()`、`key()`、`Keyboard`、`RawKeyEvent`，从 `sapling2d` 导出；浏览器生产者（含 `blur` 补发）；切后台时来源把按着的键排队成 keyup。`Input` 删掉 `_keysDown`、`isKeyPressed`、key 事件处理。
- `sapling2d/browser` 的 `startGame` 和 `createTestGame` 默认 `plugins: [keyboard(), ...]`；`sapling2d/wechat` 原样传。
- `sapling2d/testing`：`TestGameOptions.plugins`；`g.inject(event)`；`keyDown` / `keyUp` / `pressKey` 改走 `inject`；`HeadlessPlatform.injectInput` 只收指针事件。
- **这一步不动屏幕控件**：`VirtualControls` 暂时改成 `Input` 内部登记的一个 `InputSource`（只改 `strength` 的接入方式，`PointerRouter` 的耦合留给 02）。

**Blocked by:** None — can start immediately

**Status:** done（2026-10-20）

- [x] `startGame({ main, plugins: [p] })` 和 `createTestGame({ ..., plugins: [p] })` 会调用 `p.install`，顺序和数组一致，`ctx.platform.kind` 正确
- [x] `tree.get(Token)` 取到 `provide` 的服务；没装时的错误信息包含 token 名和 `plugins: [...]` 提示；同一个 token 提供两次报错
- [x] `game.destroy()` 调用卸载函数（顺序相反）
- [x] 一个测试用的来源（`bindingTypes: ['dial']`、`eventTypes: ['dial', 'pointerdown']`）：`g.inject({ type: 'dial', … })` 后 `handle` 在下一次 `step` 的帧首收到；`strength` 参与动作力度；和键盘取最大
- [x] 核心指针事件先到节点信号、再到订阅了 `pointerdown` 的来源
- [x] `addAction('x', [{ type: 'nope' }])` 打一次警告，`key()` / `pointerPress()` 不警告
- [x] 键盘：`test/input.test.ts` 现有 21 个用例全部通过（改 `isKeyPressed` 为 `tree.get(Keyboard).isPressed`）；`pressKey` 的 just-pressed 渲染帧 / 物理步语义不变
- [x] 切后台：按着的键在下一帧帧首松开，`isActionJustReleased` 为 true；队列里还没处理的 keydown 也不会卡住
- [x] `createTestGame({ plugins: [] })` 仍然有键盘（默认在前面）
- [x] `BrowserPlatform.onInput` 只剩指针监听；`WechatPlatform` / `HeadlessPlatform` 有 `kind`
- [x] 每帧热路径不新增分配：`_flush` 空队列时直接返回；队列用两个数组轮换；遍历来源用复用的 scratch 数组
- [x] `VirtualControls` 作为内部来源接入，`test/touch-button.test.ts` 和 `test/touch-joystick.test.ts` 不改即通过
- [x] `pnpm check` 绿（`isKeyPressed` 在 examples / templates / hero-guard / `docs/examples` 里都没有使用者，只有 `test/input.test.ts` 要改）

## Comments

**实现（2026-10-20）：** `pnpm check` 全部 workspace 包通过（engine 479 个测试，含新的 `test/plugins.test.ts` 14 个）；`pnpm --filter sapling2d build` 通过。和 spec 的出入已经改回 spec：

- **注册表放在 `src/index.ts`**（和 `ActionRegistry` 一样），核心的 `events.ts` / `bindings.ts` 用 `import type` 从 `'../../index'` 取（`actions.ts` 已有先例）。内置键盘的 `key` 事件和绑定直接写在表里，不用声明合并——避免在包内对自己做 `declare module`，dts 打包后形态不确定。外部插件用 `declare module 'sapling2d'`，`test/plugins.test.ts` 就是这么写的（`dial` 事件和绑定），类型检查通过。
- **来源的切后台用 `InputSource.releaseAll(queue)`**，由 `Input._releaseAll` 调用，而不是插件自己连 `tree.focusChanged`：来源能看到队列里还没处理的按下（它们的松开在后台收不到），和原来 `Input` 对键盘的处理一样，headless 里也能测。传感器 start / stop 这类生命周期仍用 `focusChanged`。
- **插件里的 DOM 类型**：核心 tsconfig 没有 DOM 库，而 `index.ts` import 了键盘插件，所以插件不能直接写 `window`。只声明用到的成员（`WindowLike` / `KeyEventLike`），`(globalThis as unknown as { window?: WindowLike }).window`。03 的 motion 是独立入口，可以另配 tsconfig，也可以照这个办法。
- `_flush`：空队列直接返回；`_queue` / `_spare` 两个数组轮换（处理期间入队的事件进另一个数组、下一帧处理，和以前一样）；帧首和事件分发各一个复用的 scratch 数组（嵌套时互不覆盖）。
- `Game.create` 顺序：建树 → 装插件 → 加动作 → Autoload。`platform.onInput` 的回调类型收窄后 `touch.ts`、`HeadlessPlatform.injectInput` 都只收指针事件；`wechat-touch.test.ts` 不用改。
- 构建产物：键盘插件被打成共享 chunk `dist/keyboard-*.js`（2.9 kB），`browser.js` 和 `testing.js` 引用它，`wechat.js` 不引用。
- 顺手改了 `examples/spinblade/src/touchDebug.ts`（`_enqueue` → `enqueue`）。
