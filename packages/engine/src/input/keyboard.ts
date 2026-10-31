/*
 * 键盘的事件和绑定类型。键盘是内置的输入来源（`InputEventRegistry` / `InputBindingRegistry` 直接登记了它），
 * 所以类型放在输入层；真正监听键盘的是插件 `plugins/keyboard.ts`。
 */

/** 键盘事件。只有浏览器会产生；测试里用 `g.keyDown` / `g.pressKey` 注入。 */
export type RawKeyEvent = { type: 'keydown' | 'keyup'; code: string }

/** 键盘按键绑定（见 `key()`）。 */
export type KeyBinding = { readonly type: 'key'; readonly code: string }
