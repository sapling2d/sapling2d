import type { InputBinding } from '../core/input/bindings'
import type { RawInputEvent } from '../core/input/events'
import type { InputSource } from '../core/input/source'
import type { Plugin } from '../core/plugin'

/** 键盘事件。只有浏览器会产生；测试里用 `g.keyDown` / `g.pressKey` 注入。 */
export type RawKeyEvent = { type: 'keydown' | 'keyup'; code: string }

/** 键盘按键绑定（见 `key()`）。 */
export type KeyBinding = { readonly type: 'key'; readonly code: string }

/** 键盘按键绑定。`code` 是 KeyboardEvent.code，如 'Space'、'KeyA'、'ArrowLeft'。 */
export function key(code: string): InputBinding {
  return { type: 'key', code }
}

/**
 * 键盘状态，通过 `this.tree.get(Keyboard)` 访问。
 * 游戏一般不直接查按键，而是把按键绑定到动作（`actions: { jump: [key('Space')] }`）再查动作。
 */
export class Keyboard implements InputSource {
  readonly bindingTypes = ['key']
  readonly eventTypes = ['keydown', 'keyup']
  private readonly _down = new Set<string>()

  /** 按键是否按下。 */
  isPressed(code: string): boolean {
    return this._down.has(code)
  }

  /** @internal */
  handle(event: RawInputEvent): void {
    if (event.type === 'keydown') this._down.add(event.code)
    else if (event.type === 'keyup') this._down.delete(event.code)
  }

  /** @internal 任意一个绑定的按键按下时力度为 1。 */
  strength(_action: string, bindings: readonly InputBinding[]): number {
    for (let i = 0; i < bindings.length; i++) {
      const b = bindings[i]!
      if (b.type === 'key' && this._down.has(b.code)) return 1
    }
    return 0
  }

  /** @internal 切后台：按着的键排队成松开（队列里还没处理的按下也算）。 */
  releaseAll(queue: RawInputEvent[]): void {
    const codes = new Set(this._down)
    for (let i = 0; i < queue.length; i++) {
      const e = queue[i]!
      if (e.type === 'keydown') codes.add(e.code)
    }
    for (const code of codes) queue.push({ type: 'keyup', code })
  }
}

/**
 * 键盘插件。`sapling2d/browser` 的 `startGame` 和 `createTestGame` 默认安装，游戏不用自己加；小游戏入口不装（没有键盘）。
 * 浏览器里监听 window 的 keydown / keyup（忽略按住不放的自动重复）；窗口失焦时补发松开，避免按键卡住。
 * 其它平台只登记状态（测试里注入事件）。
 */
export function keyboard(): Plugin {
  return {
    install(ctx) {
      const kb = new Keyboard()
      ctx.provide(Keyboard, kb)
      const input = ctx.tree.input
      input.addSource(kb)
      const stop = ctx.platform.kind === 'browser' ? listen((e) => input.enqueue(e)) : null
      return () => {
        stop?.()
        input.removeSource(kb)
      }
    },
  }
}

/** 浏览器里用到的那一点 DOM。核心的类型检查没有 DOM 库，插件只声明自己用到的成员。 */
interface KeyEventLike {
  readonly type: string
  readonly code: string
  readonly repeat: boolean
}
interface WindowLike {
  addEventListener(type: string, listener: (event: KeyEventLike) => void): void
  removeEventListener(type: string, listener: (event: KeyEventLike) => void): void
}

function listen(emit: (event: RawKeyEvent) => void): (() => void) | null {
  const win = (globalThis as unknown as { window?: WindowLike }).window
  if (!win) return null
  // 记住按住的键：窗口失焦（alt-tab、点到别的窗口）时 keyup 会发到别处，这里补发
  const held = new Set<string>()
  const onKey = (e: KeyEventLike) => {
    if (e.repeat) return
    const down = e.type === 'keydown'
    if (down) held.add(e.code)
    else held.delete(e.code)
    emit({ type: down ? 'keydown' : 'keyup', code: e.code })
  }
  const onBlur = () => {
    for (const code of held) emit({ type: 'keyup', code })
    held.clear()
  }
  win.addEventListener('keydown', onKey)
  win.addEventListener('keyup', onKey)
  win.addEventListener('blur', onBlur)
  return () => {
    win.removeEventListener('keydown', onKey)
    win.removeEventListener('keyup', onKey)
    win.removeEventListener('blur', onBlur)
  }
}
