import { tex, type Plugin, type SceneTree } from 'sapling2d'

/**
 * 默认皮肤：包里的 `assets/`（`package.json` 声明了 `"sapling2d": { "assets": "assets" }`，构建工具挂载到 `~@sapling2d/touch/`，见 ADR 0011）。
 * 灰白半透明的圆，适合压在任何画面上；游戏要换皮就给节点传自己的贴图。
 */
export const TOUCH_SKIN = {
  /** 摇杆底座（200×200 的圆环）。 */
  base: tex('~@sapling2d/touch/joystick-base.png'),
  /** 摇杆头（96×96 的圆）。 */
  knob: tex('~@sapling2d/touch/joystick-knob.png'),
  /** 屏幕按钮（140×140 的圆）。 */
  button: tex('~@sapling2d/touch/button.png'),
}

/** `touch()` 提供的服务：现在只是“装了插件”的标志，以后可以放皮肤配置。 */
export class TouchControls {
  readonly skin = TOUCH_SKIN
}

/**
 * 屏幕控件插件：预加载默认皮肤（和入口场景的资源一起加载，切场景不卸载）。
 * `startGame({ main, plugins: [touch()] })`；不装也能用 `TouchScreenButton` / `TouchJoystick`，只是默认皮肤不会加载（进树时警告一次）。
 */
export function touch(): Plugin {
  return {
    install(ctx) {
      ctx.provide(TouchControls, new TouchControls())
      ctx.preload(TOUCH_SKIN)
    },
  }
}

const warned = new WeakSet<SceneTree>()

/** @internal 用了默认皮肤的控件进树时调用：没装 `touch()` 就警告（每个游戏一次）。 */
export function _ensureSkin(tree: SceneTree, who: string): void {
  try {
    tree.get(TouchControls)
    return
  } catch {
    // 没装
  }
  if (warned.has(tree)) return
  warned.add(tree)
  console.warn(`${who} uses the default skin, but the touch plugin is not installed, so the skin is never loaded and the control is invisible. Add plugins: [touch()] (from '@sapling2d/touch') to the game options, or pass your own texture (null for an input-only control).`)
}
