import { tex, type AudioStream, type NineSliceMargins, type Plugin, type SceneTree, type Texture } from 'sapling2d'

/** 一张九宫格皮肤：贴图和它的边距。 */
export interface SkinPiece {
  readonly texture: Texture
  readonly margins: NineSliceMargins | number
}

/**
 * 默认皮肤：包里的 `assets/`（`package.json` 声明了 `"sapling2d": { "assets": "assets" }`，构建工具挂载到 `~@sapling2d/ui/`，见 ADR 0011）。
 * 灰白的圆角九宫格，可被 `modulate` 染色；游戏要换皮就给控件传自己的贴图。
 */
export const UI_SKIN = {
  /** 按钮底图（64×64）。 */
  button: { texture: tex('~@sapling2d/ui/button.png'), margins: 20 } as SkinPiece,
  /** 按钮按下态（64×64）。 */
  buttonPressed: { texture: tex('~@sapling2d/ui/button-pressed.png'), margins: 20 } as SkinPiece,
  /** 面板 / 进度条底（64×64，深色半透明）。 */
  panel: { texture: tex('~@sapling2d/ui/panel.png'), margins: 16 } as SkinPiece,
  /** 进度条填充（32×32，纯白，用 modulate 染色）。 */
  barFill: { texture: tex('~@sapling2d/ui/bar-fill.png'), margins: 10 } as SkinPiece,
}

/** 按钮的按下反馈：视觉主体围绕中心缩放到 `scale` 倍、底图压暗成 `tint`（0xRRGGBB），`duration` 秒内补间（0 为立刻生效，不补间）。 */
export interface PressEffect {
  scale?: number
  tint?: number
  duration?: number
}

export interface UiOptions {
  /** 所有按钮的默认按下反馈；`false` 关闭。默认 `{ scale: 1.1, duration: 0.08 }`。 */
  pressEffect?: PressEffect | false
  /** 所有按钮点击时播放的音效（`sfx()`，插件预加载），按钮自己的 `clickSound` 优先。默认没有。 */
  clickSound?: AudioStream | null
}

export const DEFAULT_PRESS_EFFECT: Readonly<Required<PressEffect>> = { scale: 1.1, tint: 0xffffff, duration: 0.08 }

/** `ui()` 提供的服务：默认皮肤和按钮的全局默认值。`tree.get(UiTheme)`。 */
export class UiTheme {
  readonly skin = UI_SKIN
  pressEffect: PressEffect | false
  clickSound: AudioStream | null

  constructor(options: UiOptions = {}) {
    this.pressEffect = options.pressEffect === undefined ? { ...DEFAULT_PRESS_EFFECT } : options.pressEffect
    this.clickSound = options.clickSound ?? null
  }
}

/**
 * 界面控件插件：预加载默认皮肤（和入口场景的资源一起加载，切场景不卸载），并提供 `UiTheme`。
 * `startGame({ main, plugins: [ui()] })`；不装也能用控件：传自己的贴图照常工作，用默认皮肤会警告一次，`texture: null` 是纯色模式。
 */
export function ui(options: UiOptions = {}): Plugin {
  return {
    install(ctx) {
      ctx.provide(UiTheme, new UiTheme(options))
      // 全局音效也在这里预加载并钉住；按钮自己的 clickSound 由游戏放进场景的 static assets
      ctx.preload({ button: UI_SKIN.button.texture, buttonPressed: UI_SKIN.buttonPressed.texture, panel: UI_SKIN.panel.texture, barFill: UI_SKIN.barFill.texture, ...(options.clickSound ? { click: options.clickSound } : {}) })
    },
  }
}

/** @internal 装了 `ui()` 时的主题，没装时 null。 */
export function _themeOf(tree: SceneTree): UiTheme | null {
  try {
    return tree.get(UiTheme)
  } catch {
    return null
  }
}

const warned = new WeakSet<SceneTree>()

/** @internal 用了默认皮肤的控件进树时调用：没装 `ui()` 就警告（每个游戏一次）。 */
export function _ensureSkin(tree: SceneTree, who: string): void {
  if (_themeOf(tree) || warned.has(tree)) return
  warned.add(tree)
  console.warn(`${who} uses the default skin, but the ui plugin is not installed, so the skin is never loaded and the control is invisible. Add plugins: [ui()] (from '@sapling2d/ui') to the game options, or pass your own texture (null for a flat-color control).`)
}
